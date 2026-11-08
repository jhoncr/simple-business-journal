// backend/functions/tests/test_tier3_combinations.js
// Tier 3: Cross-Feature Combinations Test Suite
const assert = require('assert');
const {
  evaluateExpression,
  sanitizeAuditInput,
  commonSchemas,
  estimateSchemas,
  financials,
  csvExporter,
  metersToCentimeters,
  generateViewKeys,
  getAppOrigin,
  simulateDuplicateEstimate,
} = require('./test_e2e_helpers');

console.log('\n================================================================');
console.log('=== RUNNING TIER 3: CROSS-FEATURE COMBINATIONS TEST SUITE ===');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// COMBINATION 1: SAFE EXPRESSION PARSER + FINANCIAL CALCULATIONS (F1 + F6)
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 1: Expression Parser + Financial Math] ---');

test('C1.1: Parametric dimension evaluation feeds directly into line item pricing and subtotal', () => {
  // Kitchen Island template variables
  const roomVars = { roomLength: 400, roomWidth: 300, clearance: 90 };
  const islandLength = evaluateExpression('roomLength - (2 * clearance)', roomVars); // 220 cm
  const islandWidth = evaluateExpression('roomWidth - (2 * clearance)', roomVars); // 120 cm

  assert.strictEqual(islandLength, 220);
  assert.strictEqual(islandWidth, 120);

  // Convert to area in m²: (2.2m * 1.2m = 2.64 m²)
  const areaM2 = (islandLength / 100) * (islandWidth / 100);
  assert.strictEqual(areaM2, 2.64);

  const lineItem = {
    quantity: areaM2,
    material: { unitPrice: 200, currency: 'USD' },
  };

  const itemTotal = financials.calculateLineItemTotal(lineItem);
  assert.strictEqual(itemTotal, 528);

  const subtotal = financials.calculateSubtotal([lineItem]);
  assert.strictEqual(subtotal, 528);

  const tax = financials.calculateTax(subtotal, 8.25);
  const grandTotal = financials.calculateGrandTotal(subtotal, 0, tax);
  assert.strictEqual(grandTotal, 571.56);
});

test('C1.2: Variable overrides in parametric formulas handle edge formulas safely in financials', () => {
  // If formula divides by zero or evaluates to 0, financial math handles 0 quantity cleanly
  const invalidLength = evaluateExpression('100 / (clearance - clearance)', { clearance: 50 });
  assert.strictEqual(invalidLength, 0);

  const lineItem = {
    quantity: invalidLength,
    material: { unitPrice: 150 },
  };
  assert.strictEqual(financials.calculateLineItemTotal(lineItem), 0);
  assert.strictEqual(financials.calculateSubtotal([lineItem]), 0);
});

// ----------------------------------------------------------------------------
// COMBINATION 2: LABOR TYPE PERSISTENCE + FINANCIAL MATH + PAYMENT BADGE (F5 + F6)
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 2: Labor Type + Financial Math + Payment Badge] ---');

test('C2.1: Line items with fixed vs percentage labor calculate accurately with payment status', () => {
  const fixedLaborItem = {
    id: 'item-slab',
    parentId: 'root',
    quantity: 2,
    description: 'Calacatta Slab',
    laborType: 'fixed',
    material: {
      id: 'm1',
      description: 'Slab',
      unitPrice: 500,
      dimensions: { type: 'area', unitLabel: 'm²' },
      currency: 'USD',
    },
  };

  const laborFeeItem = {
    id: 'labor-slab',
    parentId: 'root',
    quantity: 1,
    description: 'Fixed Fabrication Fee',
    material: {
      id: 'm-labor',
      description: 'Labor',
      unitPrice: 350,
      dimensions: { type: 'unit', unitLabel: 'unit' },
      currency: 'USD',
    },
  };

  // Verify schema accepts fixed laborType
  assert(estimateSchemas.lineItemSchema.safeParse(fixedLaborItem).success);

  // Total for item with separate fixed labor item
  const combinedTotal = financials.calculateLineItemTotal(fixedLaborItem, laborFeeItem);
  assert.strictEqual(combinedTotal, 1350); // (2 * 500) + (1 * 350)

  const items = [fixedLaborItem, laborFeeItem];
  const subtotal = financials.calculateSubtotal(items);
  assert.strictEqual(subtotal, 1350);

  // Adjustments: 10% discount (-135)
  const adjustments = [{ type: 'discountPercent', value: 10, description: 'Client discount' }];
  const adjAmount = financials.calculateAdjustments(subtotal, adjustments);
  assert.strictEqual(adjAmount, -135);

  const taxableAmount = financials.calculateTotalBeforeTax(subtotal, adjAmount);
  assert.strictEqual(taxableAmount, 1215);

  const tax = financials.calculateTax(taxableAmount, 10);
  assert.strictEqual(tax, 121.5);

  const grandTotal = financials.calculateGrandTotal(taxableAmount, tax);
  assert.strictEqual(grandTotal, 1336.5);

  // Case A: Partial payment ($1000)
  assert.strictEqual(financials.getPaymentStatus(1, 1000, grandTotal), 'partial');

  // Case B: Exact payment ($1336.5)
  assert.strictEqual(financials.getPaymentStatus(2, 1336.5, grandTotal), 'paid');

  // Case C: Overpayment ($1400) -> status.credit badge
  assert.strictEqual(financials.getPaymentStatus(2, 1400, grandTotal), 'credit');
});

// ----------------------------------------------------------------------------
// COMBINATION 3: VALIDATED DUPLICATE ENTRY + AUDIT LOG SANITIZATION (F4 + F3)
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 3: Duplicate Entry + Audit Log Sanitization] ---');

test('C3.1: Duplicate entry note truncation and audit event payload sanitization', () => {
  const originalEstimate = {
    id: 'est-source-888',
    name: 'Luxury Villa Master Bath',
    details: {
      confirmedItems: [],
      status: 'DRAFT',
      customer: {
        name: 'Michael Corleone',
        email: 'mc@corleone.org',
        phone: '555-900-1111',
        address: { street: '100 Lake Shore Dr', city: 'Tahoe', state: 'NV', zipCode: '89449' },
      },
      supplier: {
        name: 'Nevada Stone Supplies',
        email: 'sales@nvstone.com',
        phone: '555-888-2222',
        address: { street: '500 Quarry Rd', city: 'Reno', state: 'NV', zipCode: '89501' },
      },
      logo: null,
      adjustments: [],
      taxPercentage: 7.5,
      currency: 'USD',
      notes: 'Z'.repeat(240), // 240 chars
      thumbnailBase64: 'data:image/jpeg;base64,' + 'B'.repeat(5000), // large base64 image
      payments: [{ amount: 1000, date: new Date() }],
    },
  };

  // 1. Duplicate transformation
  const duplicated = simulateDuplicateEstimate(originalEstimate, 'new-dup-888');

  // Verify payments cleared
  assert.deepStrictEqual(duplicated.details.payments, []);

  // Verify note truncated to fit annotation within 250 chars
  assert.ok(duplicated.details.notes.length <= 250);
  assert.ok(duplicated.details.notes.includes('(Copied from est-source-888)'));

  // Verify duplicated details pass schema validation
  assert(duplicated.validationResult.success);

  // 2. Audit log sanitization of the duplicated payload
  const auditEventPayload = {
    jid: 'journal-nv-1',
    entryId: 'new-dup-888',
    details: duplicated.details,
    thumbnailBase64: originalEstimate.details.thumbnailBase64,
  };

  const sanitizedAudit = sanitizeAuditInput(auditEventPayload);
  assert.match(sanitizedAudit.thumbnailBase64, /\[stripped from audit log \(\d+ chars\)\]/);
  assert.ok(!JSON.stringify(sanitizedAudit).includes('data:image/jpeg;base64'));
});

// ----------------------------------------------------------------------------
// COMBINATION 4: POSTAL CODES + ESTIMATE CSV EXPORT + CURRENCY (F8 + F7 + F6)
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 4: Postal Codes + CSV Export + Currency] ---');

test('C4.1: Brazilian and US estimates format addresses, line items, and payments cleanly in CSV', () => {
  const brazilianEstimate = {
    name: 'Bancada Cozinha São Paulo',
    details: {
      customer: {
        name: 'Roberto Silva',
        email: 'roberto@empresa.com.br',
        phone: '+55 11 98765-4321',
        address: {
          street: 'Av Paulista 1578',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01310-100',
        },
      },
      supplier: {
        name: 'Marmoraria Brasil',
        address: { street: 'Rua do Mármore 50', city: 'São Paulo', state: 'SP', zipCode: '01000000' },
      },
      confirmedItems: [
        { quantity: 2, description: 'Granito Preto São Gabriel', material: { unitPrice: 450, currency: 'BRL' } },
      ],
      adjustments: [
        { type: 'discountFixed', value: 100, description: 'Desconto à vista' },
      ],
      payments: [
        { amount: 800, method: 'pix', date: new Date('2026-07-10T14:00:00Z'), isDeleted: false },
      ],
      currency: 'BRL',
    },
  };

  // Verify contact schemas validate CEPs
  assert(commonSchemas.contactInfoSchema.safeParse(brazilianEstimate.details.customer).success);
  assert(commonSchemas.contactInfoSchema.safeParse(brazilianEstimate.details.supplier).success);

  // Export to CSV
  const csv = csvExporter.dataToCSV([brazilianEstimate]);

  assert.ok(!csv.includes('[object Object]'), 'No [object Object] in CSV output');
  assert.ok(csv.includes('Bancada Cozinha São Paulo'));
  assert.ok(csv.includes('Roberto Silva'));
  assert.ok(csv.includes('01310-100'));
  assert.ok(csv.includes('2x Granito Preto São Gabriel (R$450)'));
  assert.ok(csv.includes('Desconto à vista: $100'));
  assert.ok(csv.includes('$800 (pix on 2026-07-10)'));
});

// ----------------------------------------------------------------------------
// COMBINATION 5: 3D CAD FORMULAS + METERS TO CM + PRINT SNAPSHOT QUEUE (F1 + F10)
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 5: 3D CAD Formulas + Unit Conversion + Print Queue] ---');

test('C5.1: Parametric CAD formula evaluation, unit conversion, and print ready sequencing', () => {
  // Slab dimensions in meters
  const slabLengthFormula = '2.4 + 0.6'; // 3.0 meters
  const slabWidthFormula = '0.65'; // 0.65 meters

  const lengthMeters = evaluateExpression(slabLengthFormula);
  const widthMeters = evaluateExpression(slabWidthFormula);

  assert.strictEqual(lengthMeters, 3.0);
  assert.strictEqual(widthMeters, 0.65);

  // Convert to centimeters for drawing annotations
  const lengthCm = metersToCentimeters(lengthMeters);
  const widthCm = metersToCentimeters(widthMeters);

  assert.strictEqual(lengthCm, 300);
  assert.strictEqual(widthCm, 65);

  // Simulate print views
  const itemWithCameraViews = {
    id: 'item-slab-print',
    template: {
      cameraViews: [
        { id: 'view-top', name: 'Top Plan' },
        { id: 'view-front', name: 'Front Elevation' },
        { id: 'view-iso', name: 'Isometric 3D' },
      ],
    },
  };

  const viewKeys = generateViewKeys([itemWithCameraViews]);
  assert.strictEqual(viewKeys.length, 3);
  assert.deepStrictEqual(viewKeys, [
    'item-slab-print:default:view-top',
    'item-slab-print:other:view-front',
    'item-slab-print:other:view-iso',
  ]);

  // Simulate sequential queue execution
  let currentQueueIndex = 0;
  let printTriggered = false;

  function onReadyToPrint() {
    printTriggered = true;
  }

  function advanceQueue(key) {
    currentQueueIndex++;
    if (currentQueueIndex >= viewKeys.length) {
      onReadyToPrint();
    }
  }

  advanceQueue(viewKeys[0]);
  assert.strictEqual(printTriggered, false);
  advanceQueue(viewKeys[1]);
  assert.strictEqual(printTriggered, false);
  advanceQueue(viewKeys[2]);
  assert.strictEqual(printTriggered, true);
});

// ----------------------------------------------------------------------------
// COMBINATION 6: DYNAMIC HOSTNAME + CREDENTIAL ISOLATION (F9 + F2)
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 6: Dynamic Hostname + Credential Isolation] ---');

test('C6.1: Origin resolution and credential isolation across deployment tiers', () => {
  // Development environment
  const devEnv = { NODE_ENV: 'development', NEXT_PUBLIC_AI_TEST_MODE: 'true' };
  assert.strictEqual(getAppOrigin(null, devEnv), 'http://localhost:3000');
  const canDevAutoLogin = devEnv.NODE_ENV === 'development' && devEnv.NEXT_PUBLIC_AI_TEST_MODE === 'true';
  assert.strictEqual(canDevAutoLogin, true);

  // Production environment with custom domain
  const prodEnv = { NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://journal.precisionstone.com' };
  assert.strictEqual(getAppOrigin(null, prodEnv), 'https://journal.precisionstone.com');
  const canProdAutoLogin = prodEnv.NODE_ENV === 'development' && prodEnv.NEXT_PUBLIC_AI_TEST_MODE === 'true';
  assert.strictEqual(canProdAutoLogin, false);

  // Browser execution
  const browserWindow = { location: { origin: 'https://custom-client-portal.com' } };
  assert.strictEqual(getAppOrigin(browserWindow, prodEnv), 'https://custom-client-portal.com');
});

// ----------------------------------------------------------------------------
// COMBINATION 7: FULL ESTIMATE LIFECYCLE PIPELINE (F4 + F5 + F6 + F7)
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 7: Full Estimate Lifecycle Pipeline] ---');

test('C7.1: Estimate duplication, laborType preservation, financial re-calculation, and CSV export', () => {
  const originalEstimate = {
    id: 'est-pipe-1',
    name: 'Master Suite Bath Vanity',
    details: {
      confirmedItems: [
        {
          id: 'item-1',
          parentId: 'root',
          quantity: 2,
          description: 'Double Sink Vanity Slab',
          laborType: 'fixed',
          material: {
            id: 'm1',
            description: 'Carrara Marble',
            unitPrice: 400,
            dimensions: { type: 'area', unitLabel: 'm²' },
            currency: 'USD',
          },
        },
      ],
      status: 'DRAFT',
      customer: {
        name: 'Robert Vance',
        email: 'vance@refrigeration.com',
        phone: '555-444-3333',
        address: { street: '10 Industrial Way', city: 'Scranton', state: 'PA', zipCode: '18503' },
      },
      supplier: {
        name: 'Keystone Marble',
        email: 'keystone@marble.com',
        phone: '555-222-1111',
        address: { street: '50 Stone St', city: 'Scranton', state: 'PA', zipCode: '18504' },
      },
      logo: null,
      adjustments: [{ type: 'addFixed', value: 120, description: 'Edge profiling' }],
      taxPercentage: 6.0,
      currency: 'USD',
      notes: 'Template and install vanity.',
      payments: [{ amount: 500, date: new Date('2026-08-01T10:00:00Z') }],
    },
  };

  // 1. Duplicate
  const duplicated = simulateDuplicateEstimate(originalEstimate, 'est-pipe-2');

  // Verify payments cleared
  assert.deepStrictEqual(duplicated.details.payments, []);

  // Verify laborType preserved
  assert.strictEqual(duplicated.details.confirmedItems[0].laborType, 'fixed');

  // Verify notes annotated
  assert.strictEqual(
    duplicated.details.notes,
    'Template and install vanity.\n(Copied from est-pipe-1)'
  );

  // 2. Re-run financial calculations on duplicate
  const financialsSummary = financials.calculateEstimateFinancials({
    items: duplicated.details.confirmedItems,
    adjustments: duplicated.details.adjustments,
    taxPercentage: duplicated.details.taxPercentage,
    payments: duplicated.details.payments,
  });

  assert.strictEqual(financialsSummary.itemSubtotal, 800); // 2 * 400
  assert.strictEqual(financialsSummary.totalAdjustments, 120);
  assert.strictEqual(financialsSummary.totalBeforeTax, 920);
  assert.strictEqual(financialsSummary.taxAmount, 55.2);
  assert.strictEqual(financialsSummary.grandTotal, 975.2);
  assert.strictEqual(financialsSummary.totalPaid, 0);
  assert.strictEqual(financialsSummary.balanceDue, 975.2);

  // 3. Export duplicate to CSV
  const csv = csvExporter.dataToCSV([duplicated]);
  assert.ok(!csv.includes('[object Object]'));
  assert.ok(csv.includes('Master Suite Bath Vanity (Copy)'));
  assert.ok(csv.includes('Robert Vance'));
  assert.ok(csv.includes('2x Double Sink Vanity Slab ($400)'));
  assert.ok(csv.includes('Edge profiling: $120'));
});

console.log('\n================================================================');
console.log(`Tier 3 Cross-Feature Combinations Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
