import React from "react";
import { EntryView } from "../../comp/EntryView";
// --- Import backend schema/types ---
import {
  estimateDetailsState as EstimateDetails,
  Adjustment,
} from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
// --- Import frontend types ---
import { DBentry, AccessUser } from "@/lib/custom_types";
import { WorkStatus } from "@/../../backend/functions/src/common/common_types";
import { formatCurrency, formattedDate } from "@/lib/utils";
import Link from "next/link";
import { WorkStatusBadge } from "./subcomponents/estimateStatus";
import { ClipboardList } from "lucide-react"; // Icon for estimate
import { useTranslations } from "next-intl";

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
export const EstimateEntry = React.memo(function EstimateEntry({
  journalId,
  entry,
  entryType,
  user,
  role,
  removeFn,
}: EstimateEntryProps) {
  const t = useTranslations("journal");

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
    status,
    payments = [], // Destructure payments, default to empty array
    adjustments = [], // Destructure adjustments, default to empty array
    taxPercentage = 0, // Destructure taxPercentage, default to 0
  } = details;

  // Calculate item subtotal
  const itemSubtotal = confirmedItems.reduce(
    (sum, item) => sum + item.quantity * (item.material?.unitPrice || 0),
    0,
  );

  // Calculate adjustment amount (following InvoiceBottomLines logic)
  const calculateAdjustmentAmount = (adjustment: Adjustment): number => {
    if (!adjustment || typeof adjustment.value !== "number") return 0;
    const value = adjustment.value;
    const calculations = {
      addFixed: () => value || 0,
      addPercent: () => ((itemSubtotal || 0) * value) / 100,
      discountFixed: () => -(value || 0),
      discountPercent: () => -((itemSubtotal || 0) * value) / 100,
      taxPercent: () => 0, // this is a tax percentage, not an adjustment
    };
    return calculations[adjustment.type]?.() ?? 0;
  };

  // Calculate total adjustments
  const totalAdjustments = adjustments.reduce(
    (sum, adjustment) => sum + (calculateAdjustmentAmount(adjustment) || 0),
    0,
  );

  // Calculate grand total (following InvoiceBottomLines logic)
  const totalBeforeTax = itemSubtotal + totalAdjustments;
  const taxAmount = (totalBeforeTax * taxPercentage) / 100;
  const grandTotal = totalBeforeTax + taxAmount;

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

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
              title={customer?.name || t("noCustomer")}
            >
              {customer?.name || t("noCustomer")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <WorkStatusBadge status={status} />
            <span className="font-semibold text-base">
              {formatCurrency(grandTotal, currency || "USD")}
            </span>
          </div>
        </div>

        {/* Bottom Row: Summary of items/notes */}
        <div className="text-xs text-muted-foreground space-y-1">
          {confirmedItems.length > 0 && (
            <p className="truncate">
              {t("itemCount", { count: confirmedItems.length })}
            </p>
          )}
          {notes && (
            <p className="truncate italic">
              {t("notesLabel")}: {notes}
            </p>
          )}
        </div>

        {/* Creator and Date Info */}
        <div className="text-xs text-muted-foreground mt-2 text-right">
          {entry.id} | {formattedDate(entry.createdAt)}
        </div>
      </Link>
    </EntryView>
  );
});
