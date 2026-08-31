import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
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
} from "@backend/common/schemas/estimate_schema";
import {
  contactInfoSchemaType,
  allowedCurrencySchemaType,
  ROLES,
} from "@backend/common/schemas/common_schemas";
import {
  WorkStatus,
  EntryItf,
} from "@backend/common/common_types";
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
  const t = useTranslations("estimate");
  const tPayments = useTranslations("payments");
  const { toast } = useToast();

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
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [entryId, setEntryId] = useState<string | null | undefined>(
    initialEntryId,
  );
  const [entryError, setEntryError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);

  const customerRef = useRef<ContactInfoRef>(null);
  const router = useRouter();
  const { authUser } = useAuth();
  const { journal } = useJournalContext();

  const START_STATE = WorkStatus.DRAFT;

  const parseDateField = (val: unknown): Date | null | undefined => {
    if (!val) return val as null | undefined;
    if (typeof (val as { toDate?: () => Date }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate();
    }
    if (val instanceof Date) return val;
    if (typeof val === "string" || typeof val === "number") {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
    return val as any;
  };

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
          t("errors.invalidFormTypeReceived", { jtype }),
        );
        setLoading(false);
        return;
      }

      if (!journalId) {
        setEntryError(t("errors.journalIdMissing"));
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
            setEntryError(t("errors.entryNotFound"));
          } else if (entry.details) {
            const details = entry.details;

            const newCreatedAt = entry.createdAt
              ? entry.createdAt.toDate()
              : null;
            setCreatedAt(newCreatedAt);
            console.log("Fetched estimate entry createdAt:", newCreatedAt);
            const processedDetails = {
              ...details,
              payments:
                details.payments?.map((payment: any) => ({
                  ...payment,
                  date: parseDateField(payment.date),
                  createdAt: parseDateField(payment.createdAt),
                  updatedAt: parseDateField(payment.updatedAt),
                  deletedAt: parseDateField(payment.deletedAt),
                })) || [],
            };

            const validation =
              estimateDetailsStateSchema.safeParse(processedDetails);

            if (!validation.success) {
              console.error(
                "Fetched estimate details failed validation:",
                validation.error.format(),
              );
              setEntryError(t("errors.loadedDataInvalid"));
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
              setPayments((validData.payments as Payment[]) || []);
            }
          }
        } catch (error) {
          console.error("Error loading estimate entry:", error);
          setEntryError(t("errors.failedToLoadDetails"));
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
        setPayments([]);
        setLoading(false);
        setCanUpdate(true); // Allow creating a new estimate
        setCreatedAt(new Date()); // Set created date for new estimate
      }
    }

    loadEntryData();
  }, [journalId, initialEntryId, jtype, START_STATE, t]);

  const validateCustomer = async () => {
    if (customerRef.current) {
      const isValid = await customerRef.current.validate();
      if (!isValid) {
        toast({
          description: t("errors.correctCustomerDetails"),
          variant: "destructive",
        });
        setIsSaving(false);
        return false;
      }
    } else {
      toast({
        description: t("errors.validateCustomerFailed"),
        variant: "destructive",
      });
      setIsSaving(false);
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
      toast({
        description: t("errors.invalidEstimateData"),
        variant: "destructive",
      });
      return null;
    }

    return {
      jid: journalId,
      entryType: ESTIMATE_ENTRY_TYPE,
      name: t("estimateForCustomer", {
        name: detailsValidation.data.customer.name || t("unknownCustomer"),
      }),
      details: detailsValidation.data,
      ...(entryId && { entryId }),
    };
  };

  const handleSaveSuccess = (
    result: { data?: { id?: string } } | unknown,
    validatedDetails: estimateDetailsState,
  ) => {
    const returnedId = (result as { data?: { id?: string } })?.data?.id;
    if (returnedId && !entryId) {
      setEntryId(returnedId);
      const url = new URL(window.location.href);
      url.searchParams.set("eid", returnedId);
      router.replace(url.toString(), { scroll: false });
    }
    toast({
      description: t("estimateSaved", {
        name: validatedDetails.customer.name || t("unknownCustomer"),
      }),
    });
    setIsSaving(false);
    return true;
  };

  const handleSaveError = (error: unknown) => {
    console.error("Error saving estimate:", error);
    const errorMessage =
      error instanceof Error ? error.message : t("errors.couldNotSave");
    toast({
      description: t("errors.saveFailed", { message: errorMessage }),
      variant: "destructive",
    });
    setIsSaving(false);
    return false;
  };

  const handleSave = useCallback(
    async (updates: Partial<estimateDetailsState> = {}): Promise<boolean> => {
      if (jtype !== ESTIMATE_ENTRY_TYPE) {
        toast({
          description: t("errors.incorrectFormType"),
          variant: "destructive",
        });
        return false;
      }
      if (isSaving || !journalId || !journalCurrency) {
        if (!journalCurrency) {
          toast({
            description: t("errors.currencyNotSet"),
            variant: "destructive",
          });
        }
        return false;
      }
      setIsSaving(true);

      try {
        if (!(await validateCustomer())) {
          return false;
        }

        const payload = buildPayload(updates);
        if (!payload) {
          setIsSaving(false);
          return false;
        }

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
      payments,
      router,
      buildPayload,
      handleSaveSuccess,
      t,
    ],
  );

  const addConfirmedItem = async (items: LineItem[]) => {
    let currentItems = [...confirmedItems];

    // Handle updates and additions from the input `items`
    items.forEach((item) => {
      const existingIndex = currentItems.findIndex((i) => i.id === item.id);
      if (existingIndex !== -1) {
        // If a lone item is updated, remove its old children
        if (items.length === 1) {
          currentItems = currentItems.filter((i) => i.parentId !== item.id);
        }
        currentItems[existingIndex] = item;
      } else {
        // if parentID is != root, add the child item right after its parent
        if (item.parentId) {
          const parentIndex = currentItems.findIndex(
            (i) => i.id === item.parentId,
          );
          if (parentIndex !== -1) {
            currentItems.splice(parentIndex + 1, 0, item);
            return; // Skip pushing to the end
          }
        }
        currentItems.push(item);
      }
    });

    const success = await handleSave({ confirmedItems: currentItems });
    if (success) {
      setConfirmedItems(currentItems);
      setEditingItem(null); // Clear editing state on success
    }
    return success;
  };

  const removeConfirmedItem = (id: string) => {
    // remove edited item if it's being deleted
    if (editingItem && editingItem.id === id) {
      setEditingItem(null);
    }

    const newItems = confirmedItems.filter(
      (item) => item.id !== id && item.parentId !== id,
    );
    setConfirmedItems(newItems);
    handleSave({ confirmedItems: newItems });
  };

  const editItem = (item: LineItem) => {
    // Prevent editing if already editing or saving
    if (isSaving || editingItem) {
      return;
    }
    setEditingItem(item);
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const handleStatusChange = (newStatus: WorkStatus) => {
    setStatus(newStatus);
    handleSave({ status: newStatus });
  };

  const calculateSubtotal = useCallback(() => {
    console.debug("Calculating subtotal for items:", confirmedItems);
    return confirmedItems.reduce(
      (sum, item) =>
        sum +
        (item.quantity || 0) *
        (item.material?.unitPrice ? Number(item.material.unitPrice) : 0),
      0,
    );
  }, [confirmedItems]);

  const itemSubtotal = useMemo(() => calculateSubtotal(), [calculateSubtotal]);

  const calculateAdjustmentAmount = useCallback(
    (adjustment: Adjustment): number => {
      if (!adjustment || typeof adjustment.value !== "number") return 0;
      const value = adjustment.value;
      const calculations = {
        addFixed: () => value || 0,
        addPercent: () => ((itemSubtotal || 0) * value) / 100,
        discountFixed: () => -(value || 0),
        discountPercent: () => -((itemSubtotal || 0) * value) / 100,
        taxPercent: () => 0,
      };
      return calculations[adjustment.type]?.() ?? 0;
    },
    [itemSubtotal],
  );

  const totalAdjustments = useMemo(
    () =>
      adjustments.reduce(
        (sum, adjustment) =>
          sum + (calculateAdjustmentAmount(adjustment) || 0),
        0,
      ),
    [adjustments, calculateAdjustmentAmount],
  );

  const { totalBeforeTax, taxAmount, grandTotal } = useMemo(() => {
    const totalBeforeTax = (itemSubtotal || 0) + (totalAdjustments || 0);
    const taxAmount = ((totalBeforeTax || 0) * (taxPercentage || 0)) / 100;
    return {
      totalBeforeTax,
      taxAmount,
      grandTotal: totalBeforeTax + taxAmount,
    };
  }, [itemSubtotal, totalAdjustments, taxPercentage]);

  const activePayments = useMemo(
    () => payments.filter((p) => !p.deletedAt && !p.isDeleted),
    [payments],
  );

  const totalPaid = useMemo(
    () => activePayments.reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [activePayments],
  );

  const balanceDue = useMemo(
    () => grandTotal - totalPaid,
    [grandTotal, totalPaid],
  );

  const currencyFormat = useCallback(
    (amount: number) => {
      return journalCurrency
        ? formatCurrency(amount, journalCurrency)
        : amount.toFixed(2);
    },
    [journalCurrency],
  );

  const handleAddPayment = async (payment: Payment): Promise<boolean> => {
    const newPayment: Payment = {
      ...payment,
      id: payment.id || crypto.randomUUID(),
      createdAt: payment.createdAt || new Date(),
      createdBy: authUser?.email || authUser?.uid || null,
      isDeleted: false,
    };
    const updatedPayments = [...payments, newPayment];
    setPayments(updatedPayments);
    const success = await handleSave({ payments: updatedPayments });
    if (success) {
      toast({ description: tPayments("paymentSaved") });
    }
    return success;
  };

  const handleUpdatePayment = async (updatedPayment: Payment): Promise<boolean> => {
    const updatedPayments = payments.map((p) =>
      p.id === updatedPayment.id
        ? {
            ...p,
            ...updatedPayment,
            updatedAt: new Date(),
            updatedBy: authUser?.email || authUser?.uid || null,
          }
        : p,
    );
    setPayments(updatedPayments);
    const success = await handleSave({ payments: updatedPayments });
    if (success) {
      toast({ description: tPayments("paymentUpdated") });
    }
    return success;
  };

  const handleDeletePayment = async (paymentId: string): Promise<boolean> => {
    const updatedPayments = payments.map((p) =>
      p.id === paymentId
        ? {
            ...p,
            deletedAt: new Date(),
            deletedBy: authUser?.email || authUser?.uid || null,
            isDeleted: true,
          }
        : p,
    );
    setPayments(updatedPayments);
    const success = await handleSave({ payments: updatedPayments });
    if (success) {
      toast({ description: tPayments("paymentDeleted") });
    }
    return success;
  };

  const handleRestorePayment = async (paymentId: string): Promise<boolean> => {
    const updatedPayments = payments.map((p) =>
      p.id === paymentId
        ? {
            ...p,
            deletedAt: null,
            deletedBy: null,
            isDeleted: false,
            updatedAt: new Date(),
            updatedBy: authUser?.email || authUser?.uid || null,
          }
        : p,
    );
    setPayments(updatedPayments);
    const success = await handleSave({ payments: updatedPayments });
    if (success) {
      toast({ description: tPayments("paymentRestored") });
    }
    return success;
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
    payments,
    activePayments,
    totalPaid,
    grandTotal,
    itemSubtotal,
    totalAdjustments,
    taxAmount,
    balanceDue,
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
    setPayments,
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
  };
};
