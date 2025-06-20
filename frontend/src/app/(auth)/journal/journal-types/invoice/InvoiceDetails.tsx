// frontend/src/app/(auth)/journal/journal-types/invoice/InvoiceDetails.tsx
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { ChevronLeft, Printer, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker"; // Assuming a DatePicker component exists
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Assuming Select components exist

// Subcomponents from estimate (reuse or adapt)
import { ContactInfo, ContactInfoRef } from "../estimate/subcomponents/ContactInfo";
import { NewItemForm } from "../estimate/subcomponents/NewItemForm";
import { InvoiceBottomLines } from "../estimate/subcomponents/Adjustments"; // May need adjustments for invoice logic
import { EstimateHeader } from "../estimate/subcomponents/header"; // Reusable as is?
import { InlineEditTextarea } from "../estimate/subcomponents/EditNotes";

// Backend schemas
import {
  LineItem, // Assuming compatible
  Adjustment, // Assuming compatible
} from "@/../../backend/functions/src/common/schemas/estimate_schema"; // Shared?
import {
  InvoiceDetails,
  invoiceDetailsSchema,
} from "@/../../backend/functions/src/common/schemas/invoice_schema";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
  ROLES,
} from "@/../../backend/functions/src/common/schemas/common_schemas";

// Firebase and utils
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/auth_handler";
import { fetchEntry } from "@/lib/db_handler";
import { formattedDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { EntryItf } from "@/../../backend/functions/src/common/common_types";
import { useAuth } from "@/lib/auth_handler";
import { useJournalContext } from "@/context/JournalContext";

// --- Constants ---
const ADD_LOG_FN_NAME = "addLogFn"; // Assuming generic add function
const INVOICE_ENTRY_TYPE = "invoice";

const initInfo: contactInfoSchemaType = {
  name: "",
  email: null,
  phone: null,
  address: { street: null, city: null, state: null, zipCode: null },
};

const addLogFn = httpsCallable(functions, ADD_LOG_FN_NAME, {
  limitedUseAppCheckTokens: true,
});

// --- Props Interface ---
interface InvoiceDetailsFormProps {
  journalId: string;
  entryId?: string | null;
  supplierInfo: contactInfoSchemaType;
  supplierLogo: string | null;
  journalCurrency: allowedCurrencySchemaType;
  journalInventoryCache: Record<string, EntryItf>;
}

// --- Main Component ---
export const InvoiceDetailsForm = React.memo(function InvoiceDetailsForm({
  journalId,
  entryId: initialEntryId,
  supplierInfo,
  supplierLogo,
  journalCurrency,
  journalInventoryCache,
}: InvoiceDetailsFormProps) {
  // --- State Variables for Invoice ---
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [paymentStatus, setPaymentStatus] =
    useState<InvoiceDetails["paymentStatus"]>("pending");
  const [totalAmount, setTotalAmount] = useState<number>(0); // Will be calculated

  const [confirmedItems, setConfirmedItems] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState<contactInfoSchemaType>(initInfo);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [taxPercentage, setTaxPercentage] = useState(0); // Keep for calculation consistency with estimate subcomponents
  const [notes, setNotes] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [createdDate, setCreatedDate] = useState<string | null>(null); // For display if editing
  const [isSaving, setIsSaving] = useState(false);
  const [entryId, setEntryId] = useState<string | null | undefined>(initialEntryId);
  const [entryError, setEntryError] = useState<string | null>(null);

  // --- Refs and Hooks ---
  const customerRef = useRef<ContactInfoRef>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { authUser } = useAuth();
  const { journal } = useJournalContext();

  const userRole: (typeof ROLES)[number] = useMemo(() => {
    if (!authUser || !journal || !journal.access) return "viewer";
    return journal.access[authUser.uid]?.role || "viewer";
  }, [authUser, journal]);

  // --- Helper function to calculate totals (adapted from estimate logic) ---
  const calculateInvoiceTotals = useCallback(() => {
    const itemsTotal = confirmedItems.reduce(
      (sum, item) => sum + item.quantity * (item.material?.unitPrice || 0),
      0,
    );

    const adjustmentsTotal = adjustments.reduce((sum, adj) => {
      let adjValue = 0;
      switch (adj.type) {
        case "addFixed": adjValue = adj.value; break;
        case "discountFixed": adjValue = -adj.value; break;
        case "addPercent": adjValue = (itemsTotal * adj.value) / 100; break;
        case "discountPercent": adjValue = -(itemsTotal * adj.value) / 100; break;
      }
      return sum + adjValue;
    }, 0);

    const subtotalBeforeTax = itemsTotal + adjustmentsTotal;
    const taxAmt = (subtotalBeforeTax * taxPercentage) / 100;
    const grandTotal = subtotalBeforeTax + taxAmt;
    return Math.round(grandTotal * 100) / 100; // Round to 2 decimal places
  }, [confirmedItems, adjustments, taxPercentage]);

  useEffect(() => {
    setTotalAmount(calculateInvoiceTotals());
  }, [confirmedItems, adjustments, taxPercentage, calculateInvoiceTotals]);


  // --- Fetch existing entry data (if entryId exists) ---
  useEffect(() => {
    setEntryId(initialEntryId);
    async function loadEntryData() {
      setLoading(true);
      setEntryError(null);
      if (!journalId) {
        setEntryError("Journal ID is missing.");
        setLoading(false);
        return;
      }
      if (initialEntryId) {
        try {
          const entry = await fetchEntry(journalId, INVOICE_ENTRY_TYPE, initialEntryId);
          if (!entry) {
            setEntryError("Invoice entry not found or access denied.");
          } else if (entry.details) {
            const details = entry.details as InvoiceDetails;
            const validation = invoiceDetailsSchema.safeParse(details);
            if (!validation.success) {
              console.error("Fetched invoice details failed validation:", validation.error.format());
              setEntryError("Loaded data is invalid.");
            } else {
              const data = validation.data;
              setInvoiceNumber(data.invoiceNumber);
              setDueDate(data.dueDate ? new Date(data.dueDate) : undefined);
              setPaymentStatus(data.paymentStatus);
              setConfirmedItems(data.lineItems || []);
              setCustomer(data.customer || initInfo);
              setAdjustments(data.adjustments || []);
              // taxPercentage is not directly on invoiceDetails, but needed if InvoiceBottomLines calculates it.
              // If InvoiceBottomLines expects a final tax amount, this needs adjustment.
              // For now, assume taxPercentage is part of the calculation process.
              // If your invoice schema stores final tax amount, you'd load that instead.
              setNotes(data.notes || "");
              setTotalAmount(data.totalAmount); // Load the authoritative total amount
              if (entry.createdAt) setCreatedDate(formattedDate(entry.createdAt));
            }
          }
        } catch (error) {
          console.error("Error loading invoice entry:", error);
          setEntryError("Failed to load invoice details. Please try again.");
        } finally {
          setLoading(false);
        }
      } else {
        // New invoice: Reset fields
        setInvoiceNumber(""); // Potentially auto-generate later
        setDueDate(new Date(new Date().setDate(new Date().getDate() + 30))); // Default due date e.g. 30 days from now
        setPaymentStatus("pending");
        setConfirmedItems([]);
        setCustomer(initInfo);
        setAdjustments([]);
        setTaxPercentage(0); // Default tax if applicable
        setNotes("");
        setTotalAmount(0);
        setCreatedDate(formattedDate(new Date()));
        setLoading(false);
      }
    }
    loadEntryData();
  }, [journalId, initialEntryId]);

  // --- Event Handlers ---
  const addConfirmedItem = (items: LineItem[]) => {
    const newItems = [...confirmedItems, ...items];
    setConfirmedItems(newItems);
    // Auto-save or explicit save for invoices? For now, let's make it explicit.
    // handleSaveInvoice({ lineItems: newItems });
  };

  const removeConfirmedItem = (id: string) => {
    const newItems = confirmedItems.filter((item) => item.id !== id && item.parentId !== id);
    setConfirmedItems(newItems);
    // handleSaveInvoice({ lineItems: newItems });
  };

  const currencyFormat = useCallback(
    (amount: number) => {
      return journalCurrency ? formatCurrency(amount, journalCurrency) : amount.toFixed(2);
    },
    [journalCurrency],
  );

  // --- handleSaveInvoice ---
  const handleSaveInvoice = useCallback(async (updates: Partial<InvoiceDetails> = {}, explicitSave: boolean = false) => {
    if (isSaving || !journalId || !journalCurrency) {
      if (!journalCurrency) toast({ title: "Missing Currency", description: "Cannot save, journal currency not set.", variant: "destructive" });
      return;
    }
    if (!explicitSave && initialEntryId === undefined) { // Don't auto-save for brand new unsaved invoices
        // console.log("Auto-save deferred for new invoice until first explicit save.");
        return;
    }

    setIsSaving(true);

    if (customerRef.current) {
      const isValid = await customerRef.current.validate();
      if (!isValid) {
        toast({ title: "Invalid Customer Info", description: "Please correct customer details.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
    }

    const currentTotalAmount = calculateInvoiceTotals();

    const invoiceDetailsData: InvoiceDetails = {
      invoiceNumber: updates.invoiceNumber ?? invoiceNumber,
      dueDate: (updates.dueDate ? new Date(updates.dueDate) : dueDate)?.toISOString() ?? new Date().toISOString(),
      paymentStatus: updates.paymentStatus ?? paymentStatus,
      customer: updates.customer ?? customer,
      supplier: supplierInfo || initInfo,
      lineItems: updates.lineItems ?? confirmedItems,
      adjustments: updates.adjustments ?? adjustments,
      currency: journalCurrency,
      notes: updates.notes ?? notes,
      totalAmount: currentTotalAmount, // Always use freshly calculated totalAmount
      entryType: "invoice", // Important: Add entryType to details
    };

    const detailsValidation = invoiceDetailsSchema.safeParse(invoiceDetailsData);
    if (!detailsValidation.success) {
      console.error("Invoice details validation failed:", detailsValidation.error.format());
      toast({ title: "Invalid Invoice Data", description: "Check console for details.", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    const validatedDetails = detailsValidation.data;

    const payload = {
      journalId: journalId,
      entryType: INVOICE_ENTRY_TYPE,
      name: `Invoice #${validatedDetails.invoiceNumber || "N/A"}`, // Use invoice number in name
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
      toast({ title: entryId ? "Invoice Updated" : "Invoice Saved", description: `Invoice #${validatedDetails.invoiceNumber} processed.` });
    } catch (error: any) {
      console.error("Error saving invoice:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save invoice.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving, journalId, journalCurrency, invoiceNumber, dueDate, paymentStatus, customer, supplierInfo,
    confirmedItems, adjustments, taxPercentage, notes, entryId, toast, router, calculateInvoiceTotals, initialEntryId
  ]);


  if (loading) return <div className="text-center p-10">Loading invoice details...</div>;
  if (entryError) return <div className="text-center p-10 text-red-600">{entryError}</div>;
  if (!journalCurrency || !supplierInfo) {
    return <div className="text-center p-10 text-muted-foreground">Journal details not available.</div>;
  }

  return (
    <div id="invoice-printable-container" className="w-full print:max-w-none mx-auto p-2 border-none relative pb-20 md:pb-4 lg:pr-[430px]">
      <EstimateHeader logo={supplierLogo} contactInfo={supplierInfo} /> {/* Reusable? */}

      <div className="space-y-4 px-2 md:px-4">
        {/* Invoice Specific Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              onBlur={() => handleSaveInvoice({ invoiceNumber }, !!entryId)} // Save on blur if editing
              placeholder="INV-001"
              disabled={isSaving}
            />
          </div>
          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <DatePicker
              date={dueDate}
              setDate={(newDate) => {
                setDueDate(newDate);
                if (newDate) handleSaveInvoice({ dueDate: newDate.toISOString() }, !!entryId);
              }}
              disabled={isSaving}
            />
          </div>
          <div>
            <Label htmlFor="paymentStatus">Payment Status</Label>
            <Select
              value={paymentStatus}
              onValueChange={(value: InvoiceDetails["paymentStatus"]) => {
                setPaymentStatus(value);
                handleSaveInvoice({ paymentStatus: value }, !!entryId);
              }}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Customer Info */}
        <div>
          <h3 className="text-lg font-semibold mt-4 mb-2">Customer</h3>
          <ContactInfo
            ref={customerRef}
            info={customer}
            setInfo={(newInfo) => setCustomer(newInfo)}
            onSave={() => handleSaveInvoice({ customer }, !!entryId)}
          />
        </div>

        {/* Items Section */}
        <div>
          <h3 className="text-lg font-semibold pt-4 mb-2">Items</h3>
          <div className="border rounded-md p-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 px-1 font-medium w-20">Qty</th>
                  <th className="text-left py-2 px-1 font-medium">Description</th>
                  <th className="text-right py-2 px-2 font-medium w-24">Price</th>
                  <th className="text-right py-2 px-1 font-medium w-24">Total</th>
                  <th className="w-8 print-hide"></th>
                </tr>
              </thead>
              <tbody>
                {confirmedItems.map((item) => (
                  <tr key={item.id} className="border-b border-dashed last:border-0">
                    <td className="py-2 px-1 text-left align-top">
                      {item.quantity}
                      <div className="text-xs text-muted-foreground">{item.material.dimensions.unitLabel}</div>
                    </td>
                    <td className="py-2 px-1 align-top">
                      {item.description || item.material.description}
                      {item.material.dimensions.type === "area" && item.dimensions && (
                        <div className="text-xs text-muted-foreground">
                          {item.dimensions.length} × {item.dimensions.width} {item.material.dimensions.unitLabel}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-1 align-top text-right pr-2">
                      {currencyFormat(item.material.unitPrice)}
                      <div className="text-xs text-muted-foreground">/{item.material.dimensions.unitLabel}</div>
                    </td>
                    <td className="py-2 px-1 text-right align-top">{currencyFormat(item.quantity * item.material.unitPrice)}</td>
                    <td className="py-2 px-1 print-hide align-top">
                      <Button variant="ghost" size="icon" onClick={() => removeConfirmedItem(item.id)} disabled={isSaving} className="h-8 w-8">
                        <MinusCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {confirmedItems.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-4 text-sm text-muted-foreground">Add items using the form below.</td></tr>
                )}
              </tbody>
            </table>
            <NewItemForm
              onAddItem={addConfirmedItem}
              currency={journalCurrency}
              inventoryCache={journalInventoryCache}
              userRole={userRole}
            />
            <InvoiceBottomLines
              itemSubtotal={confirmedItems.reduce((sum, item) => sum + item.quantity * (item.material?.unitPrice || 0),0)}
              adjustments={adjustments}
              setAdjustments={(newAdjustments) => {
                setAdjustments(newAdjustments);
                // handleSaveInvoice({ adjustments: newAdjustments }, !!entryId); //Decide if this should auto-save
              }}
              taxPercentage={taxPercentage}
              setTaxPercentage={(newTaxPercentage) => {
                setTaxPercentage(newTaxPercentage);
                // handleSaveInvoice({ taxPercentage: newTaxPercentage }, !!entryId); //Decide if this should auto-save
              }}
              currency={journalCurrency}
              userRole={userRole}
              // Pass calculated total for display, or let it calculate internally
              currentTotal={totalAmount} // Pass the calculated total amount
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <InlineEditTextarea
            initialValue={notes}
            onSave={(value) => { setNotes(value); handleSaveInvoice({ notes: value }, !!entryId); }}
            placeholder="Add any additional notes..."
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Actions Bar */}
      <div id="invoice-actions-bar" className="print-hide flex justify-between items-center mt-6 px-2 md:px-4 sticky bottom-0 py-2 bg-background/90 backdrop-blur-sm border-t">
        <Button variant="brutalist" asChild size="sm" disabled={isSaving}>
          <Link href={`/journal?jid=${journalId}&type=invoice`}><ChevronLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>
        <div className="flex items-center space-x-2">
          {!entryId && ( // Only show "Save New Invoice" button for brand new invoices not yet saved
             <Button
                variant="default"
                size="sm"
                onClick={() => handleSaveInvoice({}, true)} // Explicit save
                disabled={isSaving}
              >
              {isSaving ? "Saving..." : "Save New Invoice"}
             </Button>
          )}
           {entryId && ( // Show "Update Invoice" for existing invoices
             <Button
                variant="default"
                size="sm"
                onClick={() => handleSaveInvoice({}, true)} // Explicit save
                disabled={isSaving}
              >
              {isSaving ? "Updating..." : "Update Invoice"}
             </Button>
          )}
          <Button variant="brutalist" size="sm" onClick={() => window.print()} disabled={isSaving}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>
      {/* Print Styles (same as estimate) */}
      <style jsx global>{`
        @media print { /* ... (same print styles as estimate) ... */ }
      `}</style>
    </div>
  );
});
