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
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added Input
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ContactInfo, ContactInfoRef } from "./subcomponents/ContactInfo";
import { NewItemForm } from "./subcomponents/NewItemForm";
import { EstimateStatusDropdown } from "./subcomponents/estimateStatus";
import {
  EstimateStatus as EstimateStatusEnum,
  InvoiceStatus,
} from "@/lib/custom_types";
import {
  LineItem,
  Adjustment,
  estimateDetailsState,
  estimateDetailsStateSchema,
  Payment, // Added Payment type
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
  const [status, setStatus] = useState<EstimateStatusEnum | InvoiceStatus>(
    EstimateStatusEnum.DRAFT,
  );
  const [customer, setCustomer] = useState<contactInfoSchemaType>(initInfo);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [taxPercentage, setTaxPercentage] = useState(0);
  const [notes, setNotes] = useState<string>("");

  // New state variables for invoice fields
  const [dueDate, setDueDate] = useState<Date | null | undefined>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);
  const [createdDate, setCreatedDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [entryId, setEntryId] = useState<string | null | undefined>(
    initialEntryId,
  );
  const [entryError, setEntryError] = useState<string | null>(null);

  // State for the "Add Payment" form
  const [newPaymentAmount, setNewPaymentAmount] = useState<number | string>(
    "",
  );
  const [newPaymentDate, setNewPaymentDate] = useState<Date | undefined>(
    new Date(),
  );
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>("");

  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState(false);
  const [paymentDatePopoverOpen, setPaymentDatePopoverOpen] = useState(false);

  const customerRef = useRef<ContactInfoRef>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { authUser } = useAuth();
  const { journal } = useJournalContext();

  const START_STATE = EstimateStatusEnum.DRAFT;

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

            // Convert Firestore Timestamps to Dates before validation
            const processedDetails = {
              ...details,
              dueDate:
                details.dueDate && typeof details.dueDate.toDate === "function"
                  ? details.dueDate.toDate()
                  : details.dueDate,
              payments:
                details.payments?.map((payment: any) => ({
                  ...payment,
                  date:
                    payment.date && typeof payment.date.toDate === "function"
                      ? payment.date.toDate()
                      : payment.date,
                })) || [],
            };

            // Simplified: validate only against estimateDetailsStateSchema
            const validation =
              estimateDetailsStateSchema.safeParse(processedDetails);

            if (!validation.success) {
              console.error(
                "Fetched estimate details failed validation:",
                validation.error.format(), // Use format() for better error details
              );
              setEntryError("Loaded estimate data is invalid.");
            } else {
              const validData = validation.data;
              setConfirmedItems(validData.confirmedItems || []);
              setStatus(
                validData.status.toUpperCase() as
                  | EstimateStatusEnum
                  | InvoiceStatus,
              );
              setCustomer(validData.customer || initInfo);
              setAdjustments(validData.adjustments || []);
              setTaxPercentage(validData.taxPercentage || 0);
              setNotes(validData.notes || "");

              // Load new invoice fields
              if (validData.dueDate) {
                // dueDate should already be a Date object after processing
                setDueDate(validData.dueDate);
              } else {
                setDueDate(null);
              }
              setPayments(validData.payments || []);

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
        setStatus(START_STATE);
        setCustomer(initInfo);
        setAdjustments([]);
        setTaxPercentage(0);
        setNotes("");
        // Reset new invoice fields for new entry
        setDueDate(null);
        setPayments([]);
        setCreatedDate(formattedDate(new Date()));
        setLoading(false);
      }
    }

    loadEntryData();
  }, [journalId, initialEntryId, jtype]); // jtype added to dependency array

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
        status: updates.status ?? status ?? EstimateStatusEnum.DRAFT, // Ensure status is always set
        customer: updates.customer ?? customer,
        supplier: supplierInfo || initInfo,
        logo: supplierLogo || null,
        adjustments: updates.adjustments ?? adjustments,
        taxPercentage: updates.taxPercentage ?? taxPercentage,
        currency: journalCurrency,
        notes: updates.notes ?? notes,

        // Add new invoice fields to the save payload
        dueDate: updates.dueDate ?? dueDate,
        payments: updates.payments ?? payments,
      };

      const detailsValidation =
        estimateDetailsStateSchema.safeParse(estimateDetailsData);
      if (!detailsValidation.success) {
        console.error(
          "Estimate details validation failed before save:",
          detailsValidation.error.message || detailsValidation.error.format(),
          estimateDetailsData,
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
      // Add new state variables to dependency array of handleSave
      dueDate,
      payments,
      toast,
      router,
    ],
  );

  const isInvoiceFlow = useMemo(() => {
    return [
      InvoiceStatus.INVOICED,
      InvoiceStatus.PAID,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.OVERDUE,
    ].includes(status as InvoiceStatus);
  }, [status]);

  // Function to handle adding a new payment
  const handleAddPayment = () => {
    if (
      !newPaymentAmount ||
      isNaN(Number(newPaymentAmount)) ||
      Number(newPaymentAmount) <= 0
    ) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be a positive number.",
        variant: "destructive",
      });
      return;
    }
    if (!newPaymentDate) {
      toast({
        title: "Invalid Date",
        description: "Please select a date for the payment.",
        variant: "destructive",
      });
      return;
    }

    const newPayment: Payment = {
      // id will be generated by backend or schema default if not provided
      amount: Number(newPaymentAmount),
      date: newPaymentDate, // Schema expects date object, will be serialized by Firestore
      method: newPaymentMethod || undefined, // Optional
      // transactionId and notes are not in this basic form
    };

    const updatedPayments = [...payments, newPayment];
    setPayments(updatedPayments);
    handleSave({ payments: updatedPayments }); // Save after adding the payment

    // Reset form
    setNewPaymentAmount("");
    setNewPaymentDate(new Date());
    setNewPaymentMethod("");
    toast({
      title: "Payment Added",
      description: "The new payment has been added locally and saved.",
    });
  };

  const handleStatusChange = (
    newStatus: EstimateStatusEnum | InvoiceStatus,
  ) => {
    setStatus(newStatus);
    handleSave({ status: newStatus });
  };

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
      <div className="flex justify-end">
        <EstimateStatusDropdown
          qstatus={status}
          setStatus={handleStatusChange}
        />
      </div>
      <div className="space-y-4 px-2 md:px-4">
        {/* Invoice Number and Due Date Fields */}
        {(isInvoiceFlow || dueDate) && ( // Show if in invoice flow or if due date exists
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-b pb-4">
            <div>
              <Label>Invoice Number</Label>
              <div
                id="invoiceNumber"
                className="text-sm font-medium text-muted-foreground"
              >
                {isInvoiceFlow && entryId ? entryId : "Not yet invoiced"}
              </div>
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Popover
                modal
                open={dueDatePopoverOpen}
                onOpenChange={setDueDatePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground",
                    )}
                    disabled={isSaving}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? (
                      format(dueDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate || undefined}
                    onSelect={(date) => {
                      setDueDate(date);
                      if (date) handleSave({ dueDate: date });
                      setDueDatePopoverOpen(false);
                    }}
                    disabled={isSaving}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mt-4 mb-2">Customer</h3>
          <ContactInfo
            ref={customerRef}
            info={customer}
            setInfo={(newInfo) => { 
              setCustomer(newInfo);
            }}
            onSave={(newInfo) => handleSave({ customer: newInfo })}
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
                    <th className="w-8 print:hidden"></th>
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
                      <td className="py-2 px-1 print:hidden align-top">
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

        {/* Payments Section - Conditionally Rendered */}
        {(isInvoiceFlow || payments.length > 0) && (
          <div>
            <h3 className="text-lg font-semibold pt-4 mb-2">Payments</h3>
            <div className="border rounded-md p-4 space-y-4">
              {payments.length > 0 ? (
                <ul className="space-y-2">
                  {payments.map((payment, index) => (
                    <li
                      key={payment.id || `payment-${index}-${payment.date}`} // Use payment.id or a more unique key
                      className="flex justify-between items-center p-2 border-b last:border-b-0"
                    >
                      <div>
                        <p className="font-medium">
                          {currencyFormat(payment.amount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Method: {payment.method || "N/A"}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {/* Ensure payment.date is a Date object or valid string for formattedDate */}
                        {formattedDate(new Date(payment.date))}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No payments recorded yet.
                </p>
              )}

              {/* Add Payment Form - only if not archived and in invoice flow */}
              {isInvoiceFlow && (
                <div className="pt-4 border-t">
                  <h4 className="text-md font-semibold mb-2">Add Payment</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <Label htmlFor="paymentAmount">Amount</Label>
                      <Input
                        id="paymentAmount"
                        type="number"
                        value={newPaymentAmount}
                        onChange={(e) => setNewPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentDate">Date</Label>
                      <Popover
                        modal
                        open={paymentDatePopoverOpen}
                        onOpenChange={setPaymentDatePopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !newPaymentDate && "text-muted-foreground",
                            )}
                            disabled={isSaving}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newPaymentDate ? (
                              format(newPaymentDate, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newPaymentDate}
                            onSelect={(date) => {
                              setNewPaymentDate(date || undefined);
                              setPaymentDatePopoverOpen(false);
                            }}
                            disabled={isSaving}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="paymentMethod">Method (Optional)</Label>
                      <Input
                        id="paymentMethod"
                        type="text"
                        value={newPaymentMethod}
                        onChange={(e) => setNewPaymentMethod(e.target.value)}
                        placeholder="e.g., Card, Bank Transfer"
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddPayment}
                    disabled={isSaving || !newPaymentAmount || !newPaymentDate}
                    className="mt-3"
                    size="sm"
                  >
                    Add Payment
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div
        id="estimate-actions-bar"
        className="print:hidden flex justify-between items-center mt-6 px-2 md:px-4 sticky bottom-0 py-2 bg-background/90 backdrop-blur-sm border-t"
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
