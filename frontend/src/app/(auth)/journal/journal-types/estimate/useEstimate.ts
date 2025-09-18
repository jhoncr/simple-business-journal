import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/auth_handler";
import { fetchEntry } from "@/lib/db_handler";
import { formattedDate, formatCurrency } from "@/lib/utils";
import {
  LineItem,
  Adjustment,
  estimateDetailsState,
  estimateDetailsStateSchema,
  Payment,
} from "@/../../backend/functions/src/common/schemas/estimate_schema";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
  ROLES,
} from "@/../../backend/functions/src/common/schemas/common_schemas";
import {
  WorkStatus,
  EntryItf,
} from "@/../../backend/functions/src/common/common_types";
import { useAuth } from "@/lib/auth_handler";
import { useJournalContext } from "@/context/JournalContext";
import { ContactInfoRef } from "./subcomponents/ContactInfo";

const ADD_LOG_FN_NAME = "addLogFn";
const ESTIMATE_ENTRY_TYPE = "estimate";

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

interface UseEstimateProps {
  journalId: string;
  entryId?: string | null;
  supplierInfo: contactInfoSchemaType;
  supplierLogo: string | null;
  journalCurrency: allowedCurrencySchemaType;
  journalInventoryCache: Record<string, EntryItf>;
  jtype: string;
}

export const useEstimate = ({
  journalId,
  entryId: initialEntryId,
  supplierInfo,
  supplierLogo,
  journalCurrency,
  journalInventoryCache,
  jtype,
}: UseEstimateProps) => {
  const [confirmedItems, setConfirmedItems] = useState<LineItem[]>([]);
  const [status, setStatus] = useState<WorkStatus>(WorkStatus.DRAFT);
  const [customer, setCustomer] = useState<contactInfoSchemaType>(initInfo);
  const [canUpdate, setCanUpdate] = useState(false);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [taxPercentage, setTaxPercentage] = useState(0);
  const [notes, setNotes] = useState<string>("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [entryId, setEntryId] = useState<string | null | undefined>(
    initialEntryId,
  );
  const [entryError, setEntryError] = useState<string | null>(null);

  const customerRef = useRef<ContactInfoRef>(null);
  const router = useRouter();
  const { authUser } = useAuth();
  const { journal } = useJournalContext();

  const START_STATE = WorkStatus.DRAFT;

  const userRole: (typeof ROLES)[number] = useMemo(() => {
    if (!authUser || !journal || !journal.access) {
      return "viewer";
    }
    return (journal.access[authUser.uid]?.role ||
      "viewer") as (typeof ROLES)[number];
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
          const entry = await fetchEntry(
            journalId,
            ESTIMATE_ENTRY_TYPE,
            initialEntryId,
          );

          if (!entry) {
            setEntryError("Estimate entry not found or access denied.");
          } else if (entry.details) {
            const details = entry.details;

            const newCreatedAt = entry.createdAt
              ? entry.createdAt.toDate()
              : null;
            setCreatedAt(newCreatedAt);
            console.log("Fetched estimate entry createdAt:", newCreatedAt);
            const processedDetails = {
              ...details,
              dueDate:
                details.dueDate && typeof details.dueDate.toDate === "function"
                  ? details.dueDate.toDate()
                  : details.dueDate,
              payments:
                details.payments?.map(
                  (payment: { date: { toDate: () => Date } }) => ({
                    ...payment,
                    date:
                      payment.date && typeof payment.date.toDate === "function"
                        ? payment.date.toDate()
                        : payment.date,
                  }),
                ) || [],
            };

            const validation =
              estimateDetailsStateSchema.safeParse(processedDetails);

            if (!validation.success) {
              console.error(
                "Fetched estimate details failed validation:",
                validation.error.format(),
              );
              setEntryError("Loaded estimate data is invalid.");
            } else {
              const validData = validation.data;
              setConfirmedItems(
                (validData.confirmedItems as LineItem[]) || [],
              );
              setStatus(validData.status as WorkStatus);
              setCustomer(validData.customer || initInfo);
              setAdjustments((validData.adjustments as Adjustment[]) || []);
              setTaxPercentage(validData.taxPercentage || 0);
              setNotes(validData.notes || "");
              setCanUpdate(true);

              if (validData.dueDate) {
                setDueDate(validData.dueDate);
              } else {
                setDueDate(new Date());
              }
              setPayments((validData.payments as Payment[]) || []);
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
        setDueDate(null);
        setPayments([]);
        setLoading(false);
        setCanUpdate(true); // Allow creating a new estimate
        setCreatedAt(new Date()); // Set created date for new estimate
      }
    }

    loadEntryData();
  }, [journalId, initialEntryId, jtype, START_STATE]);

  const validateCustomer = async () => {
    if (customerRef.current) {
      const isValid = await customerRef.current.validate();
      if (!isValid) {
        toast.error("Please correct customer details before saving.");
        return false;
      }
    } else {
      toast.error("Could not validate customer info.");
      return false;
    }
    return true;
  };

  const buildPayload = (updates: Partial<estimateDetailsState>) => {
    const estimateDetailsData: estimateDetailsState = {
      confirmedItems: updates.confirmedItems ?? confirmedItems,
      status: updates.status ?? status ?? WorkStatus.DRAFT,
      customer: updates.customer ?? customer,
      supplier: supplierInfo || initInfo,
      logo: supplierLogo || null,
      adjustments: updates.adjustments ?? adjustments,
      taxPercentage: updates.taxPercentage ?? taxPercentage,
      currency: journalCurrency,
      notes: updates.notes ?? notes,
      dueDate: updates.dueDate ?? dueDate,
      payments: updates.payments ?? payments,
    };

    const detailsValidation =
      estimateDetailsStateSchema.safeParse(estimateDetailsData);
    if (!detailsValidation.success) {
      console.error(
        "Estimate details validation failed before save:",
        detailsValidation.error.format(),
        estimateDetailsData,
      );
      toast.error(
        "Invalid Estimate Data: Please check the console for details.",
      );
      return null;
    }

    return {
      journalId: journalId,
      entryType: ESTIMATE_ENTRY_TYPE,
      name: `Estimate for ${
        detailsValidation.data.customer.name || "Unknown"
      }`,
      details: detailsValidation.data,
      ...(entryId && { entryId }),
    };
  };

  const handleSaveSuccess = (
    result: any,
    validatedDetails: estimateDetailsState,
  ) => {
    const returnedId = (result.data as { id: string })?.id;
    if (returnedId && !entryId) {
      setEntryId(returnedId);
      const url = new URL(window.location.href);
      url.searchParams.set("eid", returnedId);
      router.replace(url.toString(), { scroll: false });
    }
    toast.success(`Estimate for ${validatedDetails.customer.name} saved.`);
    setIsSaving(false);
    return true;
  };

  const handleSaveError = (error: unknown) => {
    console.error("Error saving estimate:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Could not save estimate.";
    toast.error(`Save Failed: ${errorMessage}`);
    setIsSaving(false);
    return false;
  };

  const handleSave = useCallback(
    async (updates: Partial<estimateDetailsState> = {}): Promise<boolean> => {
      if (jtype !== ESTIMATE_ENTRY_TYPE) {
        toast.error("Cannot save, incorrect form type.");
        return false;
      }
      if (isSaving || !journalId || !journalCurrency) {
        if (!journalCurrency) {
          toast.error("Cannot save estimate, journal currency is not set.");
        }
        return false;
      }
      setIsSaving(true);

      if (!(await validateCustomer())) {
        setIsSaving(false);
        setCanUpdate(true);
        return false;
      }

      const payload = buildPayload(updates);
      if (!payload) {
        setIsSaving(false);
        return false;
      }

      try {
        const result = await addLogFn(payload);
        return handleSaveSuccess(result, payload.details);
      } catch (error: unknown) {
        return handleSaveError(error);
      }
    },
    [
      jtype,
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
      dueDate,
      payments,
      router,
      buildPayload,
      handleSaveSuccess,
    ],
  );

  const addConfirmedItem = async (items: LineItem[]) => {
    const newItems = [...confirmedItems, ...items];
    const success = await handleSave({ confirmedItems: newItems });
    if (success) {
      setConfirmedItems(newItems);
    }
    return success;
  };

  const removeConfirmedItem = (id: string) => {
    const newItems = confirmedItems.filter(
      (item) => item.id !== id && item.parentId !== id,
    );
    setConfirmedItems(newItems);
    handleSave({ confirmedItems: newItems });
  };

  const handleStatusChange = (newStatus: WorkStatus) => {
    setStatus(newStatus);
    handleSave({ status: newStatus });
  };

  const calculateSubtotal = useCallback(() => {
    return confirmedItems.reduce(
      (sum, item) =>
        sum +
        (item.quantity || 0) *
          (item.material?.unitPrice ? Number(item.material.unitPrice) : 0),
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

  const handleAddPayment = (payment: Payment) => {
    const updatedPayments = [...payments, payment];
    setPayments(updatedPayments);
    handleSave({ payments: updatedPayments });
    toast.success("The new payment has been saved.");
  };

  return {
    confirmedItems,
    status,
    createdAt,
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
    setCustomer,
    setAdjustments,
    setTaxPercentage,
    setNotes,
    setDueDate,
    setPayments,
    addConfirmedItem,
    removeConfirmedItem,
    handleStatusChange,
    handleSave,
    calculateSubtotal,
    currencyFormat,
    handleAddPayment,
  };
};
