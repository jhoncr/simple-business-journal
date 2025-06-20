// frontend/src/app/(auth)/journal/journal-types/estimate/addEstimate.tsx
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { ChevronLeft, Printer, MinusCircle, FileCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ContactInfo, ContactInfoRef } from "./subcomponents/ContactInfo";
import { NewItemForm } from "./subcomponents/NewItemForm";
import {
  LineItem,
  Adjustment,
  estimateDetailsState,
  estimateDetailsStateSchema,
} from "@/../../backend/functions/src/common/schemas/estimate_schema";
// Removed invoiceDetailsSchema as this component now only handles estimates
import { InvoiceBottomLines } from "./subcomponents/Adjustments";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
  ROLES,
} from "@/../../backend/functions/src/common/schemas/common_schemas";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/auth_handler";
import { fetchEntry } from "@/lib/db_handler";
import { formattedDate, formatCurrency } from "@/lib/utils";
import { EstimateHeader } from "./subcomponents/header";
import { InlineEditTextarea } from "./subcomponents/EditNotes";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { EntryItf } from "@/../../backend/functions/src/common/common_types";
import { useAuth } from "@/lib/auth_handler";
import { useJournalContext } from "@/context/JournalContext";

// --- Constants ---
const ADD_LOG_FN_NAME = "addLogFn";
const ESTIMATE_ENTRY_TYPE = "estimate";
// const INVOICE_ENTRY_TYPE = "invoice"; // No longer needed here

const initInfo: contactInfoSchemaType = {
  name: "",
  email: null,
  phone: null,
  address: {
    street: null,
    city: null,
    state: null,
    zipCode: null,
  },
};

const addLogFn = httpsCallable(functions, ADD_LOG_FN_NAME, {
  limitedUseAppCheckTokens: true,
});

interface EstimateDetailsProps {
  journalId: string;
  entryId?: string | null;
  supplierInfo: contactInfoSchemaType;
  supplierLogo: string | null;
  journalCurrency: allowedCurrencySchemaType;
  journalInventoryCache: Record<string, EntryItf>;
  jtype: string; // Should always be "estimate" when routed here
}

export const EstimateDetails = React.memo(function EstimateDetails({
  journalId,
  entryId: initialEntryId,
  supplierInfo,
  supplierLogo,
  journalCurrency,
  journalInventoryCache,
  jtype, // Expect "estimate"
}: EstimateDetailsProps) {
  const [confirmedItems, setConfirmedItems] = useState<LineItem[]>([]);
  const [status, setStatus] =
    useState<estimateDetailsState["status"]>("pending");
  const [isArchived, setIsArchived] = useState<boolean | undefined>(undefined);
  const [invoiceIdRef, setInvoiceIdRef] = useState<string | undefined>(
    undefined,
  );
  const [customer, setCustomer] = useState<contactInfoSchemaType>(initInfo);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [taxPercentage, setTaxPercentage] = useState(0);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [createdDate, setCreatedDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [entryId, setEntryId] = useState<string | null | undefined>(
    initialEntryId,
  );
  const [entryError, setEntryError] = useState<string | null>(null);

  const customerRef = useRef<ContactInfoRef>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { authUser } = useAuth();
  const { journal } = useJournalContext();

  const userRole: (typeof ROLES)[number] = useMemo(() => {
    if (!authUser || !journal || !journal.access) {
      return "viewer";
    }
    return journal.access[authUser.uid]?.role || "viewer";
  }, [authUser, journal]);

  useEffect(() => {
    setEntryId(initialEntryId);

    async function loadEntryData() {
      setLoading(true);
      setEntryError(null);

      if (jtype !== ESTIMATE_ENTRY_TYPE) {
        console.error(
          "EstimateDetails component received an invalid jtype:",
          jtype,
        );
        setEntryError(
          `This form is for estimates only. Received type: ${jtype}. Please check the URL or link.`,
        );
        setLoading(false);
        return;
      }

      if (!journalId) {
        setEntryError("Journal ID is missing.");
        setLoading(false);
        return;
      }

      if (initialEntryId) {
        try {
          // Simplified: fetch only ESTIMATE_ENTRY_TYPE
          const entry = await fetchEntry(
            journalId,
            ESTIMATE_ENTRY_TYPE,
            initialEntryId,
          );
          console.log("Fetched estimate entry:", entry);

          if (!entry) {
            setEntryError("Estimate entry not found or access denied.");
          } else if (entry.details) {
            const details = entry.details; // No need to cast yet

            // Simplified: validate only against estimateDetailsStateSchema
            const validation = estimateDetailsStateSchema.safeParse(details);

            if (!validation.success) {
              console.error(
                "Fetched estimate details failed validation:",
                validation.error.format(), // Use format() for better error details
              );
              setEntryError("Loaded estimate data is invalid.");
            } else {
              const validData = validation.data;
              setConfirmedItems(validData.confirmedItems || []);
              setStatus(validData.status || "pending");
              setCustomer(validData.customer || initInfo);
              setAdjustments(validData.adjustments || []);
              setTaxPercentage(validData.taxPercentage || 0);
              setNotes(validData.notes || "");
              setIsArchived(validData.is_archived);
              setInvoiceIdRef(validData.invoiceId_ref);
              if (entry.createdAt)
                setCreatedDate(formattedDate(entry.createdAt));
              else setCreatedDate(null);
            }
          }
        } catch (error) {
          console.error("Error loading estimate entry:", error);
          setEntryError("Failed to load estimate details. Please try again.");
        } finally {
          setLoading(false);
        }
      } else {
        setConfirmedItems([]);
        setStatus("pending");
        setCustomer(initInfo);
        setAdjustments([]);
        setTaxPercentage(0);
        setNotes("");
        setIsArchived(undefined);
        setInvoiceIdRef(undefined);
        setCreatedDate(formattedDate(new Date()));
        setLoading(false);
      }
    }

    loadEntryData();
  }, [journalId, initialEntryId, jtype]); // jtype added to dependency array

  const handleConvertToInvoice = async () => {
    if (!journalId || !entryId) {
      toast({
        title: "Error",
        description: "Journal ID or Estimate ID is missing. Cannot convert.",
        variant: "destructive",
      });
      return;
    }
    setIsConverting(true);
    try {
      const convertEstimateFn = httpsCallable(
        functions,
        "convertEstimateToInvoice",
      );
      const result = await convertEstimateFn({
        journalId: journalId,
        estimateId: entryId,
      });
      toast({
        title: "Success",
        description: `Estimate converted to Invoice ${
          (result.data as any)?.invoiceNumber || ""
        }.`,
      });
      setIsArchived(true);
      setInvoiceIdRef((result.data as any)?.invoiceId);
      setStatus("invoiced"); // Update status locally
    } catch (error: any) {
      console.error("Error converting estimate to invoice:", error);
      toast({
        title: "Conversion Failed",
        description: error.message || "Could not convert the estimate.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const addConfirmedItem = (items: LineItem[]) => {
    const newItems = [...confirmedItems, ...items];
    setConfirmedItems(newItems);
    handleSave({ confirmedItems: newItems });
  };

  const removeConfirmedItem = (id: string) => {
    const newItems = confirmedItems.filter(
      (item) => item.id !== id && item.parentId !== id,
    );
    setConfirmedItems(newItems);
    handleSave({ confirmedItems: newItems });
  };

  const calculateSubtotal = useCallback(() => {
    return confirmedItems.reduce(
      (sum, item) => sum + item.quantity * (item.material?.unitPrice || 0), // Added null check for material
      0,
    );
  }, [confirmedItems]);

  const currencyFormat = useCallback(
    (amount: number) => {
      return journalCurrency
        ? formatCurrency(amount, journalCurrency)
        : amount.toFixed(2);
    },
    [journalCurrency],
  );

  const handleSave = useCallback(
    async (updates: Partial<estimateDetailsState> = {}) => {
      if (jtype !== ESTIMATE_ENTRY_TYPE) {
        toast({
          title: "Save Error",
          description: "Cannot save, incorrect form type.",
          variant: "destructive",
        });
        return;
      }
      if (isSaving || !journalId || !journalCurrency) {
        if (!journalCurrency) {
          toast({
            title: "Missing Currency",
            description: "Cannot save estimate, journal currency is not set.",
            variant: "destructive",
          });
        }
        return;
      }
      setIsSaving(true);

      if (customerRef.current) {
        const isValid = await customerRef.current.validate();
        if (!isValid) {
          toast({
            title: "Invalid Customer Info",
            description: "Please correct customer details before saving.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      } else {
        toast({
          title: "Save Error",
          description: "Could not validate customer info.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      const estimateDetailsData: estimateDetailsState = {
        confirmedItems: updates.confirmedItems ?? confirmedItems,
        status: updates.status ?? status,
        customer: updates.customer ?? customer,
        supplier: supplierInfo || initInfo,
        logo: supplierLogo || null,
        adjustments: updates.adjustments ?? adjustments,
        taxPercentage: updates.taxPercentage ?? taxPercentage,
        currency: journalCurrency,
        notes: updates.notes ?? notes,
        is_archived: updates.is_archived ?? isArchived, // Include is_archived from updates or state
        invoiceId_ref: updates.invoiceId_ref ?? invoiceIdRef, // Include invoiceId_ref
      };

      const detailsValidation =
        estimateDetailsStateSchema.safeParse(estimateDetailsData);
      if (!detailsValidation.success) {
        console.error(
          "Estimate details validation failed before save:",
          detailsValidation.error.format(),
        );
        toast({
          title: "Invalid Estimate Data",
          description: "Could not save estimate. Check console.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      const validatedDetails = detailsValidation.data;

      const payload = {
        journalId: journalId,
        entryType: ESTIMATE_ENTRY_TYPE, // Ensures it only saves as estimate
        name: `Estimate for ${validatedDetails.customer.name || "Unknown"}`,
        details: validatedDetails,
        ...(entryId && { entryId }),
      };

      try {
        const result = await addLogFn(payload);
        const returnedId = (result.data as any)?.id;
        if (returnedId && !entryId) {
          setEntryId(returnedId);
          const url = new URL(window.location.href);
          url.searchParams.set("eid", returnedId);
          router.replace(url.toString(), { scroll: false });
        }
        toast({
          title: entryId ? "Estimate Updated" : "Estimate Saved",
          description: `Estimate for ${validatedDetails.customer.name} saved.`,
        });
      } catch (error: any) {
        console.error("Error saving estimate:", error);
        toast({
          title: "Save Failed",
          description: error.message || "Could not save estimate.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      jtype, // Added jtype to ensure it's checked on save
      isSaving,
      journalId,
      journalCurrency,
      confirmedItems,
      status,
      customer,
      supplierInfo,
      supplierLogo,
      adjustments,
      taxPercentage,
      notes,
      entryId,
      isArchived,
      invoiceIdRef,
      toast,
      router,
    ],
  );

  if (loading) {
    return <div className="text-center p-10">Loading estimate details...</div>;
  }
  if (entryError) {
    return <div className="text-center p-10 text-red-600">{entryError}</div>;
  }
  if (!journalCurrency || !supplierInfo) {
    return (
      <div className="text-center p-10 text-muted-foreground">
        Journal details (currency, supplier) not available.
      </div>
    );
  }
  // --- JSX Structure ---
  return (
    <div
      id="estimate-printable-container"
      className="w-full print:max-w-none mx-auto p-2 border-none relative pb-20 md:pb-4 lg:pr-[430px]"
    >
      <EstimateHeader logo={supplierLogo} contactInfo={supplierInfo} />
      <div className="space-y-4 px-2 md:px-4">
        <div>
          <h3 className="text-lg font-semibold mt-4 mb-2">Customer</h3>
          <ContactInfo
            ref={customerRef}
            info={customer}
            setInfo={(newInfo) => {
              setCustomer(newInfo);
            }}
            onSave={() => handleSave({ customer })}
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold pt-4 mb-2">Items</h3>
          <div className="border rounded-md p-2">
            <div className="space-y-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-2 px-1 font-medium w-20">
                      Qty
                    </th>
                    <th className="text-left py-2 px-1 font-medium">
                      Description
                    </th>
                    <th className="text-right py-2 px-2 font-medium w-24">
                      Price
                    </th>
                    <th className="text-right py-2 px-1 font-medium w-24">
                      Total
                    </th>
                    <th className="w-8 print-hide"></th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-dashed last:border-0 ${
                        item.parentId === "root" ? "bg-secondary/30" : ""
                      }`}
                    >
                      <td className="py-2 px-1 text-left align-top">
                        <div className="flex flex-col items-center w-min">
                          {item.quantity}
                          <div className="text-xs text-muted-foreground">
                            {item.material?.dimensions?.unitLabel || ""}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-1 align-top">
                        {item.description && (
                          <div className="text-sm">{item.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground flex flex-row items-center gap-1">
                          {item.material?.description || "N/A"}
                          {item.material?.dimensions?.type === "area" &&
                            item.dimensions && (
                              <div className="">
                                : {item.dimensions.length} ×{" "}
                                {item.dimensions.width}{" "}
                                {item.material.dimensions.unitLabel}
                              </div>
                            )}
                        </div>
                      </td>
                      <td className="py-2 px-1 align-top">
                        <div className="text-right pr-2">
                          {currencyFormat(item.material?.unitPrice || 0)}
                          <div className="text-xs text-muted-foreground">
                            {`/${
                              item.material?.dimensions?.unitLabel || "unit"
                            }`}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-1 text-right align-top">
                        {currencyFormat(
                          item.quantity * (item.material?.unitPrice || 0),
                        )}
                      </td>
                      <td className="py-2 px-1 print-hide align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeConfirmedItem(item.id)}
                          disabled={isSaving}
                          className="h-8 w-8"
                        >
                          <MinusCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {confirmedItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-4 text-sm text-muted-foreground"
                      >
                        Add items using the form below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <NewItemForm
              onAddItem={addConfirmedItem}
              currency={journalCurrency}
              inventoryCache={journalInventoryCache}
              userRole={userRole}
            />
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
              currency={journalCurrency}
              userRole={userRole}
            />
          </div>
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
      </div>
      <div
        id="estimate-actions-bar"
        className="print-hide flex justify-between items-center mt-6 px-2 md:px-4 sticky bottom-0 py-2 bg-background/90 backdrop-blur-sm border-t"
      >
        <Button
          variant="brutalist"
          asChild
          size="sm"
          disabled={isSaving || isConverting}
        >
          <Link href={`/journal?jid=${journalId}&type=estimate`}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
        <div className="flex items-center space-x-2">
          {entryId && status === "pending" && !isArchived && !invoiceIdRef && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleSave({ status: "rejected" })}
                disabled={isSaving || isConverting}
              >
                <MinusCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => handleSave({ status: "accepted" })}
                disabled={isSaving || isConverting}
              >
                <FileCog className="h-4 w-4 mr-2" /> Accept
              </Button>
            </>
          )}
          {entryId &&
            status === "accepted" &&
            !isArchived &&
            !invoiceIdRef && (
              <Button
                variant="default"
                size="sm"
                onClick={handleConvertToInvoice}
                disabled={isConverting || isSaving}
              >
                <FileCog className="h-4 w-4 mr-2" />
                {isConverting ? "Converting..." : "Convert to Invoice"}
              </Button>
            )}
          <Button
            variant="brutalist"
            size="sm"
            onClick={() => window.print()}
            disabled={isSaving || isConverting}
          >
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          /* ... same print styles ... */
        }
      `}</style>
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
