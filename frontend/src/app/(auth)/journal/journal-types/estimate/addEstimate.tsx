// frontend/src/app/(auth)/journal/journal-types/estimate/addEstimate.tsx
"use client";

import React from "react";
import { ChevronLeft, MoreHorizontal, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
} from "@backend/common/schemas/common_schemas";
import { EntryItf } from "@backend/common/common_types";
import { EstimateHeader } from "./subcomponents/header";
import Link from "next/link";
import { useEstimate } from "./useEstimate"; // Import the new hook
import { ContactInfo } from "./subcomponents/ContactInfo";
import { ItemsList } from "./subcomponents/ItemsList";
import { InvoiceDetails } from "./subcomponents/InvoiceDetails";
import { Payments } from "./subcomponents/Payments";
import { InlineEditTextarea } from "./subcomponents/EditNotes";
import { NewItemFormWrapper } from "./subcomponents/NewItemFormWrapper";
import { InvoiceBottomLines } from "./subcomponents/Adjustments";
import { Label } from "@/components/ui/label";
import { WorkStatus } from "@backend/common/common_types";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const t = useTranslations("estimate");
  const {
    confirmedItems,
    status,
    customer,
    canUpdate,
    adjustments,
    taxPercentage,
    notes,
    createdAt,
    payments,
    grandTotal,
    loading,
    isSaving,
    entryId,
    entryError,
    userRole,
    customerRef,
    editingItem,
    setCustomer,
    setAdjustments,
    setTaxPercentage,
    setNotes,
    addConfirmedItem,
    removeConfirmedItem,
    editItem,
    cancelEdit,
    handleStatusChange,
    handleSave,
    calculateSubtotal,
    currencyFormat,
    handleAddPayment,
    handleUpdatePayment,
    handleDeletePayment,
    handleRestorePayment,
    handlePermanentDeletePayment,
  } = useEstimate(props);

  // Derived state: require contact info before unlocking the rest of the form
  const isContactInfoValid = Boolean(customer?.name?.trim());
  const isFormEnabled = canUpdate && isContactInfoValid;

  if (loading) {
    return <div className="text-center p-10">{t("loadingDetails")}</div>;
  }
  if (entryError) {
    return <div className="text-center p-10 text-red-600">{entryError}</div>;
  }
  if (!props.journalCurrency || !props.supplierInfo) {
    return (
      <div className="text-center p-10 text-muted-foreground">
        {t("journalDetailsNotAvailable")}
      </div>
    );
  }

  console.log("Rendering EstimateDetails with createdAt:", createdAt);

  return (
    <div
      id="estimate-printable-container"
      className="w-full print:max-w-none mx-auto border-none relative pb-20 md:pb-4 lg:pr-[430px] print:p-0 print:m-0 print:border-none"
    >
      <EstimateHeader
        logo={props.supplierLogo}
        contactInfo={props.supplierInfo}
      />

      <div className="space-y-4 px-2 md:px-4 mt-2">
        <InvoiceDetails
          entryId={entryId}
          createdDate={createdAt}
          status={status}
          handleStatusChange={canUpdate ? handleStatusChange : undefined}
        />

        <div className="mb-4">
          <ContactInfo
            title={t("client")}
            ref={customerRef}
            info={customer}
            setInfo={setCustomer}
            onSave={(newInfo) => handleSave({ customer: newInfo })}
          />
        </div>

        {canUpdate && (
          <>
            {!isContactInfoValid && (
              <div className="bg-secondary/50 text-secondary-foreground p-3 rounded-md text-sm text-center print:hidden border border-border">
                {t("unlockFormPrompt")}
              </div>
            )}

            <fieldset
              disabled={!isFormEnabled}
              className={!isFormEnabled ? "opacity-50 space-y-4 pointer-events-none select-none" : "space-y-4"}
            >
              <Card className="print:border-none print:shadow-none">
                <CardHeader className="p-4 pb-2 print:p-0">
                  <CardTitle className="text-base">{t("items")}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 print:p-0">
                  <ItemsList
                    confirmedItems={confirmedItems}
                    removeConfirmedItem={removeConfirmedItem}
                    editItem={editItem}
                    editingItem={editingItem}
                    currencyFormat={currencyFormat}
                    isSaving={isSaving}
                    canUpdate={canUpdate}
                  />
                  <div className="print:hidden mt-4">
                    <NewItemFormWrapper
                      onAddItem={addConfirmedItem}
                      currency={props.journalCurrency}
                      inventoryCache={props.journalInventoryCache}
                      userRole={userRole}
                      editingItem={editingItem}
                      onCancelEdit={cancelEdit}
                      confirmedItems={confirmedItems}
                    />
                  </div>
                  <div className="mt-4">
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
                </CardContent>
              </Card>

              <Card className="print:border-none print:shadow-none bg-secondary/5">
                <CardHeader className="p-4 pb-2 print:p-0">
                  <CardTitle className="text-base">{t("notes")}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 print:p-0">
                  <InlineEditTextarea
                    initialValue={notes}
                    onSave={(value) => {
                      setNotes(value);
                      handleSave({ notes: value });
                    }}
                    placeholder={t("addNotesPlaceholder")}
                    disabled={isSaving}
                  />
                </CardContent>
              </Card>
            </fieldset>
          </>
        )}

        {isFormEnabled &&
          (status == WorkStatus.IN_PROCESS ||
            status == WorkStatus.DELIVERED ||
            payments.length > 0) && (
            <Payments
              payments={payments}
              currencyFormat={currencyFormat}
              journalCurrency={props.journalCurrency}
              grandTotal={grandTotal}
              isInvoiceFlow={true}
              userRole={userRole}
              handleAddPayment={handleAddPayment}
              handleUpdatePayment={handleUpdatePayment}
              handleDeletePayment={handleDeletePayment}
              handleRestorePayment={handleRestorePayment}
              handlePermanentDeletePayment={handlePermanentDeletePayment}
              isSaving={isSaving}
            />
          )}
      </div>

      {(() => {
        const hasTechnicalDrawings = confirmedItems.some(
          (item) =>
            !!item.attachedTemplate ||
            item.itemCategory === "window-sill" ||
            item.itemCategory === "tile-edge",
        );
        const technicalDrawingsHref = `/journal/entry/technical-drawings?jid=${props.journalId}&eid=${entryId}`;

        return (
          <div
            id="estimate-actions-bar"
            className="print:hidden flex justify-between items-center mt-6 px-2 md:px-4 sticky bottom-0 py-2 bg-background/90 backdrop-blur-sm border-t"
          >
            <Button variant="brutalist" asChild size="sm" disabled={isSaving}>
              <Link href={`/journal?jid=${props.journalId}&jtype=estimate`}>
                <ChevronLeft className="h-4 w-4 mr-2" /> {t("back")}
              </Link>
            </Button>

            {/* Desktop: all buttons visible */}
            <div className="hidden sm:flex items-center space-x-2">
              {hasTechnicalDrawings && (
                <Button variant="outline" asChild size="sm" disabled={isSaving}>
                  <Link href={technicalDrawingsHref} target="_blank">
                    <Printer className="h-4 w-4 mr-2" />
                    {t("printTechnicalDrawings")}
                  </Link>
                </Button>
              )}
              <Button
                variant="brutalist"
                size="sm"
                onClick={() => window.print()}
                disabled={isSaving}
              >
                <Printer className="h-4 w-4 mr-2" /> {t("print")}
              </Button>
            </div>

            {/* Mobile: primary print + dropdown for secondary actions */}
            <div className="flex sm:hidden items-center gap-2">
              <Button
                variant="brutalist"
                size="sm"
                onClick={() => window.print()}
                disabled={isSaving}
              >
                <Printer className="h-4 w-4 mr-2" /> {t("print")}
              </Button>

              {hasTechnicalDrawings && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      aria-label={t("moreActions")}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link href={technicalDrawingsHref} target="_blank">
                        <Printer className="mr-2 h-4 w-4" />
                        <span>{t("printTechnicalDrawings")}</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
});

export const AddNewEstimateBtn = ({ journalId }: { journalId: string }) => {
  const t = useTranslations("estimate");
  return (
    <div>
      <Button variant="brutalist" className="mb-4" asChild>
        <Link href={`/journal/entry?jid=${journalId}&jtype=estimate`}>
          {t("newEstimate")}
        </Link>
      </Button>
    </div>
  );
};
