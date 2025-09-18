import React from "react";
import { EntryView } from "../../comp/EntryView";
// --- Import backend schema/types ---
import { estimateDetailsState as EstimateDetails } from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
// --- Import frontend types ---
import { DBentry, AccessUser, WorkStatus } from "@/lib/custom_types";
import { formatCurrency, formattedDate } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react"; // Icon for estimate

// --- Define Props Interface ---
interface EstimateEntryProps {
  journalId: string;
  entry: DBentry;
  entryType: EntryType;
  user: AccessUser | null;
  role: string;
  removeFn: (entry: DBentry) => void;
}

// --- Main Component ---
const getStatusBadgeVariant = (
  currentStatus: WorkStatus,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (currentStatus) {
    case WorkStatus.DRAFT:
      return "default";
    case WorkStatus.IN_PROCESS:
      return "secondary";
    case WorkStatus.DELIVERED:
      return "secondary";
    default:
      return "default";
  }
};

export const EstimateEntry = React.memo(function EstimateEntry({
  journalId,
  entry,
  entryType,
  user,
  role,
  removeFn,
}: EstimateEntryProps) {
  // --- Basic validation ---
  if (!journalId || !entry || entryType !== "estimate" || !entry.details) {
    console.error("Invalid props for EstimateEntry:", {
      journalId,
      entry,
      entryType,
    });
    return null;
  }

  const details = entry.details as EstimateDetails;
  const {
    customer,
    dueDate,
    confirmedItems = [],
    currency,
    notes,
    payments = [], // Destructure payments, default to empty array
  } = details;

  const totalAmount = confirmedItems.reduce(
    // Assuming unitPrice is part of LineItem, if not, adjust access path
    (sum, item) => sum + item.quantity * (item.material?.unitPrice || 0),
    0,
  );

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  // Get status from top-level entry, not from details
  const currentStatus = entry.status || WorkStatus.DRAFT;
  const displayStatus =
    currentStatus.charAt(0).toUpperCase() +
    currentStatus.slice(1).toLowerCase().replace("_", " ");
  const displayBadgeVariant = getStatusBadgeVariant(currentStatus);

  const displayNumber =
    currentStatus === WorkStatus.DELIVERED ? entry.id : null;

  return (
    <EntryView
      journalId={journalId}
      entry={entry}
      entryType={entryType}
      user={user}
      role={role}
      removeFn={removeFn}
    >
      <Link
        href={`/journal/entry?jid=${journalId}&eid=${entry.id}&jtype=estimate`}
        className="block hover:bg-accent/50 transition-colors rounded-md -m-2 p-2"
      >
        {/* Top Row: Customer Name, Grand Total, Status */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span
              className="font-medium truncate"
              title={customer?.name || "No Customer"}
            >
              {customer?.name || "No Customer"}
            </span>
            {displayNumber && (
              <span className="text-xs text-muted-foreground">
                #{displayNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={displayBadgeVariant} className="text-xs">
              {displayStatus}
            </Badge>
            <span className="font-semibold text-base">
              {formatCurrency(totalAmount, currency || "USD")}
            </span>
          </div>
        </div>

        {/* Middle Row: Due Date */}
        {/* Due Date - ensure it's displayed if available */}
        {/* Middle Row: Due Date */}
        {/* Due Date - ensure it's displayed if available */}
        {dueDate && ( // Show if dueDate exists
          <div className="text-xs text-muted-foreground mt-1 mb-1">
            <span>
              Due: {dueDate ? formattedDate(new Date(dueDate)) : "N/A"}
            </span>
          </div>
        )}

        {/* Bottom Row: Summary of items/notes */}
        <div className="text-xs text-muted-foreground space-y-1">
          {confirmedItems.length > 0 && (
            <p className="truncate">{confirmedItems.length} item(s)</p>
          )}
          {notes && <p className="truncate italic">Notes: {notes}</p>}
        </div>

        {/* Creator and Date Info */}
        <div className="text-xs text-muted-foreground mt-2 text-right">
          {entry.createdBy ||
            user?.displayName ||
            user?.email ||
            "Unknown User"}{" "}
          | {formattedDate(entry.createdAt)}
        </div>
      </Link>
    </EntryView>
  );
});

// Helper type for badge variants if not already globally defined
// type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
