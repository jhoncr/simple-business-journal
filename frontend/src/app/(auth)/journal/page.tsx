"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDateRangeEntries } from "@/lib/db_handler";
import { AddContributers } from "@/components/ui/add-contributors";
import { useToolbar } from "../nav_tool_handler";
import { ChatBox } from "./comp/chat";
import { DatePickerWithRange } from "./actions/date-pick-with-range";
import { StatusFilter } from "./actions/status-filter";
import { format } from "date-fns";
import { X, Box, Printer, UserPlus2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import ExportToCSV from "./actions/export-to-csv";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { getAddEntryForm, getJournalIcon } from "./journal-types/config";
import { ROLES_THAT_ADD } from "@backend/common/const";
import { useAuth } from "@/lib/auth_handler";
import { useJournalContext } from "@/context/JournalContext";
import { useToast } from "@/hooks/use-toast";
import { DBentry } from "@/lib/custom_types";
import { EntryType } from "@backend/common/schemas/configmap";
import { pendingAccessSchemaType } from "@backend/common/schemas/common_schemas";
import { WorkStatus } from "@backend/common/common_types";
import { getStatusLabel } from "./journal-types/estimate/subcomponents/estimateStatus";
import { cn, getEstimateStatus } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface DateRange {
  from: Date;
  to: Date;
}

const FilterRangeBadge = ({
  dateRange,
  setdateRange,
}: {
  dateRange: DateRange | undefined;
  setdateRange: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}) => {
  const t_j = useTranslations("journal");
  const clearRange = () => {
    setdateRange(undefined);
  };

  return dateRange ? (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-md border px-2.5 py-1 transition-colors bg-muted/80 hover:bg-muted text-foreground border-border cursor-pointer group"
      onClick={clearRange}
      aria-label={t_j("removeFilter", { name: t_j("dateFilter") })}
    >
      <span>
        {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
      </span>
      <X size={14} className="ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
    </button>
  ) : null;
};

interface FilterStatusBadgeProps {
  status: WorkStatus;
  onRemove: () => void;
}

const statusBadgeStyles: Record<WorkStatus, string> = {
  [WorkStatus.DRAFT]:
    "bg-gray-100/90 hover:bg-gray-200/90 text-gray-800 border-gray-300 dark:bg-gray-800/90 dark:hover:bg-gray-700/90 dark:text-gray-200 dark:border-gray-600",
  [WorkStatus.IN_PROCESS]:
    "bg-blue-50/90 hover:bg-blue-100/90 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700",
  [WorkStatus.DELIVERED]:
    "bg-green-50/90 hover:bg-green-100/90 text-green-800 border-green-300 dark:bg-green-950/60 dark:hover:bg-green-900/60 dark:text-green-200 dark:border-green-700",
};

const statusDotColors: Record<WorkStatus, string> = {
  [WorkStatus.DRAFT]: "bg-gray-500 dark:bg-gray-400",
  [WorkStatus.IN_PROCESS]: "bg-blue-500 dark:bg-blue-400",
  [WorkStatus.DELIVERED]: "bg-green-500 dark:bg-green-400",
};

const FilterStatusBadge = ({ status, onRemove }: FilterStatusBadgeProps) => {
  const t_est = useTranslations("estimate");
  const t_j = useTranslations("journal");
  const label = getStatusLabel(status, t_est);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold rounded-md border px-2.5 py-1 transition-colors cursor-pointer group",
        statusBadgeStyles[status],
      )}
      onClick={onRemove}
      aria-label={t_j("removeFilter", { name: label })}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full flex-shrink-0",
          statusDotColors[status],
        )}
      />
      <span>{label}</span>
      <X
        size={14}
        className="ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
      />
    </button>
  );
};

const NotFound = () => {
  const t = useTranslations("journal");
  return (
    <main className="flex flex-col items-center justify-center w-full mt-12 h-screen">
      <p className="text-2xl font-bold">{t("notFound")}</p>
    </main>
  );
};

export default function ListJournalPage() {
  const { authUser } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedStatuses, setSelectedStatuses] = useState<WorkStatus[]>([]);
  const [filterList, setFilterList] = useState<DBentry[]>([]);
  const [actionButton, setActionButton] = useState<React.ReactNode>(null);
  const { setToolBar } = useToolbar();
  const { journal } = useJournalContext();
  const { toast } = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const journalId = params.get("jid");
  const jtypeParam = params.get("jtype");
  const displayEntryType: EntryType =
    jtypeParam === "template" || jtypeParam === "estimate"
      ? (jtypeParam as EntryType)
      : "estimate";
  const t = useTranslations("estimate");
  const t_c = useTranslations("contributors");
  const t_j = useTranslations("journal");

  // State to control AddContributers dialog from mobile dropdown
  const [contributorsOpen, setContributorsOpen] = useState(false);

  // Clear status filters if switching away from estimate type
  useEffect(() => {
    if (displayEntryType !== "estimate") {
      setSelectedStatuses([]);
    }
  }, [displayEntryType]);

  useEffect(() => {
    if (!journalId) {
      router.push("/");
      return;
    }
  }, [journalId, router]);

  const hasDateFilter = !!dateRange;
  const hasStatusFilter =
    displayEntryType === "estimate" && selectedStatuses.length > 0;
  const hasActiveFilters = hasDateFilter || hasStatusFilter;

  const handleRemoveStatus = useCallback((statusToRemove: WorkStatus) => {
    setSelectedStatuses((prev) => prev.filter((s) => s !== statusToRemove));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setDateRange(undefined);
    setSelectedStatuses([]);
  }, []);

  useEffect(() => {
    if (journal) {
      const isAdmin =
        journal.access &&
        authUser?.uid &&
        journal.access[authUser.uid]?.role === "admin";

      setToolBar(
        <div className="flex flex-row justify-between items-center w-full">
          <div
            className="flex justify-start items-center gap-2 min-w-0 px-3 py-1.5 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors cursor-default group"
            title={journal.title}
          >
            <div className="text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
              {getJournalIcon(journal.journalType)}
            </div>
            <p className="font-semibold text-sm truncate max-w-[100px] sm:max-w-[250px]">
              {journal.title}
            </p>
            {jtypeParam === "template" && (
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase tracking-wider font-bold h-5 px-1.5"
              >
                {t_j("studio")}
              </Badge>
            )}
            {jtypeParam === "estimate" && (
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] uppercase tracking-wider font-bold h-5 px-1.5"
              >
                {t_j("estimate")}
              </Badge>
            )}
          </div>
          <div className="flex flex-row items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            {/* Filter controls: directly accessible on both desktop and mobile */}
            <DatePickerWithRange
              daterange={dateRange}
              setDate={setDateRange}
            />
            {displayEntryType === "estimate" && (
              <StatusFilter
                selectedStatuses={selectedStatuses}
                onStatusChange={setSelectedStatuses}
              />
            )}

            {/* Desktop: show navigation & admin actions inline */}
            <div className="hidden md:flex items-center space-x-2">
              {displayEntryType !== "template" && (
                <Link href={`/journal?jid=${journal.id}&jtype=template`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 h-9"
                    title={t_j("openStudio")}
                  >
                    <Box size={16} />
                    <span className="hidden lg:inline-block">
                      {t_j("studio")}
                    </span>
                  </Button>
                </Link>
              )}
              {displayEntryType === "estimate" && (
                <Link
                  href={`/journal/quick-print?jid=${journal.id}`}
                  target="_blank"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 h-9"
                    title={t("quickPrint")}
                  >
                    <Printer size={16} />
                    <span className="hidden lg:inline-block">
                      {t("quickPrint")}
                    </span>
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <AddContributers
                  journalId={journal.id}
                  access={journal.access as any}
                  pendingAccess={
                    (journal.pendingAccess || {}) as pendingAccessSchemaType
                  }
                />
              )}
            </div>

            {/* Mobile: collapse secondary actions into a dropdown */}
            {(displayEntryType !== "template" || isAdmin) && (
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      aria-label={t_j("moreActions")}
                    >
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {t_j("moreActions")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {displayEntryType !== "template" && (
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/journal?jid=${journal.id}&jtype=template`}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Box size={16} />
                          <span>{t_j("studio")}</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {displayEntryType === "estimate" && (
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/journal/quick-print?jid=${journal.id}`}
                          target="_blank"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Printer size={16} />
                          <span>{t("quickPrint")}</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setContributorsOpen(true)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <UserPlus2 size={16} />
                          <span>{t_j("contributors")}</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Role badge - always visible, it's compact */}
            {authUser?.uid && journal?.access?.[authUser.uid]?.role && (
              <Badge variant="secondary">
                {t_c(`roles.${journal.access[authUser.uid].role}`) || "-"}
              </Badge>
            )}
          </div>
        </div>,
      );

      const AddEntryForm = getAddEntryForm(displayEntryType);
      if (
        AddEntryForm &&
        authUser?.uid &&
        journal.access?.[authUser.uid] &&
        ROLES_THAT_ADD.has(journal.access[authUser.uid].role)
      ) {
        setActionButton(<AddEntryForm journalId={journalId!} />);
      } else {
        setActionButton(null);
      }
    } else {
      setToolBar(null);
      setActionButton(null);
    }

    return () => {
      setToolBar(null);
    };
  }, [
    journal,
    authUser,
    journalId,
    dateRange,
    selectedStatuses,
    setToolBar,
    displayEntryType,
    jtypeParam,
    t,
    t_c,
    t_j,
  ]);

  const fetchFilterList = useCallback(async () => {
    if (!dateRange || !journalId) return;
    const entries = await fetchDateRangeEntries(
      journalId,
      displayEntryType,
      dateRange.from,
      dateRange.to,
    );
    setFilterList(entries);
  }, [dateRange, journalId, displayEntryType]);

  useEffect(() => {
    if (dateRange) {
      fetchFilterList();
    } else {
      setFilterList([]);
    }
  }, [dateRange, fetchFilterList]);

  const removeFilterEntry = useCallback((entry: DBentry) => {
    setFilterList((prevList) => prevList.filter((x) => x.id !== entry.id));
  }, []);

  const handleDuplicated = useCallback(
    (_newEntryId: string) => {
      // Show success toast - the real-time subscription will handle showing the new entry
      toast({
        title: t_j("estimateDuplicated") || "Estimate Duplicated",
        description:
          t_j("duplicateSuccess") ||
          "The estimate has been duplicated successfully.",
      });
    },
    [toast, t_j],
  );

  const filteredExportList = useMemo(() => {
    if (hasStatusFilter) {
      return filterList.filter((e) =>
        selectedStatuses.includes(getEstimateStatus(e)),
      );
    }
    return filterList;
  }, [filterList, hasStatusFilter, selectedStatuses]);

  const getExportFilename = useCallback(() => {
    const title = journal?.title || "Journal";
    const dateStr = dateRange
      ? `${format(dateRange.from, "yyyyMMdd")}-${format(dateRange.to, "yyyyMMdd")}`
      : "";
    const statusStr =
      selectedStatuses.length > 0 ? selectedStatuses.join("-") : "";

    if (dateStr && statusStr) {
      return `${title}-Estimates-${statusStr}-${dateStr}.csv`;
    }
    if (dateStr) {
      return `${title}-Estimates-${dateStr}.csv`;
    }
    if (statusStr) {
      return `${title}-Estimates-${statusStr}.csv`;
    }
    return `${title}-Estimates.csv`;
  }, [journal?.title, dateRange, selectedStatuses]);

  if (!journalId) return null;
  if (journal === undefined)
    return <div className="text-center p-6">{t_j("loading")}</div>;
  if (journal === null) return <NotFound />;

  const isAdmin =
    journal?.access &&
    authUser?.uid &&
    journal.access[authUser.uid]?.role === "admin";

  return (
    <div className="flex flex-col items-center justify-start w-full h-[calc(100vh-4rem)] overflow-hidden px-2 sm:px-6 lg:px-8">
      <div
        id="filter-badges"
        className="flex flex-row flex-wrap items-center justify-center gap-2 py-2 flex-shrink-0"
      >
        <FilterRangeBadge dateRange={dateRange} setdateRange={setDateRange} />
        {displayEntryType === "estimate" &&
          selectedStatuses.map((status) => (
            <FilterStatusBadge
              key={status}
              status={status}
              onRemove={() => handleRemoveStatus(status)}
            />
          ))}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-medium"
            onClick={handleClearAllFilters}
          >
            <X size={12} className="mr-1" />
            {t_j("clearAll")}
          </Button>
        )}
      </div>
      <div className="w-full flex-1 overflow-hidden">
        {journal.access && journalId && (
          <ChatBox
            journalId={journalId}
            entryType={displayEntryType}
            access={journal.access as any}
            actionButton={
              dateRange ? (
                <ExportToCSV
                  entry_list={filteredExportList}
                  filename={getExportFilename()}
                  access={journal.access as any}
                />
              ) : (
                actionButton
              )
            }
            filterList={filterList}
            hasFilter={!!dateRange}
            removeFilterEntry={removeFilterEntry}
            onDuplicated={handleDuplicated}
            selectedStatuses={selectedStatuses}
          />
        )}
      </div>

      {/* Mobile-triggered Contributors dialog (controlled externally) */}
      {isAdmin && (
        <AddContributers
          journalId={journalId!}
          access={journal.access as any}
          pendingAccess={
            (journal.pendingAccess || {}) as pendingAccessSchemaType
          }
          externalOpen={contributorsOpen}
          onExternalOpenChange={setContributorsOpen}
        />
      )}
    </div>
  );
}

