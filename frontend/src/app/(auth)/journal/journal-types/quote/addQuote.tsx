// frontend/src/app/(auth)/journal/journal-types/quote/addQuote.tsx
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useMemo,
} from "react";
import { ChevronLeft, Printer, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ContactInfo, ContactInfoRef } from "./subcomponents/ContactInfo";
import { NewItemForm } from "./subcomponents/NewItemForm";
import {
  LineItem,
  Adjustment,
  quoteDetailsState,
  quoteDetailsStateSchema,
} from "@/../../backend/functions/src/common/schemas/quote_schema";
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
import { QuoteHeader } from "./subcomponents/header";
import { InlineEditTextarea } from "./subcomponents/EditNotes";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { EntryItf } from "@/../../backend/functions/src/common/common_types"; // Import EntryItf for inventory cache type
import { useAuth } from "@/lib/auth_handler"; // Import useAuth
import { useJournalContext } from "@/context/JournalContext"; // Import useJournalContext

// --- Constants ---
const ADD_LOG_FN_NAME = "addLogFn";
const QUOTE_ENTRY_TYPE = "quote";

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
interface QuoteDetailsProps {
  journalId: string; // Standardized name
  entryId?: string | null; // Optional for new quotes
  // Props passed down from parent (using JournalContext)
  supplierInfo: contactInfoSchemaType;
  supplierLogo: string | null;
  journalCurrency: allowedCurrencySchemaType;
  journalInventoryCache: Record<string, EntryItf>; // Receive inventory cache
}

// --- Main Component ---
// Use forwardRef if necessary, otherwise a standard functional component is fine
export const QuoteDetails = React.memo(function QuoteDetails({
  journalId,
  entryId: initialEntryId, // Rename prop to avoid conflict with state
  supplierInfo,
  supplierLogo,
  journalCurrency,
  journalInventoryCache,
}: QuoteDetailsProps) {
  // --- State Variables ---
  const [confirmedItems, setConfirmedItems] = useState<LineItem[]>([]);
  const [status, setStatus] = useState<quoteDetailsState["status"]>("pending");
  const [customer, setCustomer] = useState<contactInfoSchemaType>(initInfo);
  // supplier, logo, currency state removed -> use props
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [taxPercentage, setTaxPercentage] = useState(0);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(true); // Still need loading state for fetching *entry*
  const [createdDate, setCreatedDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
            QUOTE_ENTRY_TYPE,
            initialEntryId,
          );
          console.log("Fetched entry:", entry);

          if (!entry) {
            setEntryError("Quote entry not found or access denied.");
          } else if (entry.details) {
            const details = entry.details as quoteDetailsState;
            const validation = quoteDetailsStateSchema.safeParse(details);
            if (!validation.success) {
              console.error(
                "Fetched quote details failed validation:",
                validation.error,
              );
              setEntryError("Loaded quote data is invalid.");
            } else {
              // Set state based on fetched entry data
              setConfirmedItems(validation.data.confirmedItems || []);
              setStatus(validation.data.status || "pending");
              setCustomer(validation.data.customer || initInfo);
              setAdjustments(validation.data.adjustments || []);
              setTaxPercentage(validation.data.taxPercentage || 0);
              setNotes(validation.data.notes || "");
              setCreatedDate(formattedDate(entry.createdAt));
            }
          }
        } catch (error) {
          console.error("Error loading quote entry:", error);
          setEntryError("Failed to load quote details. Please try again.");
        } finally {
          setLoading(false);
        }
      } else {
        // New quote: Reset fields (supplier/logo/currency come from props)
        setConfirmedItems([]);
        setStatus("pending");
        setCustomer(initInfo);
        setAdjustments([]);
        setTaxPercentage(0);
        setNotes("");
        setCreatedDate(formattedDate(new Date())); // Set to now
        setLoading(false); // Finished "loading" (no entry to fetch)
      }
    }

    loadEntryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalId, initialEntryId]); // Rerun if journalId or initialEntryId changes

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
    async (updates: Partial<quoteDetailsState> = {}) => {
      if (isSaving || !journalId || !journalCurrency) {
        console.warn(
          "Save aborted. Already saving or missing Journal ID/Currency.",
        );
        if (!journalCurrency) {
          toast({
            title: "Missing Currency",
            description: "Cannot save quote, journal currency is not set.",
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
      const quoteDetailsData: quoteDetailsState = {
        confirmedItems: updates.confirmedItems ?? confirmedItems,
        status: updates.status ?? status,
        customer: updates.customer ?? customer,
        supplier: supplierInfo || initInfo, // Use prop
        logo: supplierLogo || null, // Use prop
        adjustments: updates.adjustments ?? adjustments,
        taxPercentage: updates.taxPercentage ?? taxPercentage,
        currency: journalCurrency, // Use prop
        notes: updates.notes ?? notes,
      };

      // Validate final details object
      const detailsValidation =
        quoteDetailsStateSchema.safeParse(quoteDetailsData);
      if (!detailsValidation.success) {
        console.error(
          "Quote details validation failed before save:",
          detailsValidation.error.format(),
        );
        toast({
          title: "Invalid Quote Data",
          description:
            "Could not save quote due to invalid data. Check console for details.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      const validatedDetails = detailsValidation.data;

      // Construct Backend Payload
      const payload = {
        journalId: journalId, // Use prop
        entryType: QUOTE_ENTRY_TYPE,
        name: `Quote for ${validatedDetails.customer.name || "Unknown"}`,
        details: validatedDetails,
        ...(entryId && { entryId }), // Include entryId if editing
      };

      console.log("Saving quote with payload:", payload);

      // Call Backend Function
      try {
        const result = await addLogFn(payload);
        console.log("Quote save successful:", result.data);

        const returnedId = (result.data as any)?.id;
        if (returnedId && !entryId) {
          setEntryId(returnedId);
          const url = new URL(window.location.href);
          url.searchParams.set("eid", returnedId);
          router.replace(url.toString(), { scroll: false });
          console.log("Set new entryId:", returnedId);
        }

        toast({
          title: entryId ? "Quote Updated" : "Quote Saved",
          description: `Quote for ${validatedDetails.customer.name} saved successfully.`,
        });
      } catch (error: any) {
        console.error("Error saving quote:", error);
        toast({
          title: "Save Failed",
          description: error.message || "Could not save the quote.",
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
      toast,
      router,
    ],
  );

  // --- Render Logic ---
  if (loading) {
    // Loading state while fetching entry
    return <div className="text-center p-10">Loading quote details...</div>;
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
      id="quote-printable-container"
      className="w-full print:max-w-none mx-auto p-2 border-none relative pb-20 md:pb-4 lg:pr-[430px]" // Add right padding on large screens
    >
      {/* --- Header (Passes props) --- */}
      <QuoteHeader logo={supplierLogo} contactInfo={supplierInfo} />

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
        id="quote-actions-bar"
        className="print-hide flex justify-between items-center mt-6 px-2 md:px-4"
      >
        <Button variant="brutalist" asChild size="sm">
          <Link href={`/journal?jid=${journalId}`}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
        {/* Explicit Save Button (Optional) */}
        {/* <Button variant="default" size="sm" onClick={() => handleSave()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Quote"}
        </Button> */}
        <Button
          variant="brutalist"
          size="sm"
          onClick={() => window.print()}
          disabled={isSaving} // Disable print while saving to avoid inconsistencies
        >
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
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
          #quote-printable-container input::placeholder,
          #quote-printable-container textarea::placeholder {
            color: transparent !important;
            opacity: 0 !important;
          }

          /* Target the quote container by ID */
          #quote-printable-container,
          #quote-printable-container * {
            visibility: visible;
          }
          #quote-printable-container {
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
          #quote-printable-container * {
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

// --- AddNewQuoteBtn Component (No changes needed here) ---
export const AddNewQuoteBtn = ({ journalId }: { journalId: string }) => {
  // Rename journalId to journalId for consistency internally if preferred
  return (
    <div>
      <Button variant="brutalist" className="mb-4" asChild>
        {/* Use journalId in the link */}
        <Link href={`/journal/entry?jid=${journalId}`}>New Quote</Link>
      </Button>
    </div>
  );
};
