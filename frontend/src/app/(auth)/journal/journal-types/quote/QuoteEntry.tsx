import React from "react";
import { Label } from "@/components/ui/label";
import { CardHeader, CardContent } from "@/components/ui/card"; // Card components might not be needed if EntryView handles the card structure
import {
  EntryView,
  EntryViewProps as BaseEntryViewProps,
} from "../../comp/EntryView"; // Use alias
// --- Import backend schema/types ---
import {
  Adjustment,
  LineItem,
  quoteDetailsState,
} from "@/../../backend/functions/src/common/schemas/quote_schema";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
// --- Import frontend types ---
import { DBentry, User } from "@/lib/custom_types";
import { formatCurrency, formattedDate } from "@/lib/utils"; // Import utils
// --- Remove if CURRENCY_OPTIONS not used directly ---
// import { CURRENCY_OPTIONS } from "@/../../backend/functions/src/common/const";
import Link from "next/link";
import { Badge } from "@/components/ui/badge"; // For status
import { FileText } from "lucide-react"; // Icon for quote

// --- Define Props Interface ---
interface QuoteEntryProps {
  journalId: string;
  entry: DBentry; // Details should match quoteDetailsState
  entryType: EntryType; // Will be 'quote'
  user: User; // Creator info
  role: string; // Viewer's role
  removeFn: (entry: DBentry) => void;
}

// Helper Interface for calculated totals
interface QuoteTotals {
  itemsTotal: number;
  adjustmentsTotal: number;
  taxAmount: number;
  grandTotal: number;
}

// Helper function to calculate totals (can be memoized if complex)
const calculateQuoteTotals = (
  details: quoteDetailsState | undefined,
): QuoteTotals => {
  if (!details)
    return { itemsTotal: 0, adjustmentsTotal: 0, taxAmount: 0, grandTotal: 0 };

  const { confirmedItems = [], adjustments = [], taxPercentage = 0 } = details;

  const itemsTotal = confirmedItems.reduce(
    (sum: number, item: Partial<LineItem>) => {
      const quantity = item.quantity || 0;
      // Safely access nested properties
      const unitPrice = item.material?.unitPrice || 0;
      return sum + quantity * unitPrice;
    },
    0,
  );

  const adjustmentsTotal = adjustments.reduce(
    (sum: number, adj: Adjustment): number => {
      const value = adj.value || 0;
      let adjustmentValue = 0;
      switch (adj.type) {
        case "addFixed":
          adjustmentValue = value;
          break;
        case "discountFixed":
          adjustmentValue = -value;
          break;
        case "addPercent":
          adjustmentValue = (itemsTotal * value) / 100;
          break;
        case "discountPercent":
          adjustmentValue = -(itemsTotal * value) / 100;
          break;
        // taxPercent is not an adjustment to sum here
        default:
          break;
      }
      return sum + adjustmentValue;
    },
    0,
  );

  const subtotalBeforeTax = itemsTotal + adjustmentsTotal;
  const taxAmount = (subtotalBeforeTax * taxPercentage) / 100;
  const grandTotal = subtotalBeforeTax + taxAmount;

  return { itemsTotal, adjustmentsTotal, taxAmount, grandTotal };
};

// --- Main Component ---
export const QuoteEntry = React.memo(function QuoteEntry({
  journalId,
  entry,
  entryType,
  user,
  role,
  removeFn,
}: QuoteEntryProps) {
  // --- Basic validation ---
  if (!journalId || !entry || entryType !== "quote" || !entry.details) {
    console.error("Invalid props for QuoteEntry:", {
      journalId,
      entry,
      entryType,
    });
    return null;
  }

  // --- Safely access details ---
  // Cast details, assuming it matches quoteDetailsState structure based on entryType
  const details = entry.details as quoteDetailsState;
  const {
    customer,
    confirmedItems = [],
    adjustments = [],
    status = "pending", // Default status
    taxPercentage = 0,
    currency, // Currency code (e.g., "USD") is stored in details
    notes,
  } = details;

  // --- Calculate Totals ---
  const { itemsTotal, adjustmentsTotal, taxAmount, grandTotal } =
    calculateQuoteTotals(details);

  // --- Determine Status Color ---
  const getStatusBadgeVariant = (
    status: quoteDetailsState["status"],
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "accepted":
        return "default"; // Greenish (using primary here, maybe customize later)
      case "rejected":
        return "destructive"; // Red
      case "pending":
      default:
        return "secondary"; // Yellowish/Grey
    }
  };

  return (
    // --- Pass props to EntryView ---
    <EntryView
      journalId={journalId}
      entry={entry}
      entryType={entryType}
      user={user}
      role={role}
      removeFn={removeFn}
    >
      {/* --- Quote Specific Summary --- */}
      {/* Link wraps the main content area */}
      <Link
        href={`/journal/entry?jid=${journalId}&eid=${entry.id}`} // Use journalId
        className="block hover:bg-accent/50 transition-colors rounded-md -m-2 p-2" // Make link cover area, adjust margins/padding
      >
        {/* Top Row: Customer Name, Grand Total, Status */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {" "}
            {/* Allow shrinking */}
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />{" "}
            {/* Icon */}
            <span
              className="font-medium truncate"
              title={customer?.name || "No Customer"}
            >
              {customer?.name || "No Customer"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge> */}
            <span className="font-semibold text-base">
              {formatCurrency(grandTotal, currency || "USD")}{" "}
              {/* Use currency code from details */}
            </span>
          </div>
        </div>

        {/* Middle Row: Contact Info (Optional) */}
        <div className="text-xs text-muted-foreground mb-2 space-x-3">
          {customer?.email && (
            <span className="truncate" title={customer.email}>
              {customer.email}
            </span>
          )}
          {customer?.phone && <span>{customer.phone}</span>}
        </div>

        {/* Bottom Row: Summary of items/adjustments/notes */}
        <div className="text-xs text-muted-foreground space-y-1">
          {confirmedItems.length > 0 && (
            <p className="truncate">
              {confirmedItems.length} item(s):{" "}
              {confirmedItems
                .slice(0, 2) // Show first 2 items max
                .map(
                  (item: Partial<LineItem>) =>
                    item.material?.description || item.description || "item",
                ) // Safer access
                .join(", ")}
              {confirmedItems.length > 2 ? "..." : ""}
            </p>
          )}
          {adjustments.length > 0 && (
            <p className="truncate">
              {adjustments.length} adjustment(s)
              {/* Maybe show first adjustment desc? */}
              {/* {adjustments[0].description && ` (${adjustments[0].description})`} */}
            </p>
          )}
          {notes && <p className="truncate italic">Notes: {notes}</p>}
        </div>

        {/* Creator and Date Info (Optional - can be moved/removed) */}
        {/* <div className="text-xs text-muted-foreground mt-1 text-right">
             {`${user?.displayName || 'User'} | ${formattedDate(entry.createdAt)}`}
         </div> */}
      </Link>
    </EntryView>
  );
});
