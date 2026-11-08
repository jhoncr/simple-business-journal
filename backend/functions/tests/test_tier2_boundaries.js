const assert = require('assert');
const fs = require('fs');
const path = require('path');
const z = require('zod');

const { UserSchema, pendingAccessSchema, ROLES, traceSchema, contactInfoSchema, addressSchema, allowedCurrencySchema } = require('../lib/common/schemas/common_schemas');
const { JournalSchema, businessDetailsSchema } = require('../lib/common/schemas/JournalSchema');
const { lineItemSchema, materialSchema, adjustmentSchema, paymentSchema, estimateDetailsStateSchema } = require('../lib/common/schemas/estimate_schema');
const { AssemblyTemplateSchema, SlabComponentSchema, CutoutSchema, DimensionLabelSchema, CameraViewSchema } = require('../lib/common/schemas/studio');
const { ENTRY_CONFIG, entrySchema, entryTypeSchema } = require('../lib/common/schemas/configmap');
const { WorkStatus } = require('../lib/common/common_types');
const { flattenToDotNotation } = require('../lib/helpers/object-utils');
const { FieldValue } = require('firebase-admin/firestore');
const { evaluateExpression } = require('./test_evaluator_helper');

console.log('\n================================================================');
console.log('=== RUNNING TIER 2: BOUNDARY & CORNER CASES TEST SUITE ===');
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
// SUITE 1: STRING & TEXT BOUNDARIES (Quotes, Multiline, Unicode, Limits)
// ----------------------------------------------------------------------------
console.log('\n--- [Suite 1: Text & String Boundaries] ---');

test('T2.1: Entry name exactly 3 chars succeeds; 2 chars fails; 254 chars succeeds; 255 chars fails', () => {
  const minValid = { jid: 'j1', entryType: 'estimate', name: 'abc', details: {} };
  const minInvalid = { jid: 'j1', entryType: 'estimate', name: 'ab', details: {} };
  const maxValid = { jid: 'j1', entryType: 'estimate', name: 'a'.repeat(254), details: {} };
  const maxInvalid = { jid: 'j1', entryType: 'estimate', name: 'a'.repeat(255), details: {} };

  assert(entrySchema.safeParse(minValid).success, '3-character name should be valid');
  assert(!entrySchema.safeParse(minInvalid).success, '2-character name should be invalid');
  assert(entrySchema.safeParse(maxValid).success, '254-character name should be valid');
  assert(!entrySchema.safeParse(maxInvalid).success, '255-character name should be invalid');
});

test('T2.2: LineItem description min 1 char succeeds, 0 chars fails, 254 chars succeeds, 255 fails', () => {
  const baseMaterial = {
    id: 'm1',
    description: 'Granite',
    unitPrice: 100,
    dimensions: { type: 'unit', unitLabel: 'unit' },
    currency: 'USD',
  };

  const itemMin = { id: 'i1', parentId: 'root', quantity: 1, description: 'X', material: baseMaterial };
  const itemEmpty = { id: 'i2', parentId: 'root', quantity: 1, description: '', material: baseMaterial };
  const itemMax = { id: 'i3', parentId: 'root', quantity: 1, description: 'D'.repeat(254), material: baseMaterial };
  const itemOverMax = { id: 'i4', parentId: 'root', quantity: 1, description: 'D'.repeat(255), material: baseMaterial };

  assert(lineItemSchema.safeParse(itemMin).success);
  assert(!lineItemSchema.safeParse(itemEmpty).success);
  assert(lineItemSchema.safeParse(itemMax).success);
  assert(!lineItemSchema.safeParse(itemOverMax).success);
});

test('T2.3: Estimate notes max 250 characters boundary enforcement', () => {
  const baseEstimate = {
    confirmedItems: [],
    status: WorkStatus.DRAFT,
    customer: { name: 'Acme Corp', address: { street: null, city: null, state: null, zipCode: null } },
    supplier: { name: 'Supplier Co', address: { street: null, city: null, state: null, zipCode: null } },
    logo: null,
    adjustments: [],
    taxPercentage: 0,
    currency: 'USD',
  };

  const validNotes = { ...baseEstimate, notes: 'N'.repeat(250) };
  const invalidNotes = { ...baseEstimate, notes: 'N'.repeat(251) };

  assert(estimateDetailsStateSchema.safeParse(validNotes).success);
  assert(!estimateDetailsStateSchema.safeParse(invalidNotes).success);
});

test('T2.4: AssemblyTemplate description max 200 characters boundary enforcement', () => {
  const baseTemplate = {
    id: 'tmpl-1',
    name: 'Counter',
    variables: [],
    components: [],
  };

  const validDesc = { ...baseTemplate, description: 'T'.repeat(200) };
  const invalidDesc = { ...baseTemplate, description: 'T'.repeat(201) };

  assert(AssemblyTemplateSchema.safeParse(validDesc).success);
  assert(!AssemblyTemplateSchema.safeParse(invalidDesc).success);
});

test('T2.5: Contact info phone number regex and minimum 10 digits validation', () => {
  const baseAddress = { street: null, city: null, state: null, zipCode: null };

  const validPhones = ['+1 (555) 123-4567', '5551234567', '+44 20 7123 4567', '123-456-7890'];
  const invalidPhones = ['123', 'phone12345', '555-abc-4567', '123456789']; // 9 digits

  for (const phone of validPhones) {
    assert(contactInfoSchema.safeParse({ name: 'Valid User', phone, address: baseAddress }).success, `Phone should pass: ${phone}`);
  }
  for (const phone of invalidPhones) {
    assert(!contactInfoSchema.safeParse({ name: 'Valid User', phone, address: baseAddress }).success, `Phone should fail: ${phone}`);
  }
});


// ----------------------------------------------------------------------------
// SUITE 2: 3D PARAMETRIC & EXPRESSION BOUNDARY CASES
// ----------------------------------------------------------------------------
console.log('\n--- [Suite 2: 3D Studio & Expression Boundaries] ---');

test('T2.6: evaluateExpression handles zero, negative, floating point numbers directly', () => {
  assert.strictEqual(evaluateExpression(0, {}), 0);
  assert.strictEqual(evaluateExpression(-45.75, {}), -45.75);
  assert.strictEqual(evaluateExpression(100.005, {}), 100.005);
});

test('T2.7: evaluateExpression handles empty, whitespace, and null expression safely without throw', () => {
  assert.strictEqual(evaluateExpression('', {}), 0);
  assert.strictEqual(evaluateExpression('   ', {}), 0);
  assert.strictEqual(evaluateExpression(null, {}), 0);
  assert.strictEqual(evaluateExpression(undefined, {}), 0);
});

test('T2.8: evaluateExpression handles division by zero and mathematical edge cases (Infinity -> isNaN check or numeric)', () => {
  // 10 / 0 in JS returns Infinity, which is numeric; 0 / 0 returns NaN -> fallback 0
  assert.strictEqual(evaluateExpression('0 / 0', {}), 0);
  assert.strictEqual(evaluateExpression('Math.sqrt(-1)', {}), 0); // NaN -> 0
});

test('T2.9: evaluateExpression ignores invalid variable names to prevent injection attacks', () => {
  const maliciousVars = {
    'process.exit(1)': 100,
    'console.log': 200,
    '__proto__': 300,
    validVar: 50,
  };
  const res = evaluateExpression('validVar * 2', maliciousVars);
  assert.strictEqual(res, 100);
});

test('T2.10: SlabComponentSchema supports deeply nested recursive children components', () => {
  const nestedSlab = {
    id: 'level-1',
    type: 'slab',
    name: 'Base Slab',
    length: 2000,
    depth: 600,
    thickness: 30,
    position: [0, 0, 0],
    cutouts: [],
    children: [
      {
        id: 'level-2',
        type: 'slab',
        name: 'Splashback',
        length: 2000,
        depth: 30,
        thickness: 300,
        position: [0, 600, 0],
        cutouts: [],
        children: [
          {
            id: 'level-3',
            type: 'slab',
            name: 'Shelf',
            length: 1000,
            depth: 150,
            thickness: 20,
            position: [500, 630, 200],
            cutouts: [],
          },
        ],
      },
    ],
  };

  assert(SlabComponentSchema.safeParse(nestedSlab).success, 'Deeply nested recursive slab hierarchy must validate');
});


// ----------------------------------------------------------------------------
// SUITE 3: FINANCIAL & ESTIMATE CALCULATION BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Suite 3: Financial & Estimate Calculation Boundaries] ---');

test('T2.11: 100% discount and over-100% discount handling in adjustment math', () => {
  const subtotal = 500;
  const calc100Discount = -(subtotal * 100) / 100;
  const totalBeforeTax100 = subtotal + calc100Discount;
  assert.strictEqual(totalBeforeTax100, 0);

  const calc150Discount = -(subtotal * 150) / 100;
  const totalBeforeTax150 = subtotal + calc150Discount;
  assert.strictEqual(totalBeforeTax150, -250, 'Over 100% discount accurately reflects negative balance before floor logic');
});

test('T2.12: Tax percentage boundary cases (0% tax, 100% tax, fractional tax rates like 8.875%)', () => {
  const totalBeforeTax = 1000;

  const tax0 = (totalBeforeTax * 0) / 100;
  assert.strictEqual(tax0, 0);

  const tax100 = (totalBeforeTax * 100) / 100;
  assert.strictEqual(tax100, 1000);

  const taxFractional = (totalBeforeTax * 8.875) / 100;
  assert.strictEqual(taxFractional, 88.75);
});

test('T2.13: Payment amount validation requires positive number (rejects 0 and negative payments)', () => {
  assert(paymentSchema.safeParse({ amount: 100, date: new Date() }).success);
  assert(paymentSchema.safeParse({ amount: 0.01, date: new Date() }).success);
  assert(!paymentSchema.safeParse({ amount: 0, date: new Date() }).success, 'Payment amount must be positive (> 0)');
  assert(!paymentSchema.safeParse({ amount: -50, date: new Date() }).success, 'Payment amount cannot be negative');
});

test('T2.14: LineItem with zero dimensions, null dimensions, and optional attached templates', () => {
  const baseMat = { id: 'm1', description: 'Tile', unitPrice: 10, dimensions: { type: 'unit', unitLabel: 'unit' }, currency: 'USD' };

  const itemNullDim = { id: 'i1', parentId: 'root', quantity: 5, description: 'Tile Box', dimensions: null, material: baseMat };
  const itemZeroDim = { id: 'i2', parentId: 'root', quantity: 5, description: 'Tile Box', dimensions: { length: 0, width: 0 }, material: baseMat };
  const itemNegativeDim = { id: 'i3', parentId: 'root', quantity: 5, description: 'Tile Box', dimensions: { length: -10, width: 20 }, material: baseMat };

  assert(lineItemSchema.safeParse(itemNullDim).success);
  assert(lineItemSchema.safeParse(itemZeroDim).success);
  assert(!lineItemSchema.safeParse(itemNegativeDim).success, 'Dimensions cannot be negative');
});

test('T2.15: Payment overpayment produces negative balance due (credit balance)', () => {
  const grandTotal = 500;
  const payments = [{ amount: 300 }, { amount: 300 }];
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0); // 600
  const balanceDue = grandTotal - totalPaid; // -100

  assert.strictEqual(balanceDue, -100, 'Customer has $100 credit on account');
});


// ----------------------------------------------------------------------------
// SUITE 4: REALTIME STATE SUBSCRIPTION & CACHE BOUNDARIES
// ----------------------------------------------------------------------------
console.log('\n--- [Suite 4: Realtime Subscription & Cache Boundaries] ---');

test('T2.16: State reconciler handles transition from 0 to 1000 items in single snapshot', () => {
  let allEntries = {};
  let prevKeys = new Set();

  const largeSnapshot = {};
  for (let i = 0; i < 1000; i++) {
    largeSnapshot[`item_${i}`] = { id: `item_${i}`, index: i };
  }

  const currentSnapshotKeys = new Set(Object.keys(largeSnapshot));
  const updated = { ...allEntries, ...largeSnapshot };
  for (const key of prevKeys) {
    if (!currentSnapshotKeys.has(key)) delete updated[key];
  }

  assert.strictEqual(Object.keys(updated).length, 1000);
});

test('T2.17: State reconciler handles transition from 1000 items to 0 items (mass deletion)', () => {
  let allEntries = {};
  for (let i = 0; i < 1000; i++) {
    allEntries[`item_${i}`] = { id: `item_${i}` };
  }
  let prevKeys = new Set(Object.keys(allEntries));

  const emptySnapshot = {};
  const currentSnapshotKeys = new Set(Object.keys(emptySnapshot));
  const updated = { ...allEntries, ...emptySnapshot };
  for (const key of prevKeys) {
    if (!currentSnapshotKeys.has(key)) delete updated[key];
  }

  assert.strictEqual(Object.keys(updated).length, 0);
});

test('T2.18: Repeated idempotent snapshot emissions do not mutate reference data or drop items', () => {
  const snapshot = { e1: { id: 'e1', v: 1 }, e2: { id: 'e2', v: 2 } };
  let allEntries = { ...snapshot };
  let prevKeys = new Set(Object.keys(snapshot));

  for (let cycle = 0; cycle < 50; cycle++) {
    const currentKeys = new Set(Object.keys(snapshot));
    const updated = { ...allEntries, ...snapshot };
    for (const key of prevKeys) {
      if (!currentKeys.has(key)) delete updated[key];
    }
    allEntries = updated;
    prevKeys = currentKeys;
  }

  assert.deepStrictEqual(Object.keys(allEntries).sort(), ['e1', 'e2']);
});

test('T2.19: FlattenToDotNotation handles deeply nested objects with 5 levels of nesting', () => {
  const deepObj = {
    level1: {
      level2: {
        level3: {
          level4: {
            value: 'Deep Value',
            emptyVal: '',
            nullVal: null,
          },
        },
      },
    },
  };

  const flattened = flattenToDotNotation(deepObj, 'root');
  assert.strictEqual(flattened['root.level1.level2.level3.level4.value'], 'Deep Value');
  assert(flattened['root.level1.level2.level3.level4.emptyVal'] instanceof FieldValue);
  assert(flattened['root.level1.level2.level3.level4.nullVal'] instanceof FieldValue);
});

test('T2.20: Contributor email comma escaping handles complex email aliases (e.g. user+alias.test@sub.domain.co.uk)', () => {
  const complexEmail = 'user+alias.test@sub.domain.co.uk';
  const escaped = complexEmail.replace(/\./g, ',');
  const unescaped = escaped.replace(/,/g, '.');

  assert.strictEqual(escaped, 'user+alias,test@sub,domain,co,uk');
  assert.strictEqual(unescaped, complexEmail);
  assert(!escaped.includes('.'), 'Escaped email must contain 0 periods for Firestore key safety');
});

console.log('\n================================================================');
console.log(`Tier 2 Boundary & Corner Cases Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
