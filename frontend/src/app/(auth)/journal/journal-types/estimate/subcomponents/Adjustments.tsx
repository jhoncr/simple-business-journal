"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AdjustmentForm, Adjustment } from "./AdjustmentForm";
import { Button } from "@/components/ui/button";
import { MinusCircle } from "lucide-react";
import { allowedCurrencySchemaType } from "@/../../backend/functions/src/common/schemas/common_schemas";
import { ROLES_THAT_ADD } from "@/../../backend/functions/src/common/const"; // Import ROLES_THAT_ADD
import { ROLES } from "@/../../backend/functions/src/common/schemas/common_schemas"; // Import ROLES type
import { Payment } from "@/../../backend/functions/src/common/schemas/estimate_schema";

interface InvoiceBottomLinesProps {
  itemSubtotal: number;
  adjustments: Adjustment[];
  setAdjustments: (adjustments: Adjustment[]) => void;
  taxPercentage: number;
  setTaxPercentage: (percentage: number) => void;
  currency: allowedCurrencySchemaType;
  onSave?: (updates: any) => void; // Add this new prop
  userRole: (typeof ROLES)[number]; // Add userRole prop
  payments: Payment[];
}

const currencyFormat = (
  amount: number,
  currency: allowedCurrencySchemaType,
) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export function InvoiceBottomLines({
  itemSubtotal,
  adjustments,
  setAdjustments,
  taxPercentage,
  setTaxPercentage,
  currency,
  onSave, // Add this new prop
  userRole, // Use prop
  payments,
}: InvoiceBottomLinesProps) {
  // Check if user has permission to modify
  const canModify = React.useMemo(
    () => ROLES_THAT_ADD.has(userRole),
    [userRole],
  );

  const calculateAdjustmentAmount = React.useCallback(
    (adjustment: Adjustment): number => {
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
    },
    [itemSubtotal],
  );

  const totalAdjustments = React.useMemo(
    () =>
      adjustments.reduce(
        (sum, adjustment) =>
          sum + (calculateAdjustmentAmount(adjustment) || 0),
        0,
      ),
    [adjustments, calculateAdjustmentAmount],
  );

  const { totalBeforeTax, taxAmount, grandTotal } = React.useMemo(() => {
    const totalBeforeTax = (itemSubtotal || 0) + (totalAdjustments || 0);
    const taxAmount = ((totalBeforeTax || 0) * (taxPercentage || 0)) / 100;
    return {
      totalBeforeTax,
      taxAmount,
      grandTotal: totalBeforeTax + taxAmount,
    };
  }, [itemSubtotal, totalAdjustments, taxPercentage]);

  const totalPayments = React.useMemo(
    () => payments.reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [payments],
  );

  const balanceDue = React.useMemo(
    () => grandTotal - totalPayments,
    [grandTotal, totalPayments],
  );

  const handleAddAdjustment = (newAdjustment: Adjustment) => {
    setAdjustments([...adjustments, newAdjustment]);
    // Call onSave if provided
    if (onSave) {
      onSave({ adjustments: [...adjustments, newAdjustment] });
    }
  };
  const handleDeleteAdjustment = (index: number) => {
    const newAdjustments = adjustments.filter((_, i) => i !== index);
    setAdjustments(newAdjustments);
    // Call onSave if provided
    if (onSave) {
      onSave({ adjustments: newAdjustments });
    }
  };

  const handleTaxChange = (newTaxPercentage: number) => {
    setTaxPercentage(newTaxPercentage);
    // Call onSave if provided
    if (onSave) {
      onSave({ taxPercentage: newTaxPercentage });
    }
  };

  const formatDescription = (adjustment: Adjustment) => {
    if (!adjustments.length) return "";
    return (
      (adjustment.description ||
        `${adjustment.type.includes("add") ? "Addition" : "Discount"}`) +
      " " +
      (adjustment.type.includes("Percent")
        ? `( ${adjustment.value}% )`
        : currencyFormat(adjustment.value, currency))
    );
  };

  return (
    <div className="space-y-1 pt-2 border-t text-xs">
      <div className="md:max-w-[50%] print:max-w-[50%] md:ml-auto print:ml-auto space-y-1">
        <div className="flex justify-between items-center">
          <span>Subtotal</span>
          <span className="pr-8 print:pr-0">
            {currencyFormat(itemSubtotal, currency)}
          </span>
        </div>
        {adjustments.map((adjustment, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-2xs">{formatDescription(adjustment)}</span>
            <div
              className={cn(
                "font-medium flex items-center",
                calculateAdjustmentAmount(adjustment) >= 0
                  ? "text-green-600"
                  : "text-red-600",
              )}
            >
              {calculateAdjustmentAmount(adjustment) >= 0 ? "+" : "-"}
              {currencyFormat(
                Math.abs(calculateAdjustmentAmount(adjustment)),
                currency,
              )}
              <Button
                variant="ghost"
                key={`${index}-delete`}
                aria-label="Delete adjustment"
                data-testid={`delete-adjustment-${index}`}
                className="print:hidden h-6 w-6"
                size="icon"
                onClick={() => {
                  handleDeleteAdjustment(index);
                }}
                disabled={!canModify} // Disable delete button
                title={
                  !canModify
                    ? "You don't have permission to remove adjustments"
                    : ""
                } // Add tooltip
              >
                <MinusCircle className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
        {taxPercentage > 0 && (
          <>
            <div className="flex justify-between items-center pt-1 border-t">
              <span>Total before Tax</span>
              <div>
                <span className="pr-8 print:pr-0">
                  {currencyFormat(totalBeforeTax, currency)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>Tax ({taxPercentage}%)</span>
              <div className="flex items-center">
                <span>{currencyFormat(taxAmount, currency)}</span>
                <Button
                  variant="ghost"
                  key="delete-tax"
                  aria-label="Delete tax"
                  size="icon"
                  className="print:hidden ml-1 h-6 w-6"
                  onClick={() => {
                    handleTaxChange(0);
                  }}
                  disabled={!canModify} // Disable delete tax button
                  title={
                    !canModify ? "You don't have permission to remove tax" : ""
                  } // Add tooltip
                >
                  <MinusCircle className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </>
        )}
        <div className="flex justify-between pt-2 mt-1 items-center border-t-2 border-double">
          <span className="text-sm font-medium">Total</span>
          <h2 className="pr-8 print:pr-0 text-lg font-bold text-primary">
            {currencyFormat(grandTotal, currency)}
          </h2>
        </div>
        {payments.length > 0 && (
          <>
            <div className="flex justify-between items-center pt-1 border-t">
              <span className="font-medium text-muted-foreground">
                Payments Total
              </span>
              <div className="pr-8 print:pr-0 text-muted-foreground">
                - {currencyFormat(totalPayments, currency)}
              </div>
            </div>
            <div className="flex justify-between pt-1 mt-1 items-center border-t">
              <span className="text-sm font-medium">Balance Due</span>
              <h2 className="pr-8 print:pr-0 text-lg font-bold text-primary">
                {currencyFormat(balanceDue, currency)}
              </h2>
            </div>
          </>
        )}
      </div>
      <div className="print:hidden space-y-2 pt-2">
        <AdjustmentForm
          onSubmit={handleAddAdjustment}
          onTaxSubmit={handleTaxChange}
          currency={currency}
          taxPercentage={taxPercentage}
          userRole={userRole} // Pass userRole down
        />
      </div>
    </div>
  );
}
