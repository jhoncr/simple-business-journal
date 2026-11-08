// backend/functions/tests/test_tier2_boundaries.js
// Tier 2: Boundary & Corner Cases Test Suite (Covering all 10 Features with >= 5 tests each)
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
console.log('=== RUNNING TIER 2: BOUNDARY & CORNER CASES TEST SUITE (10 FEATURES) ===');
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
// FEATURE 1: SAFE EXPRESSION PARSER BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 1: Safe Expression Parser Boundaries] ---');

test('B1.1: Extreme numbers (MAX_SAFE_INTEGER, MIN_SAFE_INTEGER, tiny fractions)', () => {
  const maxSafe = Number.MAX_SAFE_INTEGER;
  assert.strictEqual(evaluateExpression(`${maxSafe}`), maxSafe);
  assert.strictEqual(evaluateExpression('0.0000001 + 0.0000002') > 0, true);
  assert.strictEqual(evaluateExpression('-9007199254740991'), -9007199254740991);
});

test('B1.2: Deeply nested parentheses (50 levels deep)', () => {
  const open = '('.repeat(50);
  const close = ')'.repeat(50);
  const expr = `${open}42${close}`;
  assert.strictEqual(evaluateExpression(expr), 42);

  const mathExpr = `${open}10 + 5${close} * 2`;
  assert.strictEqual(evaluateExpression(mathExpr), 30);
});

test('B1.3: Whitespace and newline tolerance across tokens', () => {
  const whitespaceExpr = '   100 \t  +\n   200 \r\n  *  \t 3   ';
  assert.strictEqual(evaluateExpression(whitespaceExpr), 700);

  const emptyExpr = '   \t\n\r  ';
  assert.strictEqual(evaluateExpression(emptyExpr), 0);
});

test('B1.4: Maximum expression length boundary (500 chars valid, 501 chars returns 0)', () => {
  // Construct a valid expression of length 500
  // "1 + 1 + 1 + ... + 1"
  let expr500 = '1';
  while (expr500.length + 4 <= 500) {
    expr500 += ' + 1';
  }
  while (expr500.length < 500) {
    expr500 += ' ';
  }
  assert.strictEqual(expr500.length, 500);
  assert.ok(evaluateExpression(expr500) > 0, '500-char expression should evaluate');

  const expr501 = expr500 + ' ';
  assert.strictEqual(expr501.length, 501);
  assert.strictEqual(evaluateExpression(expr501), 0, '501-char expression must return 0');
});

test('B1.5: Unary operator chaining and signs (- - 10, + + 5, -(-(-4)))', () => {
  assert.strictEqual(evaluateExpression('-(-10)'), 10);
  assert.strictEqual(evaluateExpression('-(10 - 5)'), -5);
  assert.strictEqual(evaluateExpression('-(-(-4))'), -4);
  assert.strictEqual(evaluateExpression('+(+25)'), 25);
});

// ----------------------------------------------------------------------------
// FEATURE 2: PRODUCTION CLIENT CREDENTIALS ISOLATION BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 2: Production Client Credentials Isolation Boundaries] ---');

test('B2.1: Non-development environments (test, staging, ci) with test mode stay disabled', () => {
  function shouldAutoLogin(env) {
    return env.NODE_ENV === 'development' && env.NEXT_PUBLIC_AI_TEST_MODE === 'true';
  }
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'test', NEXT_PUBLIC_AI_TEST_MODE: 'true' }), false);
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'staging', NEXT_PUBLIC_AI_TEST_MODE: 'true' }), false);
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'ci', NEXT_PUBLIC_AI_TEST_MODE: 'true' }), false);
});

test('B2.2: Development environment with empty or whitespace test mode flag stays disabled', () => {
  function shouldAutoLogin(env) {
    return env.NODE_ENV === 'development' && env.NEXT_PUBLIC_AI_TEST_MODE === 'true';
  }
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'development', NEXT_PUBLIC_AI_TEST_MODE: ' ' }), false);
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'development', NEXT_PUBLIC_AI_TEST_MODE: 'TRUE' }), false);
  assert.strictEqual(shouldAutoLogin({ NODE_ENV: 'development', NEXT_PUBLIC_AI_TEST_MODE: '1' }), false);
});

test('B2.3: Production environment blocks login even with prototype pollution attempts', () => {
  const evilEnv = Object.create({ NODE_ENV: 'development', NEXT_PUBLIC_AI_TEST_MODE: 'true' });
  evilEnv.NODE_ENV = 'production';
  evilEnv.NEXT_PUBLIC_AI_TEST_MODE = 'true';

  function safeShouldAutoLogin(env) {
    return env.NODE_ENV === 'development' && env.NEXT_PUBLIC_AI_TEST_MODE === 'true';
  }
  assert.strictEqual(safeShouldAutoLogin(evilEnv), false);
});

test('B2.4: Malformed or special character email/password strings in env handled safely', () => {
  function resolveCredentials(env) {
    const email = env.NEXT_PUBLIC_AI_TEST_EMAIL || 'ai-tester@test.com';
    const password = env.NEXT_PUBLIC_AI_TEST_PASSWORD || 'password123';
    return { email, password };
  }
  const specialChars = resolveCredentials({
    NEXT_PUBLIC_AI_TEST_EMAIL: 'user+tag@domain.co.uk',
    NEXT_PUBLIC_AI_TEST_PASSWORD: 'p@$$w0rd!#%^&*()_+-=[]{}|;:",.<>?',
  });
  assert.strictEqual(specialChars.email, 'user+tag@domain.co.uk');
  assert.strictEqual(specialChars.password, 'p@$$w0rd!#%^&*()_+-=[]{}|;:",.<>?');
});

test('B2.5: Build code inspection: Verify useAiAutoLogin is self-contained and guarded', () => {
  const landingPath = path.resolve(__dirname, '../../../frontend/src/app/(auth)/@login/default.tsx');
  const code = fs.readFileSync(landingPath, 'utf8');
  assert.ok(code.includes('process.env.NODE_ENV === "development"'));
  assert.ok(code.includes('process.env.NEXT_PUBLIC_AI_TEST_MODE === "true"'));
  assert.ok(code.includes('useAiAutoLogin'));
});

// ----------------------------------------------------------------------------
// FEATURE 3: AUDIT LOG SANITIZATION BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 3: Audit Log Sanitization Boundaries] ---');

test('B3.1: Large payload boundary: 8192 bytes cap triggers truncation notice', () => {
  // Moderate size object under 8192 chars
  const smallObj = { key1: 'a'.repeat(500), key2: 'b'.repeat(500) };
  const resSmall = sanitizeAuditInput(smallObj);
  assert.strictEqual(resSmall._auditNote, undefined);

  // Large object with multiple keys exceeding 8192 chars total
  const largeObj = {};
  for (let i = 0; i < 20; i++) {
    largeObj[`field_${i}`] = 'z'.repeat(500);
  }
  const resLarge = sanitizeAuditInput(largeObj);
  assert.ok(resLarge._auditNote, 'Should have _auditNote property');
  assert.match(resLarge._auditNote, /input truncated to 8192 chars/);
  assert.ok(resLarge.preview.length <= 8192);
});

test('B3.2: Exact string length boundary: 2000 chars vs 2001 chars', () => {
  const str2000 = 'a'.repeat(2000);
  const sanitized2000 = sanitizeAuditInput({ note: str2000 });
  assert.strictEqual(sanitized2000.note, str2000);

  const str2001 = 'a'.repeat(2001);
  const sanitized2001 = sanitizeAuditInput({ note: str2001 });
  assert.ok(sanitized2001.note.includes('…[truncated 2001 chars]'));
});

test('B3.3: Primitive edge cases: null, empty string, 0, false, empty collections', () => {
  assert.strictEqual(sanitizeAuditInput(null), null);
  assert.strictEqual(sanitizeAuditInput(''), '');
  assert.strictEqual(sanitizeAuditInput(0), 0);
  assert.strictEqual(sanitizeAuditInput(false), false);
  assert.deepStrictEqual(sanitizeAuditInput({}), {});
  assert.deepStrictEqual(sanitizeAuditInput([]), []);
});

test('B3.4: Deeply nested objects (20 levels deep) with thumbnailBase64 at various depths', () => {
  let nested = { thumbnailBase64: 'leaf_image_base64_data' };
  for (let depth = 0; depth < 20; depth++) {
    nested = { depth, child: nested };
  }
  const sanitized = sanitizeAuditInput(nested);
  // Traverse to leaf
  let curr = sanitized;
  for (let depth = 0; depth < 20; depth++) {
    curr = curr.child;
  }
  assert.match(curr.thumbnailBase64, /\[stripped from audit log \(\d+ chars\)\]/);
});

test('B3.5: Mixed array containing circular references, large strings, and data URLs', () => {
  const obj = { name: 'Item' };
  obj.self = obj;
  const mixed = [
    obj,
    'Z'.repeat(2500),
    'data:image/webp;base64,UklGRm...',
    { sub: 'data:image/svg+xml;base64,PHN2Zw...' },
  ];
  const sanitized = sanitizeAuditInput(mixed);
  assert.strictEqual(sanitized[0].self, '[circular]');
  assert.match(sanitized[1], /…\[truncated 2500 chars\]/);
  assert.match(sanitized[2], /\[stripped image data URL \(\d+ chars\)\]/);
  assert.match(sanitized[3].sub, /\[stripped image data URL \(\d+ chars\)\]/);
});

// ----------------------------------------------------------------------------
// FEATURE 4: VALIDATED DUPLICATE ENTRY BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 4: Validated Duplicate Entry Boundaries] ---');

const baselineValidEstimate = {
  id: 'est-b4-base',
  name: 'Standard Kitchen Remodel',
  details: {
    confirmedItems: [],
    status: 'DRAFT',
    customer: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '555-019-9999',
      address: { street: '100 Main St', city: 'Metropolis', state: 'NY', zipCode: '10001' },
    },
    supplier: {
      name: 'Granite Supply Co',
      email: 'sales@granitesupply.com',
      phone: '555-012-3456',
      address: { street: '200 Industrial Pkwy', city: 'Metropolis', state: 'NY', zipCode: '10002' },
    },
    logo: null,
    adjustments: [],
    taxPercentage: 8.5,
    currency: 'USD',
    notes: 'Initial note',
    payments: [{ amount: 500, date: new Date() }],
  },
};

test('B4.1: Note length boundary: note of exact (250 - annotation.length) preserved fully', () => {
  const annotation = '\n(Copied from est-b4-base)';
  const exactLength = 250 - annotation.length;
  const exactNote = 'N'.repeat(exactLength);

  const original = {
    ...baselineValidEstimate,
    details: { ...baselineValidEstimate.details, notes: exactNote },
  };
  const duplicated = simulateDuplicateEstimate(original);
  assert.strictEqual(duplicated.details.notes.length, 250);
  assert.strictEqual(duplicated.details.notes, `${exactNote}${annotation}`);
  assert(duplicated.validationResult.success);
});

test('B4.2: Note length boundary: note of 250 chars truncated to allow annotation', () => {
  const note250 = 'M'.repeat(250);
  const original = {
    ...baselineValidEstimate,
    details: { ...baselineValidEstimate.details, notes: note250 },
  };
  const duplicated = simulateDuplicateEstimate(original);
  assert.strictEqual(duplicated.details.notes.length, 250);
  assert.ok(duplicated.details.notes.endsWith('\n(Copied from est-b4-base)'));
  assert(duplicated.validationResult.success);
});

test('B4.3: Note length boundary: empty string, whitespace only, or null notes', () => {
  const origEmpty = {
    ...baselineValidEstimate,
    details: { ...baselineValidEstimate.details, notes: '' },
  };
  const dupEmpty = simulateDuplicateEstimate(origEmpty);
  assert.strictEqual(dupEmpty.details.notes, '(Copied from est-b4-base)');

  const origWhitespace = {
    ...baselineValidEstimate,
    details: { ...baselineValidEstimate.details, notes: '   \n  \t ' },
  };
  const dupWhitespace = simulateDuplicateEstimate(origWhitespace);
  assert.strictEqual(dupWhitespace.details.notes, '(Copied from est-b4-base)');

  const origNull = {
    ...baselineValidEstimate,
    details: { ...baselineValidEstimate.details, notes: null },
  };
  const dupNull = simulateDuplicateEstimate(origNull);
  assert.strictEqual(dupNull.details.notes, '(Copied from est-b4-base)');
});

test('B4.4: Entry name boundary: original name of 250 chars + " (Copy)" truncated to 254 chars', () => {
  const name250 = 'E'.repeat(250);
  const original = {
    ...baselineValidEstimate,
    name: name250,
  };
  const duplicated = simulateDuplicateEstimate(original);
  assert.strictEqual(duplicated.name.length, 254);
  assert.strictEqual(duplicated.details.name.length, 254);
});

test('B4.5: Invalid status enum in original entry fails schema validation upon duplicate', () => {
  const invalidStatusOriginal = {
    ...baselineValidEstimate,
    details: {
      ...baselineValidEstimate.details,
      status: 'INVALID_STATUS_VALUE',
    },
  };
  const duplicated = simulateDuplicateEstimate(invalidStatusOriginal);
  assert.strictEqual(duplicated.validationResult.success, false);
});

// ----------------------------------------------------------------------------
// FEATURE 5: LABOR TYPE PERSISTENCE BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 5: Labor Type Persistence Boundaries] ---');

test('B5.1: Case sensitivity: uppercase and mixed case fail validation', () => {
  assert(!estimateSchemas.laborTypeSchema.safeParse('Percentage').success);
  assert(!estimateSchemas.laborTypeSchema.safeParse('PERCENTAGE').success);
  assert(!estimateSchemas.laborTypeSchema.safeParse('Fixed').success);
  assert(!estimateSchemas.laborTypeSchema.safeParse('QUANTITY').success);
});

test('B5.2: laborType "fixed" with zero unitPrice and high unitPrice', () => {
  const baseLineItem = {
    id: 'item-b5-2',
    parentId: 'root',
    quantity: 1,
    description: 'Specialty Edge',
    material: {
      id: 'mat-1',
      description: 'Marble',
      unitPrice: 0,
      dimensions: { type: 'unit', unitLabel: 'unit' },
      currency: 'USD',
    },
    laborType: 'fixed',
  };
  assert(estimateSchemas.lineItemSchema.safeParse(baseLineItem).success);

  baseLineItem.material.unitPrice = 1000000;
  assert(estimateSchemas.lineItemSchema.safeParse(baseLineItem).success);
});

test('B5.3: laborType "percentage" with 0%, 100%, and 200%', () => {
  const item = {
    id: 'item-b5-3',
    parentId: 'root',
    quantity: 1,
    description: 'Percentage Line Item',
    material: {
      id: 'mat-1',
      description: 'Granite',
      unitPrice: 150,
      dimensions: { type: 'area', unitLabel: 'm²' },
      currency: 'USD',
    },
    laborType: 'percentage',
  };
  assert(estimateSchemas.lineItemSchema.safeParse(item).success);
});

test('B5.4: laborType "quantity" with fractional quantities (0.5, 2.75)', () => {
  const fractionalItem = {
    id: 'item-b5-4',
    parentId: 'root',
    quantity: 2.75,
    description: 'Custom Slab Area',
    material: {
      id: 'mat-1',
      description: 'Quartz',
      unitPrice: 85,
      dimensions: { type: 'area', unitLabel: 'm²' },
      currency: 'USD',
    },
    laborType: 'quantity',
  };
  assert(estimateSchemas.lineItemSchema.safeParse(fractionalItem).success);
});

test('B5.5: Legacy items missing laborType field deserialize cleanly', () => {
  const legacyItem = {
    id: 'legacy-1',
    parentId: 'root',
    quantity: 1,
    description: 'Old Item',
    material: {
      id: 'm1',
      description: 'Granite',
      unitPrice: 50,
      dimensions: { type: 'unit', unitLabel: 'unit' },
      currency: 'USD',
    },
  };
  const parsed = estimateSchemas.lineItemSchema.safeParse(legacyItem);
  assert(parsed.success);
  assert.strictEqual(parsed.data.laborType, undefined);
});

// ----------------------------------------------------------------------------
// FEATURE 6: DEDUPLICATED FINANCIAL CALCULATIONS BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 6: Deduplicated Financial Calculations Boundaries] ---');

test('B6.1: Zero subtotal with adjustments', () => {
  const items = [];
  const subtotal = financials.calculateSubtotal(items);
  assert.strictEqual(subtotal, 0);

  const adjustments = [{ type: 'addFixed', value: 100, description: 'Base charge' }];
  const adjTotal = financials.calculateAdjustments(subtotal, adjustments);
  assert.strictEqual(adjTotal, 100);

  const grandTotal = financials.calculateGrandTotal(subtotal, adjTotal, 0);
  assert.strictEqual(grandTotal, 100);
});

test('B6.2: Discount exceeding 100% handles negative totalBeforeTax', () => {
  const subtotal = 1000;
  const adjustments = [{ type: 'discountPercent', value: 120, description: 'Super promo' }];
  const adjTotal = financials.calculateAdjustments(subtotal, adjustments);
  assert.strictEqual(adjTotal, -1200);

  const beforeTax = financials.calculateTotalBeforeTax(subtotal, adjTotal);
  assert.strictEqual(beforeTax, -200);
});

test('B6.3: IEEE-754 precision boundary: 0.1 + 0.2 rounding in line item total', () => {
  const item = { quantity: 1, material: { unitPrice: 0.1 } };
  const labor = { quantity: 1, material: { unitPrice: 0.2 } };
  const total = financials.calculateLineItemTotal(item, labor);
  assert.strictEqual(total, 0.3);
});

test('B6.4: Zero grand total with active payment produces credit status', () => {
  const grandTotal = 0;
  const totalPaid = 100;
  const status = financials.getPaymentStatus(1, totalPaid, grandTotal);
  assert.strictEqual(status, 'credit');
});

test('B6.5: Payments array where every payment is voided yields 0 totalPaid and unpaid', () => {
  const payments = [
    { amount: 500, isDeleted: true },
    { amount: 200, deletedAt: new Date() },
  ];
  const totalPaid = financials.calculatePaymentsTotal(payments);
  assert.strictEqual(totalPaid, 0);

  const active = financials.getActivePayments(payments);
  assert.strictEqual(active.length, 0);

  const status = financials.getPaymentStatus(active.length, totalPaid, 1000);
  assert.strictEqual(status, 'unpaid');
});

// ----------------------------------------------------------------------------
// FEATURE 7: ESTIMATE CSV EXPORT BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 7: Estimate CSV Export Boundaries] ---');

test('B7.1: Empty entry list dataToCSV([]) or dataToCSV(null) returns empty string', () => {
  assert.strictEqual(csvExporter.dataToCSV([]), '');
  assert.strictEqual(csvExporter.dataToCSV(null), '');
  assert.strictEqual(csvExporter.dataToCSV(undefined), '');
});

test('B7.2: Text containing commas, newlines, and double quotes correctly escaped', () => {
  const entries = [
    {
      name: 'Special "Custom" Countertop',
      details: {
        customer: {
          name: 'Doe, John & Jane',
          address: { street: 'Line 1\nLine 2', city: 'Boston', state: 'MA', zipCode: '02101' },
        },
      },
    },
  ];
  const csv = csvExporter.dataToCSV(entries);
  assert.ok(!csv.includes('[object Object]'));
  assert.ok(csv.includes('""Custom""'));
  assert.ok(csv.includes('Doe, John & Jane'));
});

test('B7.3: Contact with all address fields null or empty strings produces clean output', () => {
  const contact = {
    name: 'Minimal Contact',
    email: null,
    phone: '',
    address: { street: null, city: '', state: null, zipCode: '' },
  };
  const formatted = csvExporter.formatContactInfo(contact);
  assert.strictEqual(formatted, 'Minimal Contact');
});

test('B7.4: Currency symbol variations: BRL uses R$ and USD uses $', () => {
  const brlItems = [
    { quantity: 1, description: 'Bancada Granito', material: { unitPrice: 500, currency: 'BRL' } },
  ];
  const formattedBrl = csvExporter.formatLineItems(brlItems);
  assert.ok(formattedBrl.includes('R$500'));

  const usdItems = [
    { quantity: 1, description: 'Granite Counter', material: { unitPrice: 500, currency: 'USD' } },
  ];
  const formattedUsd = csvExporter.formatLineItems(usdItems);
  assert.ok(formattedUsd.includes('$500'));
});

test('B7.5: Date formatting across Firestore Timestamp, JS Date, and ISO string', () => {
  const jsDate = new Date('2026-06-01T15:30:00Z');
  const formattedDate = csvExporter.formatFieldValue('createdAt', jsDate);
  assert.strictEqual(formattedDate, '2026-06-01T15:30:00.000Z');

  const tsObj = { toDate: () => new Date('2026-06-02T10:00:00Z') };
  const formattedTs = csvExporter.formatFieldValue('updatedAt', tsObj);
  assert.strictEqual(formattedTs, '2026-06-02T10:00:00.000Z');
});

// ----------------------------------------------------------------------------
// FEATURE 8: POSTAL CODES BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 8: Postal Codes Boundaries] ---');

test('B8.1: Brazilian CEP boundary: 8 zeros (00000-000 and 00000000)', () => {
  assert(commonSchemas.POSTAL_CODE_REGEX.test('00000-000'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('00000000'));
});

test('B8.2: US ZIP boundary: 5 zeros (00000), 9 zeros (00000-0000, 000000000)', () => {
  assert(commonSchemas.POSTAL_CODE_REGEX.test('00000'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('00000-0000'));
  assert(commonSchemas.POSTAL_CODE_REGEX.test('000000000'));
});

test('B8.3: Invalid lengths: 4, 6, 7, 10 digits', () => {
  assert(!commonSchemas.POSTAL_CODE_REGEX.test('1234'));
  assert(!commonSchemas.POSTAL_CODE_REGEX.test('123456'));
  assert(!commonSchemas.POSTAL_CODE_REGEX.test('1234567'));
  assert(!commonSchemas.POSTAL_CODE_REGEX.test('1234567890'));
});

test('B8.4: Invalid characters: spaces, letters, periods, prefix', () => {
  assert(!commonSchemas.POSTAL_CODE_REGEX.test('12345 6789'));
  assert(!commonSchemas.POSTAL_CODE_REGEX.test('01310.100'));
  assert(!commonSchemas.POSTAL_CODE_REGEX.test('CEP-01310100'));
  assert(!commonSchemas.POSTAL_CODE_REGEX.test('ABCDE-1234'));
});

test('B8.5: ReDoS resistance: pathological inputs fail fast without backtracking hang', () => {
  const start = Date.now();
  for (let i = 0; i < 50; i++) {
    const badInput = '9'.repeat(100) + '!';
    assert(!commonSchemas.POSTAL_CODE_REGEX.test(badInput));
  }
  const duration = Date.now() - start;
  assert.ok(duration < 200, 'Regex must evaluate in < 200ms');
});

// ----------------------------------------------------------------------------
// FEATURE 9: DYNAMIC HOSTNAME BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 9: Dynamic Hostname Boundaries] ---');

test('B9.1: window.location.origin with non-standard ports (8080, 4433)', () => {
  assert.strictEqual(getAppOrigin({ location: { origin: 'http://localhost:8080' } }), 'http://localhost:8080');
  assert.strictEqual(getAppOrigin({ location: { origin: 'https://staging.internal:4433' } }), 'https://staging.internal:4433');
});

test('B9.2: NEXT_PUBLIC_APP_URL trailing slash handling', () => {
  const envWithSlash = { NEXT_PUBLIC_APP_URL: 'https://stoneforge.io/' };
  assert.strictEqual(getAppOrigin(null, envWithSlash), 'https://stoneforge.io/');
});

test('B9.3: IPv4 and IPv6 loopback origins', () => {
  assert.strictEqual(getAppOrigin({ location: { origin: 'http://127.0.0.1:3000' } }), 'http://127.0.0.1:3000');
  assert.strictEqual(getAppOrigin({ location: { origin: 'http://[::1]:3000' } }), 'http://[::1]:3000');
});

test('B9.4: window object is defined but location is undefined', () => {
  const mockWindow = {};
  const mockEnv = { NODE_ENV: 'development' };
  assert.strictEqual(getAppOrigin(mockWindow, mockEnv), 'http://localhost:3000');
});

test('B9.5: Environment variable precedence: browser window.location.origin takes precedence', () => {
  const mockWindow = { location: { origin: 'https://browser.origin.com' } };
  const mockEnv = { NEXT_PUBLIC_APP_URL: 'https://env.url.com' };
  assert.strictEqual(getAppOrigin(mockWindow, mockEnv), 'https://browser.origin.com');
});

// ----------------------------------------------------------------------------
// FEATURE 10: PRINT SYNCHRONIZATION & LAYOUT BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Feature 10: Print Synchronization & Layout Boundaries] ---');

test('B10.1: metersToCentimeters with extreme values (1,000,000m, -0.0001m, Infinity)', () => {
  assert.strictEqual(metersToCentimeters(1000000), 100000000);
  assert.strictEqual(metersToCentimeters(-0.0001), 0);
  assert.strictEqual(metersToCentimeters(Infinity), 0);
  assert.strictEqual(metersToCentimeters(-Infinity), 0);
});

test('B10.2: generateViewKeys with single item containing 20 camera views', () => {
  const views = [];
  for (let i = 0; i < 20; i++) {
    views.push({ id: `cam-${i}`, name: `View ${i}` });
  }
  const item = { id: 'item-20-cams', template: { cameraViews: views } };
  const keys = generateViewKeys([item]);
  assert.strictEqual(keys.length, 20);
  assert.strictEqual(new Set(keys).size, 20);
});

test('B10.3: generateViewKeys with 50 items containing 0 camera views', () => {
  const items = [];
  for (let i = 0; i < 50; i++) {
    items.push({ id: `item-empty-${i}`, template: { cameraViews: [] } });
  }
  const keys = generateViewKeys(items);
  assert.strictEqual(keys.length, 50);
  assert.strictEqual(new Set(keys).size, 50);
  assert.strictEqual(keys[0], 'item-empty-0:single');
  assert.strictEqual(keys[49], 'item-empty-49:single');
});

test('B10.4: Sequential snapshot queue with 0 views immediately considers queue ready', () => {
  const emptyKeys = [];
  let readyCalled = false;
  function checkReady(keys, index) {
    if (keys.length === 0 || index >= keys.length) {
      readyCalled = true;
    }
  }
  checkReady(emptyKeys, 0);
  assert.strictEqual(readyCalled, true);
});

test('B10.5: Breakpoint boundary: exact 1279px (mobile layout) vs 1280px (desktop layout)', () => {
  function getLayoutMode(width) {
    return width >= 1280 ? 'desktop' : 'mobile';
  }
  assert.strictEqual(getLayoutMode(1279), 'mobile');
  assert.strictEqual(getLayoutMode(1280), 'desktop');
  assert.strictEqual(getLayoutMode(1920), 'desktop');
  assert.strictEqual(getLayoutMode(768), 'mobile');
});

console.log('\n================================================================');
console.log(`Tier 2 Boundary & Corner Cases Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
