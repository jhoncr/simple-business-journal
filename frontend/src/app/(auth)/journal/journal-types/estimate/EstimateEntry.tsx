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
    payments = [], // Destructure payments, default to empty array
  } = details;

  const totalAmount = confirmedItems.reduce(
    // Assuming unitPrice is part of LineItem, if not, adjust access path
    (sum, item) => sum + item.quantity * (item.material?.unitPrice || 0),
    0,
  );

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  let calculatedPaymentStatus: string | null = null;
  let paymentBadgeVariant: "success" | "warning" | "destructive" | "default" = "default";

  if (invoiceNumber || ["Pending", "Overdue", "Paid"].includes(status)) { // Consider it an invoice if it has an invoice number or relevant status
    if (totalAmount > 0) {
      if (totalPaid >= totalAmount) {
        calculatedPaymentStatus = "Paid";
        paymentBadgeVariant = "success";
      } else if (totalPaid > 0 && totalPaid < totalAmount) {
        calculatedPaymentStatus = "Partially Paid";
        paymentBadgeVariant = "warning";
      } else { // totalPaid === 0 or totalPaid < 0 (though amount is positive)
        if (status === "Overdue"){
          calculatedPaymentStatus = "Overdue & Unpaid";
          paymentBadgeVariant = "destructive";
        } else if (status === "Pending") {
           calculatedPaymentStatus = "Unpaid";
           paymentBadgeVariant = "warning"; // Or destructive if preferred for any unpaid
        }
        // If status is 'Paid' but totalPaid < totalAmount, it's a discrepancy,
        // but we'll trust the main 'Paid' status for now, or this logic could override.
        // For simplicity, if main status is "Paid", let it be "Paid".
      }
    } else if (status === "Paid" && totalAmount === 0) { // Paid but zero amount invoice
        calculatedPaymentStatus = "Paid";
        paymentBadgeVariant = "success";
    }
  }


  // --- Determine Status Color for Badge ---
  const getStatusBadgeVariant = (
    currentStatus: EstimateDetails["status"],
  ): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (currentStatus) {
      case "Paid": // Match schema (capitalized)
        return "success";
      case "Pending": // Match schema
      case "Accepted": // Match schema
        return "secondary";
      case "Overdue": // Match schema
        return "destructive";
      case "Rejected": // Match schema
      case "Cancelled": // Match schema
        return "outline";
      case "Draft": // Match schema
      case "Estimate": // Match schema
      default:
        return "default";
    }
  };

  // Decide which status and variant to use
  const displayStatus = calculatedPaymentStatus || (status.charAt(0).toUpperCase() + status.slice(1));
  const displayBadgeVariant = calculatedPaymentStatus ? paymentBadgeVariant : getStatusBadgeVariant(status);


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
        {(dueDate || (status === "Overdue" && !calculatedPaymentStatus?.includes("Paid"))) && ( // Show if dueDate exists OR if Overdue and not Paid
          <div className="text-xs text-muted-foreground mt-1 mb-1">
            <span>
              Due: {dueDate ? formattedDate(new Date(dueDate)) : "N/A"}
            </span>
          </div>
        )}

        {/* Bottom Row: Summary of items/notes */}
        <div className="text-xs text-muted-foreground space-y-1">
          {confirmedItems.length > 0 && (
            <p className="truncate">
              {confirmedItems.length} item(s)
              {/* Optionally, show total paid vs total amount here if partially paid */}
              {calculatedPaymentStatus === "Partially Paid" && (
                <span className="ml-2">
                  ({formatCurrency(totalPaid, currency || "USD")} / {formatCurrency(totalAmount, currency || "USD")})
                </span>
              )}
            </p>
          )}
          {notes && <p className="truncate italic">Notes: {notes}</p>}
        </div>

        {/* Creator and Date Info */}
        <div className="text-xs text-muted-foreground mt-2 text-right">
          {entry.createdByName || user?.displayName || user?.email || "Unknown User"} |{" "}
          {formattedDate(entry.createdAt)}
        </div>
      </Link>
    </EntryView>
  );
});

// Helper type for badge variants if not already globally defined
// type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
