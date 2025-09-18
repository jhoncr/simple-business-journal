// frontend/src/app/(auth)/journal/journal-types/estimate/addEstimate.tsx
"use client";

import React from "react";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
} from "@/../../backend/functions/src/common/schemas/common_schemas";
import { EntryItf } from "@/../../backend/functions/src/common/common_types";
import { EstimateHeader } from "./subcomponents/header";
import Link from "next/link";
import { useEstimate } from "./useEstimate"; // Import the new hook
import { WorkStatusDropdown } from "./subcomponents/estimateStatus";
import { ContactInfo } from "./subcomponents/ContactInfo";
import { ItemsList } from "./subcomponents/ItemsList";
import { InvoiceDetails } from "./subcomponents/InvoiceDetails";
import { Payments } from "./subcomponents/Payments";
import { InvoiceBottomLines } from "./subcomponents/Adjustments";
import { InlineEditTextarea } from "./subcomponents/EditNotes";
import { NewItemForm } from "./subcomponents/NewItemForm";
import { Label } from "@/components/ui/label";

interface EstimateDetailsProps {
  journalId: string;
  entryId?: string | null;
  supplierInfo: contactInfoSchemaType;
  supplierLogo: string | null;
  journalCurrency: allowedCurrencySchemaType;
  journalInventoryCache: Record<string, EntryItf>;
  jtype: string;
}

export const EstimateDetails = React.memo(function EstimateDetails(
  props: EstimateDetailsProps,
) {
  const {
    confirmedItems,
    status,
    customer,
    canUpdate,
    adjustments,
    taxPercentage,
    notes,
    dueDate,
    payments,
    loading,
    isSaving,
    entryId,
    entryError,
    userRole,
    customerRef,
    isDelivered,
    setCustomer,
    setAdjustments,
    setTaxPercentage,
    setNotes,
    setDueDate,
    addConfirmedItem,
    removeConfirmedItem,
    handleStatusChange,
    handleSave,
    calculateSubtotal,
    currencyFormat,
    handleAddPayment,
  } = useEstimate(props);

  if (loading) {
    return <div className="text-center p-10">Loading estimate details...</div>;
  }
  if (entryError) {
    return <div className="text-center p-10 text-red-600">{entryError}</div>;
  }
  if (!props.journalCurrency || !props.supplierInfo) {
    return (
      <div className="text-center p-10 text-muted-foreground">
        Journal details (currency, supplier) not available.
      </div>
    );
  }

  return (
    <div
      id="estimate-printable-container"
      className="w-full print:max-w-none mx-auto border-none relative pb-20 md:pb-4 lg:pr-[430px]"
    >
      <EstimateHeader
        logo={props.supplierLogo}
        contactInfo={props.supplierInfo}
      />

      <div className="space-y-2 print:space-y-1 px-2 md:px-4 mt-2 print:px-0 print:mt-0">
        <div className="flex justify-end items-center space-x-2 print:hidden">
          <WorkStatusDropdown
            qstatus={status}
            setStatus={handleStatusChange}
          />
        </div>

        <InvoiceDetails
          entryId={entryId}
          dueDate={dueDate}
          setDueDate={setDueDate}
          handleSave={handleSave}
          isSaving={isSaving}
        />

        <div>
          <h3 className="text-lg font-semibold mt-4 mb-2">Customer</h3>
          <ContactInfo
            ref={customerRef}
            info={customer}
            setInfo={setCustomer}
            onSave={(newInfo) => handleSave({ customer: newInfo })}
          />
        </div>

        <fieldset
          disabled={!canUpdate}
          className={!canUpdate ? "opacity-50" : ""}
        >
          <h3 className="text-lg font-semibold pt-4 mb-2">Items</h3>
          <div className="border rounded-md p-2">
            <ItemsList
              confirmedItems={confirmedItems}
              removeConfirmedItem={removeConfirmedItem}
              currencyFormat={currencyFormat}
              isSaving={isSaving}
              canUpdate={canUpdate}
            />
            <div className="print:hidden">
              <NewItemForm
                onAddItem={addConfirmedItem}
                currency={props.journalCurrency}
                inventoryCache={props.journalInventoryCache}
                userRole={userRole}
              />
            </div>
            <InvoiceBottomLines
              itemSubtotal={calculateSubtotal()}
              adjustments={adjustments}
              setAdjustments={(newAdjustments) => {
                setAdjustments(newAdjustments);
                handleSave({ adjustments: newAdjustments });
              }}
              taxPercentage={taxPercentage}
              setTaxPercentage={(newTaxPercentage) => {
                setTaxPercentage(newTaxPercentage);
                handleSave({ taxPercentage: newTaxPercentage });
              }}
              currency={props.journalCurrency}
              userRole={userRole}
              payments={payments}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <InlineEditTextarea
              initialValue={notes}
              onSave={(value) => {
                setNotes(value);
                handleSave({ notes: value });
              }}
              placeholder="Add any additional notes..."
              disabled={isSaving}
            />
          </div>
        </fieldset>

        {(isDelivered || payments.length > 0) && (
          <Payments
            payments={payments}
            currencyFormat={currencyFormat}
            isInvoiceFlow={isDelivered}
            handleAddPayment={handleAddPayment}
            isSaving={isSaving}
          />
        )}
      </div>

      <div
        id="estimate-actions-bar"
        className="print:hidden flex justify-between items-center mt-6 px-2 md:px-4 sticky bottom-0 py-2 bg-background/90 backdrop-blur-sm border-t"
      >
        <Button variant="brutalist" asChild size="sm" disabled={isSaving}>
          <Link href={`/journal?jid=${props.journalId}&type=estimate`}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
        <div className="flex items-center space-x-2">
          <Button
            variant="brutalist"
            size="sm"
            onClick={() => window.print()}
            disabled={isSaving}
          >
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
});

export const AddNewEstimateBtn = ({ journalId }: { journalId: string }) => {
  return (
    <div>
      <Button variant="brutalist" className="mb-4" asChild>
        <Link href={`/journal/entry?jid=${journalId}&jtype=estimate`}>
          New Estimate
        </Link>
      </Button>
    </div>
  );
};
