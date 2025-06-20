import React from "react";
import { Label } from "@/components/ui/label";
import { EntryView } from "../../comp/EntryView";
// --- Import backend schema/types ---
import {
  InvoiceDetails,
} from "@/../../backend/functions/src/common/schemas/invoice_schema";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
// --- Import frontend types ---
import { DBentry, User } from "@/lib/custom_types";
import { formatCurrency, formattedDate } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge"; // For status
import { ReceiptText } from "lucide-react"; // Icon for invoice

// --- Define Props Interface ---
interface InvoiceEntryProps {
  journalId: string;
  entry: DBentry; // Details should match InvoiceDetails
  entryType: EntryType; // Will be 'invoice'
  user: User; // Creator info
  role: string; // Viewer's role
  removeFn: (entry: DBentry) => void;
}

// --- Main Component ---
export const InvoiceEntry = React.memo(function InvoiceEntry({
  journalId,
  entry,
  entryType,
  user,
  role,
  removeFn,
}: InvoiceEntryProps) {
  // --- Basic validation ---
  if (
    !journalId ||
    !entry ||
    entryType !== "invoice" || // Ensure it's an invoice
    !entry.details
  ) {
    console.error("Invalid props for InvoiceEntry:", {
      journalId,
      entry,
      entryType,
    });
    return null;
  }

  const details = entry.details as InvoiceDetails;
  const {
    customer,
    invoiceNumber,
    dueDate,
    paymentStatus = "pending",
    totalAmount = 0,
    currency,
    notes,
    lineItems = [],
  } = details;

  // --- Determine Status Color for Invoice --- UPDATED
  const getPaymentStatusBadgeVariant = (
    status: InvoiceDetails["paymentStatus"],
  ): "default" | "secondary" | "destructive" | "outline" | "success" => { // Added "success"
    switch (status) {
      case "paid":
        return "success"; // Use success variant (usually green)
      case "pending":
        return "secondary";
      case "overdue":
        return "destructive";
      case "cancelled":
        return "outline";
      default:
        return "secondary";
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
        href={`/journal/entry?jid=${journalId}&eid=${entry.id}&jtype=invoice`} // Ensure jtype is passed for routing
        className="block hover:bg-accent/50 transition-colors rounded-md -m-2 p-2"
      >
        {/* Top Row: Customer Name, Grand Total, Status */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <ReceiptText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
            <Badge
              variant={getPaymentStatusBadgeVariant(paymentStatus)}
              className="text-xs"
            >
              {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
            </Badge>
            <span className="font-semibold text-base">
              {formatCurrency(totalAmount, currency || "USD")}
            </span>
          </div>
        </div>

        {/* Middle Row: Due Date */}
        <div className="text-xs text-muted-foreground mb-2">
          {dueDate && (
            <span>Due: {formattedDate(dueDate)}</span>
          )}
        </div>

        {/* Bottom Row: Summary of items/notes */}
        <div className="text-xs text-muted-foreground space-y-1">
          {lineItems.length > 0 && (
            <p className="truncate">
              {lineItems.length} item(s)
            </p>
          )}
          {notes && <p className="truncate italic">Notes: {notes}</p>}
        </div>

        {/* Creator and Date Info - ADDED */}
        <div className="text-xs text-muted-foreground mt-2 text-right">
          {user?.displayName || user?.email || "Unknown User"} | {formattedDate(entry.createdAt)}
        </div>
      </Link>
    </EntryView>
  );
});
