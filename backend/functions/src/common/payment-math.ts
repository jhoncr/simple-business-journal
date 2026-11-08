// backend/functions/src/common/payment-math.ts
//
// Pure money-math helpers shared by bg-payments.ts and unit tests.
// NOTE: amounts are still IEEE-754 floats (a follow-up migration to integer
// minor units is planned); comparisons use a small epsilon.

/** Tolerance for float comparison of money. */
export const MONEY_EPSILON = 0.01;

export type ItemLike = {
  quantity?: number | null;
  material?: { unitPrice?: number | null } | null;
};

export type AdjustmentLike = {
  type?: string;
  value?: number | null;
};

export type DetailsLike = {
  confirmedItems?: ItemLike[] | null;
  adjustments?: AdjustmentLike[] | null;
  taxPercentage?: number | null;
};

/**
 * Computes the estimate grand total. Mirrors the frontend math in
 * `useEstimate.ts` (calculateSubtotal / calculateAdjustmentAmount) so the
 * server can enforce the no-overpay invariant.
 */
export function computeGrandTotal(details: DetailsLike): number {
  const items = details.confirmedItems ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.material?.unitPrice || 0),
    0,
  );
  const adjustments = details.adjustments ?? [];
  const adjustmentsTotal = adjustments.reduce((sum, adj) => {
    const value = typeof adj.value === 'number' ? adj.value : 0;
    switch (adj.type) {
      case 'addFixed':
        return sum + value;
      case 'addPercent':
        return sum + (subtotal * value) / 100;
      case 'discountFixed':
        return sum - value;
      case 'discountPercent':
        return sum - (subtotal * value) / 100;
      case 'taxPercent':
      default:
        // taxPercent is applied via taxPercentage below, like the frontend.
        return sum;
    }
  }, 0);
  const beforeTax = subtotal + adjustmentsTotal;
  const tax = (beforeTax * (details.taxPercentage || 0)) / 100;
  return beforeTax + tax;
}

export type PaymentLike = {
  amount?: number | null;
  isDeleted?: boolean | null;
  deletedAt?: unknown;
};

/** Sum of non-voided payment amounts. */
export function totalPaidFor(payments: PaymentLike[]): number {
  return payments
    .filter((p) => !p.isDeleted && !p.deletedAt)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}
