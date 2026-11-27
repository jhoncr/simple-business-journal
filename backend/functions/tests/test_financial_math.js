// backend/functions/tests/test_financial_math.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { computeGrandTotal, totalPaidFor } = require('../lib/common/payment-math');

// Load and transpile frontend/src/lib/financials.ts
function loadFinancials() {
  const filePath = path.resolve(__dirname, '../../../frontend/src/lib/financials.ts');
  const code = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('exports', 'module', 'require', transpiled);
  fn(mod.exports, mod, (modName) => {
    if (modName.includes('estimate_schema')) {
      return require('../lib/common/schemas/estimate_schema');
    }
    return require(modName);
  });
  return mod.exports;
}

const financials = loadFinancials();

test('calculateLineItemTotal calculates item and optional labor totals', () => {
  const item = { quantity: 3, material: { unitPrice: 50 } };
  assert.equal(financials.calculateLineItemTotal(item), 150);

  const labor = { quantity: 1, material: { unitPrice: 75 } };
  assert.equal(financials.calculateLineItemTotal(item, labor), 225);

  // Defensive null handling
  assert.equal(financials.calculateLineItemTotal(null, null), 0);
  assert.equal(financials.calculateLineItemTotal({}, {}), 0);
});

test('calculateSubtotal sums line items correctly', () => {
  const items = [
    { quantity: 2, material: { unitPrice: 100 } },
    { quantity: 3, material: { unitPrice: 40 } },
    { quantity: 1, material: { unitPrice: 15.5 } },
  ];
  assert.equal(financials.calculateSubtotal(items), 335.5);
  assert.equal(financials.calculateSubtotal([]), 0);
  assert.equal(financials.calculateSubtotal(null), 0);
});

test('calculateAdjustmentAmount computes all adjustment types', () => {
  const subtotal = 200;

  assert.equal(financials.calculateAdjustmentAmount({ type: 'addFixed', value: 25 }, subtotal), 25);
  assert.equal(financials.calculateAdjustmentAmount({ type: 'addPercent', value: 10 }, subtotal), 20);
  assert.equal(financials.calculateAdjustmentAmount({ type: 'discountFixed', value: 30 }, subtotal), -30);
  assert.equal(financials.calculateAdjustmentAmount({ type: 'discountPercent', value: 15 }, subtotal), -30);
  assert.equal(financials.calculateAdjustmentAmount({ type: 'taxPercent', value: 8 }, subtotal), 0);
  assert.equal(financials.calculateAdjustmentAmount(null, subtotal), 0);
});

test('calculateAdjustments aggregates multiple adjustments', () => {
  const subtotal = 1000;
  const adjustments = [
    { type: 'discountPercent', value: 10 }, // -100
    { type: 'addFixed', value: 50 },         // +50
    { type: 'discountFixed', value: 20 },    // -20
  ];
  assert.equal(financials.calculateAdjustments(subtotal, adjustments), -70);
  assert.equal(financials.calculateAdjustments(subtotal, []), 0);
  assert.equal(financials.calculateAdjustments(subtotal, null), 0);
});

test('calculateTotalBeforeTax and calculateTax', () => {
  assert.equal(financials.calculateTotalBeforeTax(500, -50), 450);
  assert.equal(financials.calculateTax(450, 10), 45);
  assert.equal(financials.calculateTax(450, 0), 0);
});

test('calculateGrandTotal supports both 2-argument and 3-argument overloads', () => {
  // 3 arguments: (subtotal, adjustmentTotal, taxTotal)
  assert.equal(financials.calculateGrandTotal(500, -50, 45), 495);

  // 2 arguments: (totalBeforeTax, taxTotal)
  assert.equal(financials.calculateGrandTotal(450, 45), 495);
});

test('getActivePayments and calculatePaymentsTotal filter voided payments', () => {
  const payments = [
    { id: '1', amount: 100 },
    { id: '2', amount: 50, isDeleted: true },
    { id: '3', amount: 75, deletedAt: new Date() },
    { id: '4', amount: 200 },
  ];

  const active = financials.getActivePayments(payments);
  assert.equal(active.length, 2);
  assert.equal(financials.calculatePaymentsTotal(payments), 300);
  assert.equal(financials.calculatePaymentsTotal([]), 0);
  assert.equal(financials.calculatePaymentsTotal(null), 0);
});

test('calculateBalanceDue handles unpaid, exact, and overpaid balances', () => {
  assert.equal(financials.calculateBalanceDue(1000, 400), 600, 'Partial balance due');
  assert.equal(financials.calculateBalanceDue(1000, 1000), 0, 'Zero balance due when fully paid');
  assert.equal(financials.calculateBalanceDue(1000, 1200), -200, 'Negative balance due on overpayment (credit)');
});

test('getPaymentStatus returns accurate payment status including overpayment credit', () => {
  // 0 active payments
  assert.equal(financials.getPaymentStatus(0, 0, 1000), 'unpaid');

  // Partial payment
  assert.equal(financials.getPaymentStatus(1, 400, 1000), 'partial');

  // Exact payment
  assert.equal(financials.getPaymentStatus(1, 1000, 1000), 'paid');

  // Overpayment (credit status)
  assert.equal(financials.getPaymentStatus(1, 1200, 1000), 'credit');
  assert.equal(financials.getPaymentStatus(1, 50, 0), 'credit', 'Payment on 0 grand total');
});

test('calculateEstimateFinancials composite helper calculates complete financial summary', () => {
  const input = {
    items: [
      { quantity: 2, material: { unitPrice: 200 } }, // 400
      { quantity: 1, material: { unitPrice: 100 } }, // 100
    ],
    adjustments: [
      { type: 'discountPercent', value: 10 }, // -50
      { type: 'addFixed', value: 25 },         // +25
    ],
    taxPercentage: 10,
    payments: [
      { amount: 200 },
      { amount: 50, isDeleted: true },
      { amount: 100 },
    ],
  };

  const res = financials.calculateEstimateFinancials(input);

  // Subtotal = 500
  assert.equal(res.itemSubtotal, 500);
  // Total adjustments = -25
  assert.equal(res.totalAdjustments, -25);
  // Total before tax = 475
  assert.equal(res.totalBeforeTax, 475);
  // Tax = 47.5
  assert.equal(res.taxAmount, 47.5);
  // Grand total = 522.5
  assert.equal(res.grandTotal, 522.5);
  // Active payments count = 2
  assert.equal(res.activePayments.length, 2);
  // Total paid = 300
  assert.equal(res.totalPaid, 300);
  // Balance due = 222.5
  assert.equal(res.balanceDue, 222.5);
});

test('parity with backend payment-math.ts computeGrandTotal', () => {
  const estimateDetails = {
    confirmedItems: [
      { quantity: 5, material: { unitPrice: 80 } }, // 400
      { quantity: 2, material: { unitPrice: 150 } }, // 300
    ],
    adjustments: [
      { type: 'discountPercent', value: 5 }, // -35
      { type: 'addFixed', value: 15 },       // +15
    ],
    taxPercentage: 8.875,
    payments: [
      { amount: 250 },
      { amount: 100, isDeleted: true },
      { amount: 500 },
    ],
  };

  const backendGrandTotal = computeGrandTotal(estimateDetails);
  const frontendSummary = financials.calculateEstimateFinancials({
    items: estimateDetails.confirmedItems,
    adjustments: estimateDetails.adjustments,
    taxPercentage: estimateDetails.taxPercentage,
    payments: estimateDetails.payments,
  });

  assert.equal(frontendSummary.grandTotal, backendGrandTotal);
  assert.equal(frontendSummary.totalPaid, totalPaidFor(estimateDetails.payments));
});
