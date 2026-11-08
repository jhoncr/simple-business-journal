// Tests for the pure payment-math helpers (backend/functions/src/common/payment-math.ts).
// These mirror the frontend totals math so the server can enforce invariants.
// Run via: npm test  (builds, then node --test tests/)
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeGrandTotal,
  totalPaidFor,
  MONEY_EPSILON,
} = require('../lib/common/payment-math');

test('computes grand total: subtotal + adjustments + tax', () => {
  const details = {
    confirmedItems: [
      { quantity: 2, material: { unitPrice: 100 } },
      { quantity: 1, material: { unitPrice: 50 } },
    ],
    adjustments: [
      { type: 'discountPercent', value: 10 }, // -25
      { type: 'addFixed', value: 5 }, // +5
      { type: 'taxPercent', value: 99 }, // ignored here; taxPercentage drives tax
    ],
    taxPercentage: 10,
  };
  // subtotal 250, adjustments -20, beforeTax 230, tax 23 -> 253
  assert.equal(computeGrandTotal(details), 253);
});

test('handles empty / partial details', () => {
  assert.equal(computeGrandTotal({}), 0);
  assert.equal(computeGrandTotal({ confirmedItems: null }), 0);
  assert.equal(
    computeGrandTotal({ confirmedItems: [{ quantity: 3 }] }),
    0,
  );
});

test('totalPaidFor ignores voided payments', () => {
  const payments = [
    { amount: 100 },
    { amount: 50, isDeleted: true },
    { amount: 25, deletedAt: new Date() },
    { amount: null },
  ];
  assert.equal(totalPaidFor(payments), 100);
});

test('MONEY_EPSILON is a small positive tolerance', () => {
  assert.ok(MONEY_EPSILON > 0 && MONEY_EPSILON < 1);
});
