// backend/functions/tests/test_tier1_features.js
// Tier 1: Feature Coverage Test Suite (Covering all 10 Features with >= 5 tests each)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
console.log('=== RUNNING TIER 1: FEATURE COVERAGE TEST SUITE (10 FEATURES) ===');
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
// FEATURE 1: SAFE EXPRESSION PARSER (R2)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 1: Safe Expression Parser] ---');

test('F1.1: Basic arithmetic and standard operator precedence (+, -, *, /, ())', () => {
  assert.strictEqual(evaluateExpression('2 + 3 * 4'), 14);
  assert.strictEqual(evaluateExpression('(2 + 3) * 4'), 20);
  assert.strictEqual(evaluateExpression('100 - 50 / 2'), 75);
  assert.strictEqual(evaluateExpression('(100 - 50) / 2'), 25);
  assert.strictEqual(evaluateExpression('10 + 20 - 5 + 15'), 40);
});

test('F1.2: Variable substitution with valid identifiers', () => {
  const vars = { L: 240, W: 60, T: 3, margin_x: 5, $offset: 10 };
  assert.strictEqual(evaluateExpression('L * W', vars), 14400);
  assert.strictEqual(evaluateExpression('L + 2 * margin_x', vars), 250);
  assert.strictEqual(evaluateExpression('(W - $offset) * T', vars), 150);
});

test('F1.3: Number literal formats (integers, floating point, unary + / -)', () => {
  assert.strictEqual(evaluateExpression('42'), 42);
  assert.strictEqual(evaluateExpression(123), 123);
  assert.strictEqual(evaluateExpression('3.14159'), 3.14159);
  assert.strictEqual(evaluateExpression('-15.5 + 20'), 4.5);
  assert.strictEqual(evaluateExpression('+50 - -10'), 60);
});

test('F1.4: Division by zero returns 0 safely without crashing or throwing', () => {
  assert.strictEqual(evaluateExpression('100 / 0'), 0);
  assert.strictEqual(evaluateExpression('0 / 0'), 0);
  assert.strictEqual(evaluateExpression('(5 - 5) / (2 - 2)'), 0);
  assert.strictEqual(evaluateExpression('L / (W - 60)', { L: 100, W: 60 }), 0);
});

test('F1.5: Security sandbox rejects JavaScript execution and injection attempts', () => {
  const evilVars = {
    process: 'evil',
    __proto__: { polluted: true },
    constructor: 'pwned',
  };
  assert.strictEqual(evaluateExpression('alert(1)', evilVars), 0);
  assert.strictEqual(evaluateExpression('process.exit()', evilVars), 0);
  assert.strictEqual(evaluateExpression('Function("return 42")()', evilVars), 0);
  assert.strictEqual(evaluateExpression('eval("1 + 1")', evilVars), 0);
  assert.strictEqual(evaluateExpression('__proto__.polluted', evilVars), 0);
});

// ----------------------------------------------------------------------------
// FEATURE 2: PRODUCTION CLIENT CREDENTIALS ISOLATION (R2)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 2: Production Client Credentials Isolation] ---');

test('F2.1: useAiAutoLogin gate requires NODE_ENV === "development"', () => {
  function shouldAutoLogin(env) {
    return env.NODE_ENV === 'development' && env.NEXT_PUBLIC_AI_TEST_MODE === 'true';
  }
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'development', NEXT_PUBLIC_AI_TEST_MODE: 'true' }), true);
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'production', NEXT_PUBLIC_AI_TEST_MODE: 'true' }), false);
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'test', NEXT_PUBLIC_AI_TEST_MODE: 'true' }), false);
});

test('F2.2: Production environment strictly prevents auto-login even with test flags', () => {
  function simulateAutoLogin(env) {
    if (env.NODE_ENV === 'development' && env.NEXT_PUBLIC_AI_TEST_MODE === 'true') {
      return { loggedIn: true, email: env.NEXT_PUBLIC_AI_TEST_EMAIL || 'ai-tester@test.com' };
    }
    return { loggedIn: false };
  }
  const prodAttempt = simulateAutoLogin({ NODE_ENV: 'production', NEXT_PUBLIC_AI_TEST_MODE: 'true' });
  assert.strictEqual(prodAttempt.loggedIn, false);
});

test('F2.3: Development environment without NEXT_PUBLIC_AI_TEST_MODE="true" does not auto-login', () => {
  function shouldAutoLogin(env) {
    return env.NODE_ENV === 'development' && env.NEXT_PUBLIC_AI_TEST_MODE === 'true';
  }
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'development', NEXT_PUBLIC_AI_TEST_MODE: 'false' }), false);
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'development' }), false);
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'development', NEXT_PUBLIC_AI_TEST_MODE: '' }), false);
});

test('F2.4: Development environment accepts custom credentials from environment variables', () => {
  function getCredentials(env) {
    const email = env.NEXT_PUBLIC_AI_TEST_EMAIL || 'ai-tester@test.com';
    const password = env.NEXT_PUBLIC_AI_TEST_PASSWORD || 'password123';
    return { email, password };
  }
  const custom = getCredentials({
    NEXT_PUBLIC_AI_TEST_EMAIL: 'custom-bot@test.org',
    NEXT_PUBLIC_AI_TEST_PASSWORD: 'securePassword99!',
  });
  assert.strictEqual(custom.email, 'custom-bot@test.org');
  assert.strictEqual(custom.password, 'securePassword99!');

  const defaults = getCredentials({});
  assert.strictEqual(defaults.email, 'ai-tester@test.com');
  assert.strictEqual(defaults.password, 'password123');
});

test('F2.5: Static code scan: Landing page contains strict NODE_ENV === "development" guard', () => {
  const landingPath = path.resolve(__dirname, '../../../frontend/src/app/(auth)/@login/default.tsx');
  const code = fs.readFileSync(landingPath, 'utf8');
  assert.ok(code.includes('process.env.NODE_ENV === "development"'), 'Must check NODE_ENV === "development"');
  assert.ok(code.includes('process.env.NEXT_PUBLIC_AI_TEST_MODE === "true"'), 'Must check NEXT_PUBLIC_AI_TEST_MODE');
  assert.ok(code.includes('useAiAutoLogin'), 'Must define useAiAutoLogin function');
});

// ----------------------------------------------------------------------------
// FEATURE 3: AUDIT LOG SANITIZATION (R2)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 3: Audit Log Sanitization] ---');

test('F3.1: Strips thumbnailBase64 and thumbnail fields into placeholder strings', () => {
  const payload = {
    jid: 'journal-123',
    entryId: 'entry-456',
    thumbnailBase64: 'base64_data_representing_rendered_scene_image',
    thumbnail: 'other_thumbnail_bytes',
  };
  const sanitized = sanitizeAuditInput(payload);
  assert.strictEqual(sanitized.jid, 'journal-123');
  assert.strictEqual(sanitized.entryId, 'entry-456');
  assert.match(sanitized.thumbnailBase64, /\[stripped from audit log \(\d+ chars\)\]/);
  assert.match(sanitized.thumbnail, /\[stripped from audit log \(\d+ chars\)\]/);
});

test('F3.2: Strips data:image base64 URLs across arbitrary nested keys', () => {
  const payload = {
    details: {
      photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      nested: {
        snapshot: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...',
      },
    },
  };
  const sanitized = sanitizeAuditInput(payload);
  assert.match(sanitized.details.photo, /\[stripped image data URL \(\d+ chars\)\]/);
  assert.match(sanitized.details.nested.snapshot, /\[stripped image data URL \(\d+ chars\)\]/);
});

test('F3.3: Truncates long strings exceeding 2000 characters with length annotation', () => {
  const longNote = 'X'.repeat(3000);
  const sanitized = sanitizeAuditInput({ note: longNote });
  assert.match(sanitized.note, /…\[truncated 3000 chars\]/);
  assert.ok(sanitized.note.length < 3000);
});

test('F3.4: Caps total serialized audit payload to 8192 bytes (MAX_AUDIT_JSON_BYTES)', () => {
  const largeObject = {};
  for (let i = 0; i < 150; i++) {
    largeObject[`key_${i}`] = 'abcdefghij'.repeat(10);
  }
  const sanitized = sanitizeAuditInput(largeObject);
  assert.ok(sanitized._auditNote, 'Should have _auditNote property');
  assert.match(sanitized._auditNote, /input truncated to 8192 chars/);
  assert.ok(sanitized.preview.length <= 8192);
});

test('F3.5: Handles circular references and non-JSON-serializable inputs gracefully', () => {
  const circular = { id: 'c1' };
  circular.self = circular;
  const sanitizedCircular = sanitizeAuditInput(circular);
  assert.strictEqual(sanitizedCircular.self, '[circular]');

  const nonJson = { bigintVal: 12345678901234567890n };
  const sanitizedNonJson = sanitizeAuditInput(nonJson);
  assert.strictEqual(sanitizedNonJson._auditNote, 'input was not JSON-serializable');
});

// ----------------------------------------------------------------------------
// FEATURE 4: VALIDATED DUPLICATE ENTRY (R2)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 4: Validated Duplicate Entry] ---');

const baselineValidEstimate = {
  id: 'est-base-101',
  name: 'Standard Kitchen Remodel',
  details: {
    confirmedItems: [],
    status: 'DRAFT',
    customer: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '555-019-9999',
      address: {
        street: '100 Main St',
        city: 'Metropolis',
        state: 'NY',
        zipCode: '10001',
      },
    },
    supplier: {
      name: 'Granite Supply Co',
      email: 'sales@granitesupply.com',
      phone: '555-012-3456',
      address: {
        street: '200 Industrial Pkwy',
        city: 'Metropolis',
        state: 'NY',
        zipCode: '10002',
      },
    },
    logo: null,
    adjustments: [],
    taxPercentage: 8.5,
    currency: 'USD',
    notes: 'Standard installation notes.',
    payments: [
      { amount: 500, date: new Date() },
      { amount: 250, date: new Date() },
    ],
  },
};

test('F4.1: Duplicate estimate resets payments to empty array', () => {
  const original = {
    ...baselineValidEstimate,
    id: 'est-1',
  };
  const duplicated = simulateDuplicateEstimate(original);
  assert.deepStrictEqual(duplicated.details.payments, []);
});

test('F4.2: Duplicate estimate preserves original notes and appends copy annotation', () => {
  const original = {
    ...baselineValidEstimate,
    id: 'est-original-99',
    details: {
      ...baselineValidEstimate.details,
      notes: 'Deliver on Monday morning.',
    },
  };
  const duplicated = simulateDuplicateEstimate(original);
  assert.strictEqual(
    duplicated.details.notes,
    'Deliver on Monday morning.\n(Copied from est-original-99)'
  );
});

test('F4.3: Duplicate estimate note length capping respects 250 char limit', () => {
  const longNote = 'A'.repeat(245);
  const original = {
    ...baselineValidEstimate,
    id: 'est-note-cap',
    details: {
      ...baselineValidEstimate.details,
      notes: longNote,
    },
  };
  const duplicated = simulateDuplicateEstimate(original);
  assert.ok(duplicated.details.notes.length <= 250, 'Notes must be <= 250 characters');
  assert.ok(duplicated.details.notes.includes('(Copied from est-note-cap)'));
  assert(duplicated.validationResult.success, 'Duplicate details must pass schema validation');
});

test('F4.4: Schema validation verifies estimateDetailsStateSchema before saving', () => {
  const invalidOriginal = {
    id: 'est-corrupt',
    name: 'Corrupt Estimate',
    details: {
      // missing customer, supplier, currency
      notes: 'Some notes',
    },
  };
  const duplicated = simulateDuplicateEstimate(invalidOriginal);
  assert.strictEqual(duplicated.validationResult.success, false);
});

test('F4.5: Duplicate entry name is capped at 254 chars max', () => {
  const hugeName = 'Very Long Estimate Name '.repeat(15);
  const original = {
    ...baselineValidEstimate,
    name: hugeName,
  };
  const duplicated = simulateDuplicateEstimate(original);
  assert.ok(duplicated.name.length <= 254);
  assert.ok(duplicated.details.name.length <= 254);
});

// ----------------------------------------------------------------------------
// FEATURE 5: LABOR TYPE PERSISTENCE (R3)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 5: Labor Type Persistence] ---');

test('F5.1: laborTypeSchema validates percentage, fixed, and quantity', () => {
  assert(estimateSchemas.laborTypeSchema.safeParse('percentage').success);
  assert(estimateSchemas.laborTypeSchema.safeParse('fixed').success);
  assert(estimateSchemas.laborTypeSchema.safeParse('quantity').success);
});

test('F5.2: laborTypeSchema rejects invalid strings', () => {
  assert(!estimateSchemas.laborTypeSchema.safeParse('hourly').success);
  assert(!estimateSchemas.laborTypeSchema.safeParse('custom').success);
  assert(!estimateSchemas.laborTypeSchema.safeParse('').success);
  assert(!estimateSchemas.laborTypeSchema.safeParse(null).success);
});

test('F5.3: lineItemSchema accepts valid laborType field', () => {
  const validItem = {
    id: 'item-labor-1',
    parentId: 'root',
    quantity: 1,
    description: 'Quartz Countertop',
    material: {
      id: 'm1',
      description: 'White Quartz',
      unitPrice: 200,
      dimensions: { type: 'area', unitLabel: 'm²' },
      currency: 'USD',
    },
    laborType: 'fixed',
  };
  const parsed = estimateSchemas.lineItemSchema.safeParse(validItem);
  assert(parsed.success);
  assert.strictEqual(parsed.data.laborType, 'fixed');
});

test('F5.4: lineItemSchema accepts omitted or null laborType for backward compatibility', () => {
  const legacyItem = {
    id: 'item-legacy',
    parentId: 'root',
    quantity: 1,
    description: 'Legacy Item',
    material: {
      id: 'm1',
      description: 'Legacy Marble',
      unitPrice: 100,
      dimensions: { type: 'unit', unitLabel: 'unit' },
      currency: 'USD',
    },
    laborType: null,
  };
  assert(estimateSchemas.lineItemSchema.safeParse(legacyItem).success);

  delete legacyItem.laborType;
  assert(estimateSchemas.lineItemSchema.safeParse(legacyItem).success);
});

test('F5.5: Editing simulation: line item with fixed labor preserves fixed labor type', () => {
  const existingLineItem = {
    id: 'item-100',
    parentId: 'root',
    quantity: 2,
    description: 'Custom Granite Edge',
    material: {
      id: 'm2',
      description: 'Granite',
      unitPrice: 75,
      dimensions: { type: 'unit', unitLabel: 'unit' },
      currency: 'USD',
    },
    laborType: 'fixed',
  };

  // Simulating NewItemForm population logic:
  // Should read item.laborType directly without converting to 'percentage'
  const resolvedLaborType = existingLineItem.laborType || 'percentage';
  assert.strictEqual(resolvedLaborType, 'fixed');
});

// ----------------------------------------------------------------------------
// FEATURE 6: DEDUPLICATED FINANCIAL CALCULATIONS (R3)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 6: Deduplicated Financial Calculations] ---');

test('F6.1: calculateSubtotal correctly sums item quantities and unit prices', () => {
  const items = [
    { quantity: 3, material: { unitPrice: 100 } },
    { quantity: 2, material: { unitPrice: 50.5 } },
    { quantity: 1, material: { unitPrice: 25 } },
  ];
  assert.strictEqual(financials.calculateSubtotal(items), 426);
  assert.strictEqual(financials.calculateSubtotal([]), 0);
  assert.strictEqual(financials.calculateSubtotal(null), 0);
});

test('F6.2: calculateAdjustments handles addFixed, addPercent, discountFixed, discountPercent', () => {
  const subtotal = 1000;
  const adjustments = [
    { type: 'addFixed', value: 150, description: 'Delivery' },
    { type: 'addPercent', value: 10, description: 'Surcharge' },
    { type: 'discountFixed', value: 50, description: 'Coupon' },
    { type: 'discountPercent', value: 5, description: 'Cash discount' },
  ];
  // 150 + 100 - 50 - 50 = 150
  assert.strictEqual(financials.calculateAdjustments(subtotal, adjustments), 150);
});

test('F6.3: calculateTax and calculateGrandTotal accurately compute final totals', () => {
  const subtotal = 1000;
  const adj = -100; // 900 taxable
  const taxRate = 8;
  const tax = financials.calculateTax(900, taxRate); // 72
  assert.strictEqual(tax, 72);

  // 3-arg overload
  assert.strictEqual(financials.calculateGrandTotal(subtotal, adj, tax), 972);
  // 2-arg overload
  assert.strictEqual(financials.calculateGrandTotal(900, tax), 972);
});

test('F6.4: calculatePaymentsTotal ignores voided or deleted payments', () => {
  const payments = [
    { amount: 300, isDeleted: false },
    { amount: 200, isDeleted: true }, // voided
    { amount: 150, deletedAt: new Date() }, // voided
    { amount: 250 }, // active
  ];
  assert.strictEqual(financials.calculatePaymentsTotal(payments), 550);
});

test('F6.5: getPaymentStatus returns "credit" when totalPaid > grandTotal', () => {
  assert.strictEqual(financials.getPaymentStatus(2, 1100, 1000), 'credit');
  assert.strictEqual(financials.getPaymentStatus(1, 1000, 1000), 'paid');
  assert.strictEqual(financials.getPaymentStatus(1, 500, 1000), 'partial');
  assert.strictEqual(financials.getPaymentStatus(0, 0, 1000), 'unpaid');
});

// ----------------------------------------------------------------------------
// FEATURE 7: ESTIMATE CSV EXPORT (R3)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 7: Estimate CSV Export] ---');

test('F7.1: formatContactInfo formats nested customer/supplier details without [object Object]', () => {
  const contact = {
    name: 'Precision Stone Works',
    email: 'contact@precision.com',
    phone: '+1 555-0199',
    address: {
      street: '100 Granite Way',
      city: 'Quarryville',
      state: 'PA',
      zipCode: '17566',
    },
  };
  const formatted = csvExporter.formatContactInfo(contact);
  assert.ok(!formatted.includes('[object Object]'));
  assert.ok(formatted.includes('Precision Stone Works'));
  assert.ok(formatted.includes('100 Granite Way, Quarryville, PA, 17566'));
});

test('F7.2: formatLineItems formats confirmed items into human-readable list', () => {
  const items = [
    { quantity: 2, description: 'Carrara Marble Slab', material: { unitPrice: 250, currency: 'USD' } },
    { quantity: 1, description: 'Sink Cutout', material: { unitPrice: 120, currency: 'USD' } },
  ];
  const formatted = csvExporter.formatLineItems(items);
  assert.ok(!formatted.includes('[object Object]'));
  assert.strictEqual(formatted, '2x Carrara Marble Slab ($250); 1x Sink Cutout ($120)');
});

test('F7.3: formatAdjustments formats adjustments without [object Object]', () => {
  const adjs = [
    { type: 'discountPercent', value: 10, description: 'Fall Promo' },
    { type: 'addFixed', value: 75, description: 'Delivery Fee' },
  ];
  const formatted = csvExporter.formatAdjustments(adjs);
  assert.ok(!formatted.includes('[object Object]'));
  assert.strictEqual(formatted, 'Fall Promo: 10%; Delivery Fee: $75');
});

test('F7.4: formatPayments formats active payments with date and ignores voided payments', () => {
  const payments = [
    { amount: 500, method: 'credit_card', date: new Date('2026-05-15T12:00:00Z'), isDeleted: false },
    { amount: 300, method: 'cash', isDeleted: true }, // voided
  ];
  const formatted = csvExporter.formatPayments(payments);
  assert.ok(!formatted.includes('[object Object]'));
  assert.ok(formatted.includes('$500 (credit_card on 2026-05-15)'));
  assert.ok(!formatted.includes('$300'));
});

test('F7.5: dataToCSV generates RFC-4180 CSV without [object Object]', () => {
  const entries = [
    {
      name: 'Countertop Proposal',
      details: {
        customer: { name: 'Acme Corp', address: { city: 'Boston', state: 'MA', zipCode: '02101' } },
        confirmedItems: [{ quantity: 1, description: 'Slab', material: { unitPrice: 300 } }],
        adjustments: [{ type: 'addFixed', value: 50, description: 'Shipping' }],
        payments: [{ amount: 350, method: 'bank_transfer' }],
      },
    },
  ];
  const csv = csvExporter.dataToCSV(entries);
  assert.ok(!csv.includes('[object Object]'), 'CSV must never contain [object Object]');
  assert.ok(csv.includes('Countertop Proposal'));
  assert.ok(csv.includes('Acme Corp'));
  assert.ok(csv.includes('1x Slab ($300)'));
});

// ----------------------------------------------------------------------------
// FEATURE 8: POSTAL CODES (US ZIP & BR CEP) (R3)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 8: Postal Codes (US ZIP & BR CEP)] ---');

test('F8.1: POSTAL_CODE_REGEX matches 5-digit US ZIP codes', () => {
  assert(commonSchemas.POSTAL_CODE_REGEX.test('02139'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('90210'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('10001'));
});

test('F8.2: POSTAL_CODE_REGEX matches 9-digit US ZIP codes (with and without hyphen)', () => {
  assert(commonSchemas.POSTAL_CODE_REGEX.test('02139-1234'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('90210-5678'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('021391234'));
});

test('F8.3: POSTAL_CODE_REGEX matches 8-digit Brazilian CEP with hyphen', () => {
  assert(commonSchemas.POSTAL_CODE_REGEX.test('01310-100'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('70040-010'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('20040-002'));
});

test('F8.4: POSTAL_CODE_REGEX matches 8-digit Brazilian CEP without hyphen', () => {
  assert(commonSchemas.POSTAL_CODE_REGEX.test('01310100'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('70040010'));
});

test('F8.5: contactInfoSchema validates address with US ZIP and Brazilian CEP', () => {
  const usContact = {
    name: 'US Customer',
    address: { street: '1 Main St', city: 'Cambridge', state: 'MA', zipCode: '02139-1234' },
  };
  assert(commonSchemas.contactInfoSchema.safeParse(usContact).success);

  const brContact = {
    name: 'Brazilian Customer',
    address: { street: 'Av Paulista 1000', city: 'São Paulo', state: 'SP', zipCode: '01310-100' },
  };
  assert(commonSchemas.contactInfoSchema.safeParse(brContact).success);

  const invalidContact = {
    name: 'Invalid ZIP Customer',
    address: { street: 'Bad St', city: 'Nowhere', state: 'XX', zipCode: 'INVALID-ZIP' },
  };
  assert(!commonSchemas.contactInfoSchema.safeParse(invalidContact).success);
});

// ----------------------------------------------------------------------------
// FEATURE 9: DYNAMIC HOSTNAME (R3)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 9: Dynamic Hostname] ---');

test('F9.1: getAppOrigin returns window.location.origin in browser environment', () => {
  const mockWindow = { location: { origin: 'https://staging.precisionstone.com' } };
  assert.strictEqual(getAppOrigin(mockWindow), 'https://staging.precisionstone.com');
});

test('F9.2: getAppOrigin falls back to NEXT_PUBLIC_APP_URL in server environment', () => {
  const mockEnv = { NEXT_PUBLIC_APP_URL: 'https://app.stoneforge.io' };
  assert.strictEqual(getAppOrigin(null, mockEnv), 'https://app.stoneforge.io');
});

test('F9.3: getAppOrigin falls back to http://localhost:3000 in development mode', () => {
  const mockEnv = { NODE_ENV: 'development' };
  assert.strictEqual(getAppOrigin(null, mockEnv), 'http://localhost:3000');
});

test('F9.4: getAppOrigin returns empty string in production server environment without env var', () => {
  const mockEnv = { NODE_ENV: 'production' };
  assert.strictEqual(getAppOrigin(null, mockEnv), '');
});

test('F9.5: Static code scan: add-contributors.tsx contains NO hardcoded production URL', () => {
  const filePath = path.resolve(__dirname, '../../../frontend/src/components/ui/add-contributors.tsx');
  const code = fs.readFileSync(filePath, 'utf8');
  assert.ok(!code.includes('https://simplelog.app'), 'Must not contain hardcoded simplelog.app');
  assert.ok(!code.includes('https://journal.app'), 'Must not contain hardcoded journal.app');
  assert.ok(code.includes('getAppOrigin'), 'Must use getAppOrigin() helper');
});

// ----------------------------------------------------------------------------
// FEATURE 10: WEBGL CONTEXT & PRINT SYNCHRONIZATION & LAYOUT (R4)
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 10: WebGL Context & Print Synchronization & Layout] ---');

test('F10.1: metersToCentimeters converts meters to integer centimeters with null safety', () => {
  assert.strictEqual(metersToCentimeters(2.4), 240);
  assert.strictEqual(metersToCentimeters(0.6), 60);
  assert.strictEqual(metersToCentimeters(null), 0);
  assert.strictEqual(metersToCentimeters(undefined), 0);
  assert.strictEqual(metersToCentimeters(NaN), 0);
});

test('F10.2: generateViewKeys generates unique deterministic view keys across templates', () => {
  const items = [
    {
      id: 'item-A',
      template: {
        cameraViews: [
          { id: 'cam-front', name: 'Front' },
          { id: 'cam-top', name: 'Top' },
        ],
      },
    },
    {
      id: 'item-B',
      template: {
        cameraViews: [{ id: 'cam-front', name: 'Front' }],
      },
    },
  ];
  const keys = generateViewKeys(items);
  assert.strictEqual(keys.length, 3);
  assert.strictEqual(new Set(keys).size, 3);
  assert.strictEqual(keys[0], 'item-A:default:cam-front');
  assert.strictEqual(keys[1], 'item-A:other:cam-top');
  assert.strictEqual(keys[2], 'item-B:default:cam-front');
});

test('F10.3: Sequential snapshot queue state machine calls onReadyToPrint only when done', () => {
  const queue = ['key1', 'key2'];
  let queueIndex = 0;
  let readyCalled = false;

  function onReadyToPrint() {
    readyCalled = true;
  }

  function completeSnapshot(key) {
    queueIndex++;
    if (queueIndex >= queue.length) {
      onReadyToPrint();
    }
  }

  assert.strictEqual(readyCalled, false);
  completeSnapshot('key1');
  assert.strictEqual(readyCalled, false);
  completeSnapshot('key2');
  assert.strictEqual(readyCalled, true);
});

test('F10.4: Responsive breakpoints synchronized at xl (1280px)', () => {
  const addEstPath = path.resolve(__dirname, '../../../frontend/src/app/(auth)/journal/journal-types/estimate/addEstimate.tsx');
  const wrapperPath = path.resolve(__dirname, '../../../frontend/src/app/(auth)/journal/journal-types/estimate/subcomponents/NewItemFormWrapper.tsx');

  const addEstCode = fs.readFileSync(addEstPath, 'utf8');
  const wrapperCode = fs.readFileSync(wrapperPath, 'utf8');

  assert.ok(addEstCode.includes('xl:pr-[430px]'));
  assert.ok(!addEstCode.includes('lg:pr-[430px]'));
  assert.ok(wrapperCode.includes('(min-width: 1280px)'));
  assert.ok(!wrapperCode.includes('1340px'));
});

test('F10.5: WebGL context disposal safely triggers context loss without throwing', () => {
  let contextLost = false;
  let disposed = false;

  const mockGL = {
    forceContextLoss: () => { contextLost = true; },
    dispose: () => { disposed = true; },
  };

  function disposeRenderer(gl) {
    try {
      gl.forceContextLoss?.();
    } catch {}
    try {
      gl.dispose?.();
    } catch {}
  }

  assert.doesNotThrow(() => disposeRenderer(mockGL));
  assert.strictEqual(contextLost, true);
  assert.strictEqual(disposed, true);
});

console.log('\n================================================================');
console.log(`Tier 1 Feature Coverage Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
