// frontend/src/app/(auth)/journal/journal-types/estimate/addEstimate.tsx
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
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
import { InvoiceBottomLines } from "./subcomponents/Adjustments";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
  // EntryType,
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
import { EntryItf } from "@/../../backend/functions/src/common/common_types"; // Import EntryItf for inventory cache type
import { useAuth } from "@/lib/auth_handler"; // Import useAuth
import { useJournalContext } from "@/context/JournalContext"; // Import useJournalContext

// --- Constants ---
const ADD_LOG_FN_NAME = "addLogFn";
const ESTIMATE_ENTRY_TYPE = "estimate";

// Initial Contact Info remains the same
const initInfo: contactInfoSchemaType = {
  name: "",
  email: null, // Allow null
  phone: null, // Allow null
  address: {
    street: null, // Allow null
    city: null, // Allow null
    state: null, // Allow null
    zipCode: null, // Allow null
  },
};

// Backend function call remains the same name
const addLogFn = httpsCallable(functions, ADD_LOG_FN_NAME, {
  limitedUseAppCheckTokens: true,
});

// --- Updated Props Interface ---
interface EstimateDetailsProps {
  journalId: string; // Standardized name
  entryId?: string | null; // Optional for new estimates
  // Props passed down from parent (using JournalContext)
  supplierInfo: contactInfoSchemaType;
  supplierLogo: string | null;
  journalCurrency: allowedCurrencySchemaType;
  journalInventoryCache: Record<string, EntryItf>; // Receive inventory cache
}

// --- Main Component ---
// Use forwardRef if necessary, otherwise a standard functional component is fine
export const EstimateDetails = React.memo(function EstimateDetails({
  journalId,
  entryId: initialEntryId, // Rename prop to avoid conflict with state
  supplierInfo,
  supplierLogo,
  journalCurrency,
  journalInventoryCache,
}: EstimateDetailsProps) {
  // --- State Variables ---
  const [confirmedItems, setConfirmedItems] = useState<LineItem[]>([]);
  const [status, setStatus] =
    useState<estimateDetailsState["status"]>("pending");
  const [isArchived, setIsArchived] = useState<boolean | undefined>(undefined);
  const [invoiceIdRef, setInvoiceIdRef] = useState<string | undefined>(undefined);
  const [customer, setCustomer] = useState<contactInfoSchemaType>(initInfo);
  // supplier, logo, currency state removed -> use props
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [taxPercentage, setTaxPercentage] = useState(0);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(true); // Still need loading state for fetching *entry*
  const [createdDate, setCreatedDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [entryId, setEntryId] = useState<string | null | undefined>(
    initialEntryId,
  );
  const [entryError, setEntryError] = useState<string | null>(null);

  // --- Refs and Hooks ---
  const customerRef = useRef<ContactInfoRef>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { authUser } = useAuth(); // Get authenticated user
  const { journal } = useJournalContext(); // Get journal context

  // Determine user role
  const userRole: (typeof ROLES)[number] = useMemo(() => {
    if (!authUser || !journal || !journal.access) {
      return "viewer"; // Default to viewer if no user or journal access info
    }
    return journal.access[authUser.uid]?.role || "viewer"; // Get role or default to viewer
  }, [authUser, journal]);

  // --- Fetch existing entry data (if entryId exists) ---
  useEffect(() => {
    setEntryId(initialEntryId); // Sync prop with state initially

    async function loadEntryData() {
      // No need to fetch the *journal* here, assume parent did via context
      setLoading(true);
      setEntryError(null);

      if (!journalId) {
        setEntryError("Journal ID is missing.");
        setLoading(false);
        return;
      }

      // Only fetch if we have an ID to edit
      if (initialEntryId) {
        try {
          const entry = await fetchEntry(
            journalId,
            ESTIMATE_ENTRY_TYPE,
            initialEntryId,
          );
          console.log("Fetched entry:", entry);

          if (!entry) {
            setEntryError("Estimate entry not found or access denied.");
          } else if (entry.details) {
            const details = entry.details as estimateDetailsState;
            const validation = estimateDetailsStateSchema.safeParse(details);
            if (!validation.success) {
              console.error(
                "Fetched estimate details failed validation:",
                validation.error,
              );
              setEntryError("Loaded estimate data is invalid.");
            } else {
              // Set state based on fetched entry data
              setConfirmedItems(validation.data.confirmedItems || []);
              setStatus(validation.data.status || "pending");
              setCustomer(validation.data.customer || initInfo);
              setAdjustments(validation.data.adjustments || []);
              setTaxPercentage(validation.data.taxPercentage || 0);
              setNotes(validation.data.notes || "");
              setIsArchived(validation.data.is_archived);
              setInvoiceIdRef(validation.data.invoiceId_ref);
              setCreatedDate(formattedDate(entry.createdAt));
            }
          }
        } catch (error) {
          console.error("Error loading estimate entry:", error);
          setEntryError("Failed to load estimate details. Please try again.");
        } finally {
          setLoading(false);
        }
      } else {
        // New estimate: Reset fields (supplier/logo/currency come from props)
        setConfirmedItems([]);
        setStatus("pending");
        setCustomer(initInfo);
        setAdjustments([]);
        setTaxPercentage(0);
        setNotes("");
        setIsArchived(undefined);
        setInvoiceIdRef(undefined);
        setCreatedDate(formattedDate(new Date())); // Set to now
        setLoading(false); // Finished "loading" (no entry to fetch)
      }
    }

    loadEntryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalId, initialEntryId]); // Rerun if journalId or initialEntryId changes

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
      const convertEstimateFn = httpsCallable(functions, "convertEstimateToInvoice");
      const result = await convertEstimateFn({
        journalId: journalId,
        estimateId: entryId,
      });

      toast({
        title: "Success",
        description: `Estimate converted to Invoice ${(result.data as any)?.invoiceNumber || ''}.`,
      });

      setIsArchived(true);
      setInvoiceIdRef((result.data as any)?.invoiceId);
      setStatus("invoiced");

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

  // --- Event Handlers ---
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
      (sum, item) => sum + item.quantity * item.material.unitPrice,
      0,
    );
  }, [confirmedItems]);

  // Use journalCurrency prop
  const currencyFormat = useCallback(
    (amount: number) => {
      return journalCurrency
        ? formatCurrency(amount, journalCurrency)
        : amount.toFixed(2);
    },
    [journalCurrency],
  );

  // --- Updated handleSave ---
  const handleSave = useCallback(
    async (updates: Partial<estimateDetailsState> = {}) => {
      if (isSaving || !journalId || !journalCurrency) {
        console.warn(
          "Save aborted. Already saving or missing Journal ID/Currency.",
        );
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

      // Validate Customer Info
      if (customerRef.current) {
        const isValid = await customerRef.current.validate();
        if (!isValid) {
          console.warn("Customer contact info is invalid. Aborting save.");
          toast({
            title: "Invalid Customer Info",
            description: "Please correct customer details before saving.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      } else {
        // Handle ref not ready (should be rare)
        toast({
          title: "Save Error",
          description: "Could not validate customer info.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      // Construct Details Payload using props and state
      const estimateDetailsData: estimateDetailsState = {
        confirmedItems: updates.confirmedItems ?? confirmedItems,
        status: updates.status ?? status,
        customer: updates.customer ?? customer,
        supplier: supplierInfo || initInfo, // Use prop
        logo: supplierLogo || null, // Use prop
        adjustments: updates.adjustments ?? adjustments,
        taxPercentage: updates.taxPercentage ?? taxPercentage,
        currency: journalCurrency, // Use prop
        notes: updates.notes ?? notes,
        // Ensure is_archived and invoiceId_ref are included if they exist in state
        // This is important if handleSave is called for status changes on an already converted/archived estimate (though UI should prevent this)
        is_archived: isArchived,
        invoiceId_ref: invoiceIdRef,
      };

      // Validate final details object
      const detailsValidation =
        estimateDetailsStateSchema.safeParse(estimateDetailsData);
      if (!detailsValidation.success) {
        console.error(
          "Estimate details validation failed before save:",
          detailsValidation.error.format(),
        );
        toast({
          title: "Invalid Estimate Data",
          description:
            "Could not save estimate due to invalid data. Check console for details.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      const validatedDetails = detailsValidation.data;

      // Construct Backend Payload
      const payload = {
        journalId: journalId, // Use prop
        entryType: ESTIMATE_ENTRY_TYPE,
        name: `Estimate for ${validatedDetails.customer.name || "Unknown"}`,
        details: validatedDetails,
        ...(entryId && { entryId }), // Include entryId if editing
      };

      console.log("Saving estimate with payload:", payload);

      // Call Backend Function
      try {
        const result = await addLogFn(payload);
        console.log("Estimate save successful:", result.data);

        const returnedId = (result.data as any)?.id;
        if (returnedId && !entryId) {
          setEntryId(returnedId);
          const url = new URL(window.location.href);
          url.searchParams.set("eid", returnedId);
          router.replace(url.toString(), { scroll: false });
          console.log("Set new entryId:", returnedId);
        }

        toast({
          title: entryId ? "Estimate Updated" : "Estimate Saved",
          description: `Estimate for ${validatedDetails.customer.name} saved successfully.`,
        });
      } catch (error: any) {
        console.error("Error saving estimate:", error);
        toast({
          title: "Save Failed",
          description: error.message || "Could not save the estimate.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      isSaving,
      journalId,
      journalCurrency, // Use prop
      confirmedItems,
      status,
      customer,
      supplierInfo, // Use prop
      supplierLogo, // Use prop
      adjustments,
      taxPercentage,
      notes,
      entryId,
      isArchived, // Added to dependency array
      invoiceIdRef, // Added to dependency array
      toast,
      router,
    ],
  );

  // --- Render Logic ---
  if (loading) {
    // Loading state while fetching entry
    return <div className="text-center p-10">Loading estimate details...</div>;
  }
  if (entryError) {
    // Display error if fetching entry failed
    return <div className="text-center p-10 text-red-600">{entryError}</div>;
  }
  // Ensure necessary props are available (parent should handle this loading)
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
      className="w-full print:max-w-none mx-auto p-2 border-none relative pb-20 md:pb-4 lg:pr-[430px]" // Add right padding on large screens
    >
      {/* --- Header (Passes props) --- */}
      <EstimateHeader logo={supplierLogo} contactInfo={supplierInfo} />

      {/* --- Content --- */}
      <div className="space-y-4 px-2 md:px-4">
        {/* Customer Info */}
        <div>
          <h3 className="text-lg font-semibold mt-4 mb-2">Customer</h3>
          <ContactInfo
            ref={customerRef}
            info={customer}
            setInfo={(newInfo) => {
              setCustomer(newInfo);
              // Consider debouncing or saving on blur/button click
              // handleSave({ customer: newInfo }); // Auto-save on change (can be noisy)
            }}
            onSave={() => handleSave({ customer })} // Pass specific update on explicit save
          />
        </div>
        {/* Items Section */}
        <div>
          <h3 className="text-lg font-semibold pt-4 mb-2">Items</h3>
          <div className="border rounded-md p-2">
            {/* Items Table */}
            <div className="space-y-2">
              <table className="w-full text-sm">
                {/* ... Table Head ... */}
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
                        item.parentId == "root" ? "bg-secondary/30" : "" // Adjusted bg
                      }`}
                    >
                      {/* Quantity Cell */}
                      <td className="py-2 px-1 text-left align-top">
                        <div className="flex flex-col items-center w-min">
                          {item.quantity}
                          <div className="text-xs text-muted-foreground">
                            {`${item.material.dimensions.unitLabel}`}
                          </div>
                        </div>
                      </td>
                      {/* Description Cell */}
                      <td className="py-2 px-1 align-top">
                        {item.description && (
                          <div className="text-sm">{item.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground flex flex-row items-center gap-1">
                          {item.material.description}
                          {":"}
                          {item.material.dimensions.type === "area" &&
                            item.dimensions && (
                              <div className="">
                                {item.dimensions.length} ×{" "}
                                {item.dimensions.width}{" "}
                                {item.material.dimensions.unitLabel}
                              </div>
                            )}
                        </div>
                      </td>
                      {/* Price Cell */}
                      <td className="py-2 px-1 align-top">
                        <div className="text-right pr-2">
                          {currencyFormat(item.material.unitPrice)}
                          <div className="text-xs text-muted-foreground">
                            {`/${item.material.dimensions.unitLabel}`}
                          </div>
                        </div>
                      </td>
                      {/* Total Cell */}
                      <td className="py-2 px-1 text-right align-top">
                        {currencyFormat(
                          item.quantity * item.material.unitPrice,
                        )}
                      </td>
                      {/* Remove Button Cell */}
                      <td className="py-2 px-1 print-hide align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeConfirmedItem(item.id)}
                          disabled={isSaving}
                          className="h-8 w-8" // Ensure consistent button size
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

            {/* --- Add New Item Form (Passes props) --- */}
            <NewItemForm
              onAddItem={addConfirmedItem}
              currency={journalCurrency}
              // Pass inventory cache down
              inventoryCache={journalInventoryCache}
              userRole={userRole} // Pass userRole
            />

            {/* Totals and Adjustments (Passes props) */}
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
              userRole={userRole} // Pass userRole
            />
          </div>
        </div>
        {/* Notes */}
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

      {/* Actions Bar */}
      <div
        id="estimate-actions-bar"
        className="print-hide flex justify-between items-center mt-6 px-2 md:px-4 sticky bottom-0 py-2 bg-background/90 backdrop-blur-sm border-t"
      >
        <Button variant="brutalist" asChild size="sm" disabled={isSaving || isConverting}>
          <Link href={`/journal?jid=${journalId}`}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>

        <div className="flex items-center space-x-2">
          {/* Save/Update Buttons (Placeholder, actual logic in parent or context) */}
          {/* This button is illustrative; real save logic is via handleSave on field changes */}
          {/* {status !== "accepted" && status !== "rejected" && status !== "invoiced" && (
             <Button
                variant="default"
                size="sm"
                onClick={() => handleSave()} // Generic save, might be better tied to specific actions
                disabled={isSaving || isConverting}
              >
              {isSaving ? (entryId ? "Updating..." : "Saving...") : (entryId ? "Save Changes" : "Save Estimate")}
             </Button>
          )} */}

          {/* Accept and Reject Buttons */}
          {entryId && status === "pending" && !isArchived && !invoiceIdRef && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleSave({ status: "rejected" })} // Using handleSave to update status
                disabled={isSaving || isConverting}
              >
                <MinusCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => handleSave({ status: "accepted" })} // Using handleSave to update status
                disabled={isSaving || isConverting}
              >
                <FileCog className="h-4 w-4 mr-2" /> Accept
              </Button>
            </>
          )}

          {/* Convert to Invoice Button */}
          {entryId && status === "accepted" && !isArchived && !invoiceIdRef && (
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
          {/* Print Button */}
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

      {/* Print Styles (No changes needed here) */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
            color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          /* Hide placeholders when printing */
          #estimate-printable-container input::placeholder,
          #estimate-printable-container textarea::placeholder {
            color: transparent !important;
            opacity: 0 !important;
          }

          /* Target the estimate container by ID */
          #estimate-printable-container,
          #estimate-printable-container * {
            visibility: visible;
          }
          #estimate-printable-container {
            position: absolute;
            left: 50%;
            top: 0;
            width: 100%;
            max-width: 8.5in; /* Standard letter width */
            transform: translateX(-50%); /* Center horizontally */
            padding-top: 0.1in; /* Add some padding for better print layout */
            color: black !important;
            background-color: white !important;
            margin: 0 !important;
          }
          /* Make all text and backgrounds black and white */
          #estimate-printable-container * {
            color: black !important;
            background-color: transparent !important;
            border-color: black !important;
            text-shadow: none !important;
            box-shadow: none !important;
          }
          /* Elements with .print-color should preserve their color */
          .print-color {
            filter: none !important;
            -webkit-filter: none !important;
            color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          /* Also ensure parent elements don't override with their grayscale filter */
          .print-color * {
            filter: none !important;
            -webkit-filter: none !important;
          }
          /* Hide specific elements by ID */
          .print-hide {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
});

// --- AddNewEstimateBtn Component (No changes needed here) ---
export const AddNewEstimateBtn = ({ journalId }: { journalId: string }) => {
  // Rename journalId to journalId for consistency internally if preferred
  return (
    <div>
      <Button variant="brutalist" className="mb-4" asChild>
        {/* Use journalId in the link */}
        <Link href={`/journal/entry?jid=${journalId}`}>New Estimate</Link>
      </Button>
    </div>
  );
};
