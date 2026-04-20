"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchDateRangeEntries } from "@/lib/db_handler";
import { AddContributers } from "@/components/ui/add-contributors";
import { useToolbar } from "../nav_tool_handler";
import { ChatBox } from "./comp/chat";
import { DatePickerWithRange } from "./actions/date-pick-with-range";
import { format } from "date-fns";
import { X, Box, Printer, CalendarSearch, UserPlus2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import ExportToCSV from "./actions/export-to-csv";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { getAddEntryForm, getJournalIcon } from "./journal-types/config";
import { ROLES_THAT_ADD } from "@/../../backend/functions/src/common/const";
import { useAuth } from "@/lib/auth_handler";
import { useJournalContext } from "@/context/JournalContext";
import { useToast } from "@/hooks/use-toast";
import { DBentry } from "@/lib/custom_types";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
import { pendingAccessSchemaType } from "@/../../backend/functions/src/common/schemas/common_schemas";
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
  const clearRange = () => {
    setdateRange(undefined);
  };

  return dateRange ? (
    <button
      className="text-xs font-bold rounded-md border-2 p-1 px-2"
      onClick={clearRange}
    >
      <div className="flex flex-row items-center space-x-1">
        <p>
          {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
        </p>
        <X size={16} className="ml-1" />
      </div>
    </button>
  ) : null;
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
  const [filterList, setFilterList] = useState<DBentry[]>([]);
  const [actionButton, setActionButton] = useState<React.ReactNode>(null);
  const { setToolBar } = useToolbar();
  const { journal, loading, error } = useJournalContext();
  const { toast } = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const journalId = params.get("jid");
  const jtypeParam = params.get("jtype");
  const displayEntryType: EntryType = (jtypeParam === "template" || jtypeParam === "estimate") ? jtypeParam as EntryType : "estimate";
  const t = useTranslations("estimate");
  const t_c = useTranslations("contributors");
  const t_j = useTranslations("journal");

  // State to control AddContributers dialog from mobile dropdown
  const [contributorsOpen, setContributorsOpen] = useState(false);

  useEffect(() => {
    if (!journalId) {
      router.push("/");
      return;
    }
  }, [journalId, router]);

  useEffect(() => {
    if (journal) {
      const isAdmin =
        journal.access &&
        authUser?.uid &&
        journal.access[authUser.uid]?.role === "admin";

      setToolBar(
        <div className="flex flex-row justify-between items-center w-full">
          <div className="flex justify-start items-center gap-2 min-w-0 px-3 py-1.5 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors cursor-default group" title={journal.title}>
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
                Studio
              </Badge>
            )}
            {jtypeParam === "estimate" && (
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] uppercase tracking-wider font-bold h-5 px-1.5"
              >
                Estimate
              </Badge>
            )}
          </div>
          <div className="flex flex-row items-center space-x-2 flex-shrink-0">
            {/* Desktop: show all actions inline */}
            <div className="hidden md:flex items-center space-x-2">
              <DatePickerWithRange
                daterange={dateRange}
                setDate={setDateRange}
              />
              {displayEntryType !== "template" && <Link href={`/journal?jid=${journal.id}&jtype=template`}>
                <Button variant="outline" size="sm" className="flex items-center gap-2 h-9" title="Open 3D Studio">
                  <Box size={16} />
                  <span className="hidden lg:inline-block">Studio</span>
                </Button>
              </Link>}
              {displayEntryType === "estimate" && <Link href={`/journal/quick-print?jid=${journal.id}`} target="_blank">
                <Button variant="outline" size="sm" className="flex items-center gap-2 h-9" title={t("quickPrint") || "Quick Print"}>
                  <Printer size={16} />
                  <span className="hidden lg:inline-block">{t("quickPrint") || "Quick Print"}</span>
                </Button>
              </Link>}
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
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" aria-label={t_j("moreActions")}>
                    <MoreHorizontal size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{t_j("moreActions")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="px-2">
                    <DatePickerWithRange
                      daterange={dateRange}
                      setDate={setDateRange}
                    />
                    <span className="ml-2 text-sm">{t_j("dateFilter")}</span>
                  </DropdownMenuItem>
                  {displayEntryType !== "template" && (
                    <DropdownMenuItem asChild>
                      <Link href={`/journal?jid=${journal.id}&jtype=template`} className="flex items-center gap-2 cursor-pointer">
                        <Box size={16} />
                        <span>{t_j("studio")}</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {displayEntryType === "estimate" && (
                    <DropdownMenuItem asChild>
                      <Link href={`/journal/quick-print?jid=${journal.id}`} target="_blank" className="flex items-center gap-2 cursor-pointer">
                        <Printer size={16} />
                        <span>{t("quickPrint") || "Quick Print"}</span>
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
  }, [journal, authUser, journalId, dateRange, setToolBar, displayEntryType, jtypeParam]);

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
    (newEntryId: string) => {
      // Show success toast - the real-time subscription will handle showing the new entry
      toast({
        title: t("estimateDuplicated") || "Estimate Duplicated",
        description:
          t("duplicateSuccess") ||
          "The estimate has been duplicated successfully.",
      });
    },
    [toast, t],
  );

  if (!journalId) return null;
  if (journal === undefined)
    return <div className="text-center p-6">{t("loading")}</div>;
  if (journal === null) return <NotFound />;

  const isAdmin =
    journal?.access &&
    authUser?.uid &&
    journal.access[authUser.uid]?.role === "admin";

  return (
    <div className="flex flex-col items-center justify-start w-full h-[calc(100vh-4rem)] overflow-hidden px-2 sm:px-6 lg:px-8">
      <div
        id="filter-badges"
        className="flex flex-row items-center justify-center space-x-2 py-2 flex-shrink-0"
      >
        <FilterRangeBadge dateRange={dateRange} setdateRange={setDateRange} />
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
                  entry_list={filterList}
                  filename={`${journal.title}-Estimates-${format(
                    dateRange.from,
                    "yyyyMMdd",
                  )}-${format(dateRange.to, "yyyyMMdd")}.csv`}
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
