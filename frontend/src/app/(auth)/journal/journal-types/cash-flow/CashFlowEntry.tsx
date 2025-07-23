// frontend/src/app/(auth)/journal/journal-types/cash-flow/CashFlowEntry.tsx
import React, { memo } from "react";
import { DBentry, AccessUser as User } from "../../../../../lib/custom_types"; // Adjusted path
import { formattedDate, formatCurrency } from "@/lib/utils"; // Adjusted path
import {
  EntryView,
  // EntryViewProps as BaseEntryViewProps, // Alias not strictly needed anymore
} from "../../comp/EntryView";
import { Label } from "@/components/ui/label";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
// --- Store import removed ---
// import { useJournalStore } from "@/lib/store/journalStore";
import { MoveUpRight, MoveDownRight } from "lucide-react";

// --- Updated Props Interface ---
interface CashFlowEntryProps {
  journalId: string;
  entry: DBentry;
  entryType: EntryType; // Expect 'cashflow'
  user: User; // Creator
  role: string; // Viewer's role
  removeFn: (entry: DBentry) => void;
  // activeCurrency: string; // Accept currency as prop
}

// --- Main Component ---
export const CashFlowEntry = memo(function CashFlowEntry({
  journalId,
  entry,
  entryType,
  user,
  role,
  removeFn,
}: // activeCurrency, // Use prop
CashFlowEntryProps) {
  // --- Get currency from prop ---
  // const getActiveCurrency = useJournalStore(...); // Removed
  // const activeCurrency = getActiveCurrency(); // Removed

  // Basic validation
  if (
    !journalId ||
    !entry ||
    entryType !== "cashflow" ||
    !entry.details ||
    // !activeCurrency // Ensure currency is provided
    !entry.details.currency
  ) {
    console.error("Invalid props for CashFlowEntry:", {
      journalId,
      entry,
      entryType,
      // activeCurrency,
    });
    return (
      <div className="text-xs text-destructive pl-4">
        Error displaying entry. Missing data.
      </div>
    );
  }

  const { description, date, type, value } = entry.details;
  const isPaid = type === "paid";
  const amountColor = isPaid ? "text-destructive" : "text-green-600";
  const TypeIcon = isPaid ? MoveDownRight : MoveUpRight;

  return (
    <EntryView
      journalId={journalId}
      entry={entry}
      entryType={entryType}
      user={user}
      removeFn={removeFn}
      role={role}
      // journalId prop removed if EntryView standardized
    >
      {/* --- Specific Cash Flow Details --- */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-base flex-1 mr-2 truncate" title={description}>
          {description || "No description"}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-lg font-semibold ${amountColor}`}>
            {/* Format currency using prop */}
            {formatCurrency(value || 0, entry.details.currency)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
        <span>
          {`${user?.displayName || user?.email || "User"} | ${formattedDate(
            date || entry.createdAt,
          )}`}
        </span>
        <span className="flex items-center gap-1">
          <TypeIcon
            className={`h-3 w-3 ${
              isPaid ? "text-destructive/80" : "text-green-600/80"
            }`}
          />
          {type?.charAt(0).toUpperCase() + type?.slice(1) || "N/A"}
        </span>
      </div>
    </EntryView>
  );
});
