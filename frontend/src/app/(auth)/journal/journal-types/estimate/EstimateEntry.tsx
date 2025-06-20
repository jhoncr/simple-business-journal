import React from "react";
import { Label } from "@/components/ui/label";
// Card components might not be needed if EntryView handles the card structure
// import { CardHeader, CardContent } from "@/components/ui/card";
import {
  EntryView,
  // EntryViewProps as BaseEntryViewProps, // Not used directly
} from "../../comp/EntryView";
// --- Import backend schema/types ---
import {
  Adjustment,
  LineItem,
  estimateDetailsState,
} from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
// --- Import frontend types ---
import { DBentry, User } from "@/lib/custom_types";
import { formatCurrency, formattedDate } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge"; // For status
import { ClipboardList } from "lucide-react"; // Icon for estimate - UPDATED

// --- Define Props Interface ---
interface EstimateEntryProps {
  journalId: string;
  entry: DBentry; // Details should match estimateDetailsState
  entryType: EntryType; // Will be 'estimate'
  user: User; // Creator info
  role: string; // Viewer's role
  removeFn: (entry: DBentry) => void;
}

// Helper Interface for calculated totals
interface EstimateTotals {
  itemsTotal: number;
  adjustmentsTotal: number;
  taxAmount: number;
  grandTotal: number;
}

// Helper function to calculate totals (can be memoized if complex)
const calculateEstimateTotals = (
  details: estimateDetailsState | undefined,
): EstimateTotals => {
  if (!details)
    return { itemsTotal: 0, adjustmentsTotal: 0, taxAmount: 0, grandTotal: 0 };

  const { confirmedItems = [], adjustments = [], taxPercentage = 0 } = details;

  const itemsTotal = confirmedItems.reduce(
    (sum: number, item: Partial<LineItem>) => {
      const quantity = item.quantity || 0;
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
export const EstimateEntry = React.memo(function EstimateEntry({
  journalId,
  entry,
  entryType,
  user,
  role,
  removeFn,
}: EstimateEntryProps) {
  // --- Basic validation ---
  if (
    !journalId ||
    !entry ||
    entryType !== "estimate" || // UPDATED: Should only be 'estimate'
    !entry.details
  ) {
    console.error("Invalid props for EstimateEntry:", {
      journalId,
      entry,
      entryType,
    });
    return null;
  }

  const details = entry.details as estimateDetailsState;
  const {
    customer,
    confirmedItems = [],
    adjustments = [],
    status = "pending",
    currency,
    notes,
  } = details;

  const { grandTotal } = calculateEstimateTotals(details);

  // --- Determine Status Color --- UPDATED
  const getStatusBadgeVariant = (
    status: estimateDetailsState["status"],
  ): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
      case "accepted":
        return "success";
      case "rejected":
        return "destructive";
      case "invoiced":
        return "outline";
      case "pending":
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
        href={`/journal/entry?jid=${journalId}&eid=${entry.id}&jtype=estimate`} // Ensure jtype is passed for routing
        className="block hover:bg-accent/50 transition-colors rounded-md -m-2 p-2"
      >
        {/* Top Row: Customer Name, Grand Total, Status */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" /> {/* Icon UPDATED */}
            <span
              className="font-medium truncate"
              title={customer?.name || "No Customer"}
            >
              {customer?.name || "No Customer"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(status)} className="text-xs"> {/* BADGE UNCOMMENTED */}
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
            <span className="font-semibold text-base">
              {formatCurrency(grandTotal, currency || "USD")}
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
                .slice(0, 2)
                .map(
                  (item: Partial<LineItem>) =>
                    item.material?.description || item.description || "item",
                )
                .join(", ")}
              {confirmedItems.length > 2 ? "..." : ""}
            </p>
          )}
          {adjustments.length > 0 && (
            <p className="truncate">
              {adjustments.length} adjustment(s)
            </p>
          )}
          {notes && <p className="truncate italic">Notes: {notes}</p>}
        </div>

        {/* Creator and Date Info - ADDED/UNCOMMENTED */}
        <div className="text-xs text-muted-foreground mt-2 text-right">
          {user?.displayName || user?.email || "Unknown User"} | {formattedDate(entry.createdAt)}
        </div>
      </Link>
    </EntryView>
  );
});
