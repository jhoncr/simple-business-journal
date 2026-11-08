import {
  LineItem,
  Adjustment,
  Payment,
} from "@backend/common/schemas/estimate_schema";

export const MONEY_EPSILON = 0.01;

export function calculateLineItemTotal(
  item?: LineItem | null,
  laborItem?: LineItem | null,
): number {
  const qty = item?.quantity ?? 0;
  const price = item?.material?.unitPrice ? Number(item.material.unitPrice) : 0;
  const itemTotal = qty * price;

  const laborQty = laborItem?.quantity ?? 0;
  const laborPrice = laborItem?.material?.unitPrice ? Number(laborItem.material.unitPrice) : 0;
  const laborTotal = laborQty * laborPrice;

  return Number((itemTotal + laborTotal).toFixed(2));
}

export function calculateSubtotal(items?: LineItem[] | null): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const qty = item?.quantity ?? 0;
    const price = item?.material?.unitPrice ? Number(item.material.unitPrice) : 0;
    return sum + qty * price;
  }, 0);
}

export function calculateAdjustmentAmount(
  adjustment?: Adjustment | null,
  subtotal: number = 0,
): number {
  if (!adjustment || typeof adjustment.value !== "number") return 0;
  const value = adjustment.value || 0;
  switch (adjustment.type) {
    case "addFixed":
      return value;
    case "addPercent":
      return ((subtotal || 0) * value) / 100;
    case "discountFixed":
      return -value;
    case "discountPercent":
      return -(((subtotal || 0) * value) / 100);
    case "taxPercent":
      return 0;
    default:
      return 0;
  }
}

export function calculateAdjustments(
  subtotal: number,
  adjustments?: Adjustment[] | null,
): number {
  if (!adjustments || !Array.isArray(adjustments)) return 0;
  return adjustments.reduce(
    (sum, adj) => sum + calculateAdjustmentAmount(adj, subtotal),
    0,
  );
}

export function calculateTotalBeforeTax(
  subtotal: number = 0,
  adjustmentTotal: number = 0,
): number {
  return (subtotal || 0) + (adjustmentTotal || 0);
}

export function calculateTax(
  taxableAmount: number = 0,
  taxRate: number = 0,
): number {
  return ((taxableAmount || 0) * (taxRate || 0)) / 100;
}

export function calculateGrandTotal(
  arg1: number = 0,
  arg2: number = 0,
  arg3?: number,
): number {
  if (arg3 !== undefined) {
    // 3 args: (subtotal, adjustmentTotal, taxTotal)
    return (arg1 || 0) + (arg2 || 0) + (arg3 || 0);
  }
  // 2 args: (totalBeforeTax, taxTotal)
  return (arg1 || 0) + (arg2 || 0);
}

export function getActivePayments<
  T extends { deletedAt?: unknown; isDeleted?: boolean | null }
>(payments?: T[] | null): T[] {
  if (!payments || !Array.isArray(payments)) return [];
  return payments.filter((p) => !p?.deletedAt && !p?.isDeleted);
}

export function calculatePaymentsTotal(payments?: Payment[] | null): number {
  const active = getActivePayments(payments);
  return active.reduce((sum, p) => sum + (p?.amount || 0), 0);
}

export function calculateBalanceDue(
  grandTotal: number = 0,
  totalPaid: number = 0,
): number {
  return (grandTotal || 0) - (totalPaid || 0);
}

export type PaymentStatus = "unpaid" | "credit" | "paid" | "partial";

export function getPaymentStatus(
  activePaymentsCount: number,
  totalPaid: number,
  grandTotal: number,
): PaymentStatus {
  if (activePaymentsCount === 0) return "unpaid";
  const roundedPaid = Math.round((totalPaid || 0) * 100) / 100;
  const roundedTotal = Math.round((grandTotal || 0) * 100) / 100;
  if (roundedPaid > roundedTotal) return "credit";
  if (roundedPaid >= roundedTotal && roundedTotal > 0) return "paid";
  return "partial";
}

export interface EstimateFinancialsInput {
  items?: LineItem[] | null;
  adjustments?: Adjustment[] | null;
  taxPercentage?: number | null;
  payments?: Payment[] | null;
}

export interface EstimateFinancials {
  itemSubtotal: number;
  totalAdjustments: number;
  totalBeforeTax: number;
  taxAmount: number;
  grandTotal: number;
  activePayments: Payment[];
  totalPaid: number;
  balanceDue: number;
}

export function calculateEstimateFinancials({
  items = [],
  adjustments = [],
  taxPercentage = 0,
  payments = [],
}: EstimateFinancialsInput): EstimateFinancials {
  const itemSubtotal = calculateSubtotal(items);
  const totalAdjustments = calculateAdjustments(itemSubtotal, adjustments);
  const totalBeforeTax = calculateTotalBeforeTax(itemSubtotal, totalAdjustments);
  const taxAmount = calculateTax(totalBeforeTax, taxPercentage || 0);
  const grandTotal = calculateGrandTotal(itemSubtotal, totalAdjustments, taxAmount);
  const activePayments = getActivePayments(payments);
  const totalPaid = calculatePaymentsTotal(payments);
  const balanceDue = calculateBalanceDue(grandTotal, totalPaid);

  return {
    itemSubtotal,
    totalAdjustments,
    totalBeforeTax,
    taxAmount,
    grandTotal,
    activePayments,
    totalPaid,
    balanceDue,
  };
}

export const calculateItemSubtotal = calculateSubtotal;
export const calculateTotalAdjustments = (
  adjustments?: Adjustment[] | null,
  subtotal: number = 0,
) => calculateAdjustments(subtotal, adjustments);
export const calculateTaxAmount = calculateTax;
export const calculateTotalPaid = calculatePaymentsTotal;
