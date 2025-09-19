"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchDateRangeEntries, useWatchJournal } from "@/lib/db_handler";
import { AddContributers } from "@/components/ui/add-contributors";
import { useToolbar } from "../nav_tool_handler";
import { ChatBox } from "./comp/chat";
import Link from "next/link";
import { DatePickerWithRange } from "./actions/date-pick-with-range";
import { format } from "date-fns";
import { X } from "lucide-react";
import ExportToCSV from "./actions/export-to-csv";
import { useSearchParams, useRouter } from "next/navigation";
import { getAddEntryForm, getJournalIcon } from "./journal-types/config";
import { ROLES_THAT_ADD } from "@/../../backend/functions/src/common/const";
import { useAuth } from "@/lib/auth_handler";
import { useJournalContext } from "@/context/JournalContext";
import { DBentry, Journal } from "@/lib/custom_types";
import {
  EntryType,
  ENTRY_CONFIG,
} from "@/../../backend/functions/src/common/schemas/configmap";
import { JOURNAL_TYPES } from "@/../../backend/functions/src/common/const";
import { BusinessDetailsType } from "@/../../backend/functions/src/common/schemas/JournalSchema";
import { pendingAccessSchemaType } from "@/../../backend/functions/src/common/schemas/common_schemas";
import { Badge } from "@/components/ui/badge";

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

const NotFound = () => (
  <main className="flex flex-col items-center justify-center w-full mt-12 h-screen">
    <p className="text-2xl font-bold">Log not found :/</p>
  </main>
);

export default function ListJournalPage() {
  const { authUser } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filterList, setFilterList] = useState<DBentry[]>([]);
  const [actionButton, setActionButton] = useState<React.ReactNode>(null);
  const { setToolBar } = useToolbar();
  const { journal, loading, error } = useJournalContext();
  const params = useSearchParams();
  const router = useRouter();
  const journalId = params.get("jid");
  const displayEntryType: EntryType = "estimate"; // Hardcoded to estimate

  useEffect(() => {
    if (!journalId) {
      router.push("/");
      return;
    }
  }, [journalId, router]);

  useEffect(() => {
    if (journal) {
      setToolBar(
        <div className="flex flex-row justify-between items-center w-full">
          <div className="flex justify-start items-center gap-2 min-w-0 pr-2">
            {getJournalIcon(journal.journalType)}
            <p className="font-bold truncate" title={journal.title}>
              {journal.title}
            </p>
          </div>
          <div className="flex flex-row items-center space-x-2 flex-shrink-0">
            <DatePickerWithRange
              daterange={dateRange}
              setDate={setDateRange}
            />
            {journal.access &&
              authUser?.uid &&
              journal.access[authUser?.uid]?.role === "admin" && (
                <AddContributers
                  journalId={journal.id}
                  access={journal.access as any}
                  pendingAccess={
                    (journal.pendingAccess || {}) as pendingAccessSchemaType
                  }
                />
              )}
            {authUser?.uid && journal?.access?.[authUser.uid]?.role && (
              <Badge variant="secondary">
                {journal.access[authUser.uid].role}
              </Badge>
            )}
          </div>
        </div>
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
  }, [journal, authUser, journalId, dateRange, setToolBar]);

  const fetchFilterList = useCallback(async () => {
    if (!dateRange || !journalId) return;
    const entries = await fetchDateRangeEntries(
      journalId,
      displayEntryType,
      dateRange.from,
      dateRange.to
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

  if (!journalId) return null;
  if (journal === undefined)
    return <div className="text-center p-6">Loading Journal...</div>;
  if (journal === null) return <NotFound />;

  return (
    <div className="flex flex-col items-center justify-start w-full px-4 sm:px-6 lg:px-8">
      <div
        id="filter-badges"
        className="flex flex-row items-center justify-center space-x-2 my-4"
      >
        <FilterRangeBadge dateRange={dateRange} setdateRange={setDateRange} />
      </div>
      <div className="w-full">
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
                    "yyyyMMdd"
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
          />
        )}
      </div>
    </div>
  );
}