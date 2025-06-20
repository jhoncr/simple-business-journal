"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchDateRangeEntries, useWatchJournal } from "@/lib/db_handler";
// --- Remove specific Add forms if not needed directly ---
// import { AddLogEntryForm } from "./journal-types/cash-flow/add-cf-entry";
import { AddContributers } from "@/components/ui/add-contributors";
import { useToolbar } from "../nav_tool_handler";
import { ChatBox } from "./comp/chat";
import Link from "next/link";
import { DatePickerWithRange } from "./actions/date-pick-with-range";
import { format } from "date-fns";
import { X } from "lucide-react";
import ExportToCSV from "./actions/export-to-csv";
import { useSearchParams, useRouter } from "next/navigation"; // useRouter added
import { getAddEntryForm, getJournalIcon } from "./journal-types/config"; // Keep these utils
import { ROLES_THAT_ADD } from "@/../../backend/functions/src/common/const";
import { useAuth } from "@/lib/auth_handler";
// import { useJournalStore } from "@/lib/store/journalStore";
import { useJournalContext } from "@/context/JournalContext";
import { DBentry, Journal } from "@/lib/custom_types"; // Import Journal type
import {
  EntryType,
  ENTRY_CONFIG,
} from "@/../../backend/functions/src/common/schemas/configmap"; // Import EntryType
import { JOURNAL_TYPES } from "@/../../backend/functions/src/common/const";
import { BusinessDetailsType } from "@/../../backend/functions/src/common/schemas/JournalSchema";
import { pendingAccessSchemaType } from "@/../../backend/functions/src/common/schemas/common_schemas";
// --- Import Tabs components ---
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// --- Interfaces/Components (FilterRangeBadge, NotFound) remain the same ---
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

// --- Main Page ---
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
  const typeParam = params.get("type");
  // --- State for the currently selected tab/entryType ---
  const [displayEntryType, setDisplayEntryType] = useState<EntryType | null>(
    null,
  );
  // --- State to hold available entry types for the current journal ---
  const [availableEntryTypes, setAvailableEntryTypes] = useState<EntryType[]>(
    [],
  );

  // Function to update URL when tab changes
  const updateTabInURL = useCallback(
    (newType: EntryType) => {
      // Create new URLSearchParams object from current params
      const newParams = new URLSearchParams(params.toString());
      // Update the type parameter
      newParams.set("type", newType);
      // Replace the URL without causing navigation/reload
      const newURL = `${window.location.pathname}?${newParams.toString()}`;
      router.replace(newURL, { scroll: false });
    },
    [params, router],
  );

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      const newType = value as EntryType;
      setDisplayEntryType(newType);
      updateTabInURL(newType);
    },
    [updateTabInURL],
  );

  // Effect to fetch journal data
  useEffect(() => {
    if (!journalId) {
      router.push("/");
      return;
    }
    // Reset display type when ID changes
    setDisplayEntryType(null);
    setAvailableEntryTypes([]);
  }, [journalId, router]);

  // Effect to setup Toolbar, Action Button, Available Types, and Default Tab
  useEffect(() => {
    let defaultType: EntryType | null = null;
    let typesForJournal: EntryType[] = [];

    if (journal) {
      // Determine available entry types based on journal type
      if (journal.journalType === JOURNAL_TYPES.BUSINESS) {
        typesForJournal = Object.keys(ENTRY_CONFIG).filter(
          (key) =>
            ENTRY_CONFIG[key as keyof typeof ENTRY_CONFIG].category ===
            "business",
        ) as EntryType[];
        defaultType = "inventory"; // Default to inventory for business
      } else if (journal.journalType === JOURNAL_TYPES.BABY) {
        typesForJournal = Object.keys(ENTRY_CONFIG).filter(
          (key) =>
            ENTRY_CONFIG[key as keyof typeof ENTRY_CONFIG].category === "baby",
        ) as EntryType[];
        defaultType = "feed"; // Default to feed for baby
      }
      setAvailableEntryTypes(typesForJournal);

      // Check if the URL parameter for tab exists and is valid
      const validTypeParam =
        typeParam && typesForJournal.includes(typeParam as EntryType)
          ? (typeParam as EntryType)
          : null;

      // Set display type based on: URL parameter > default type
      if (!displayEntryType) {
        const newType = validTypeParam || defaultType;
        if (newType) {
          setDisplayEntryType(newType);
          // Update URL if no valid type param but we're setting a default
          if (!validTypeParam && newType) {
            updateTabInURL(newType);
          }
        }
      } else if (validTypeParam && displayEntryType !== validTypeParam) {
        // URL parameter changed, update the display type
        setDisplayEntryType(validTypeParam);
      } else if (!typesForJournal.includes(displayEntryType)) {
        // If current display type is not valid for this journal, reset to default
        const newType = defaultType;
        if (newType) {
          setDisplayEntryType(newType);
          updateTabInURL(newType);
        }
      }

      // --- Setup Toolbar ---
      setToolBar(
        <div className="flex flex-row justify-between items-center w-full">
          {/* Journal Title/Icon */}
          <div className="flex justify-start items-center gap-2 min-w-0 pr-2">
            {/* ... existing code ... */}
            {getJournalIcon(
              journal.journalType === JOURNAL_TYPES.BUSINESS
                ? "group"
                : journal.journalType,
            )}{" "}
            {/* Show group icon for business */}
            <p className="font-bold truncate" title={journal.title}>
              {journal.title}
            </p>
          </div>

          {/* Actions & Role Badge */}
          <div className="flex flex-row items-center space-x-2 flex-shrink-0">
            {/* Date Picker */}
            <DatePickerWithRange
              daterange={dateRange}
              setDate={setDateRange}
            />
            {/* Add Contributors Button (Admin only) */}
            {journal.access &&
              authUser?.uid &&
              journal.access[authUser?.uid]?.role === "admin" && (
                <AddContributers
                  journalId={journal.id} // Use currentJournal.id directly
                  access={journal.access}
                  pendingAccess={
                    (journal.pendingAccess || {}) as pendingAccessSchemaType
                  }
                />
              )}
            {/* Role Badge */}
            {authUser?.uid && journal?.access?.[authUser.uid]?.role && (
              <Badge variant="secondary">
                {journal.access[authUser.uid].role}
              </Badge>
            )}
          </div>
        </div>,
      );

      // --- Setup Action Button (based on *selected* displayEntryType) ---
      const AddEntryForm = displayEntryType
        ? getAddEntryForm(displayEntryType)
        : null;
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
      // Journal not loaded or not found
      setAvailableEntryTypes([]);
      setToolBar(null);
      setActionButton(null);
    }

    // Toolbar cleanup
    return () => {
      setToolBar(null);
    };
  }, [
    journal,
    authUser,
    journalId,
    dateRange,
    displayEntryType,
    setToolBar,
    typeParam,
    updateTabInURL,
  ]); // Add displayEntryType dependency

  // --- Fetch Filtered List based on Date Range and Selected Type ---
  const fetchFilterList = useCallback(async () => {
    // Ensure all required data is available
    if (!displayEntryType || !dateRange || !journalId) return;
    console.log(`Fetching filtered list for ${displayEntryType}`);
    const entries = await fetchDateRangeEntries(
      journalId,
      displayEntryType,
      dateRange.from,
      dateRange.to,
    );
    setFilterList(entries);
  }, [dateRange, journalId, displayEntryType]);

  // Re-fetch when dateRange or displayEntryType changes
  useEffect(() => {
    if (dateRange && displayEntryType) {
      fetchFilterList();
    } else {
      setFilterList([]); // Clear filter list if no range or type selected
    }
  }, [dateRange, displayEntryType, fetchFilterList]);

  // Callback to remove entry from filtered list
  const removeFilterEntry = useCallback((entry: DBentry) => {
    setFilterList((prevList) => prevList.filter((x) => x.id !== entry.id));
  }, []);

  // --- Render Logic ---
  if (!journalId) return null; // Should be handled by effect redirect
  if (journal === undefined)
    return <div className="text-center p-6">Loading Journal...</div>;
  if (journal === null) return <NotFound />;

  // Helper to get display name for tabs
  const getTabDisplayName = (type: EntryType): string => {
    const nameMap: Record<string, string> = {
      cashflow: "Cash Flow",
      inventory: "Inventory",
      estimate: "Estimates",
      invoice: "Invoices",
    };
    return nameMap[type] || type;
  };

  return (
    <div className="flex flex-col items-center justify-start w-full px-1">
      {/* --- Journal Info Card (Optional based on type) --- */}

      {/* --- Filter Badges --- */}
      <div
        id="filter-badges"
        className="flex flex-row items-center justify-center space-x-2 my-2"
      >
        <FilterRangeBadge dateRange={dateRange} setdateRange={setDateRange} />
      </div>

      {/* --- Tabs for Entry Types --- */}
      {availableEntryTypes.length > 0 && displayEntryType ? (
        <Tabs
          value={displayEntryType} // Controlled by state
          onValueChange={handleTabChange} // Use our new handler function here
          className="w-full max-w-2xl mx-auto" // Center tabs and content
        >
          <TabsList className="grid w-full grid-cols-3 mb-4">
            {" "}
            {/* Adjust grid-cols based on number of types */}
            {availableEntryTypes.map((type) => (
              <TabsTrigger key={type} value={type}>
                {getTabDisplayName(type)}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Render Content for each type, but only the active one is visible */}
          {availableEntryTypes.map((type) => (
            <TabsContent key={type} value={type} className="w-full m-0">
              {/* Render ChatBox only if this tab is active */}
              {displayEntryType === type && journal.access && journalId && (
                <ChatBox
                  journalId={journalId}
                  entryType={type} // Pass the specific type for this tab
                  access={journal.access}
                  actionButton={
                    dateRange ? (
                      <ExportToCSV
                        entry_list={filterList} // Filter list applies to active tab
                        filename={`${journal.title}-${getTabDisplayName(
                          type,
                        )}-${format(dateRange.from, "yyyyMMdd")}-${format(
                          dateRange.to,
                          "yyyyMMdd",
                        )}.csv`}
                        access={journal.access}
                      />
                    ) : (
                      actionButton // Action button is specific to the active tab type
                    )
                  }
                  filterList={filterList} // Pass filterList
                  hasFilter={!!dateRange}
                  removeFilterEntry={removeFilterEntry}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : // Handle case where journal type has no configured entry types or still loading
      !journal ? (
        <div className="text-center p-6">Loading...</div>
      ) : (
        <div className="text-center p-6 text-muted-foreground">
          No sections available for this journal type.
        </div>
      )}
    </div>
  );
}
