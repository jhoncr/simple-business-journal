import React from "react";
import { EntryView } from "../../comp/EntryView";
// --- Import backend schema/types ---
import { estimateDetailsState as EstimateDetails } from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
// --- Import frontend types ---
import { DBentry, User } from "@/lib/custom_types";
import { formatCurrency, formattedDate } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react"; // Icon for estimate

// --- Define Props Interface ---
interface EstimateEntryProps {
  journalId: string;
  entry: DBentry;
  entryType: EntryType;
  user: User;
  role: string;
  removeFn: (entry: DBentry) => void;
}

// --- Main Component ---
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
    invoiceNumber,
    dueDate,
    status = "draft",
    confirmedItems = [],
    currency,
    notes,
  } = details;

  const totalAmount = confirmedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  // --- Determine Status Color for Badge ---
  const getStatusBadgeVariant = (
    status: EstimateDetails["status"],
  ): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
      case "paid":
        return "success";
      case "pending":
      case "accepted":
        return "secondary";
      case "overdue":
        return "destructive";
      case "rejected":
      case "cancelled":
        return "outline";
      case "draft":
      default:
        return "default";
    }
  };

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
            {invoiceNumber && (
              <span className="text-xs text-muted-foreground">
                #{invoiceNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
            <span className="font-semibold text-base">
              {formatCurrency(totalAmount, currency || "USD")}
            </span>
          </div>
        </div>

        {/* Middle Row: Due Date */}
        {dueDate && (
          <div className="text-xs text-muted-foreground mb-2">
            <span>Due: {formattedDate(dueDate)}</span>
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
          {user?.displayName || user?.email || "Unknown User"} |{" "}
          {formattedDate(entry.createdAt)}
        </div>
      </Link>
    </EntryView>
  );
});
