const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  paymentSchema,
  estimateDetailsStateSchema,
} = require('../lib/common/schemas/estimate_schema');
const { WorkStatus } = require('../lib/common/common_types');

console.log('\n================================================================');
console.log('=== RUNNING ESTIMATE PAYMENT FEATURE & SOFT-DELETE TESTS ===');
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

// ── 1. Schema Validation Tests ──
console.log('--- [Suite 1: Payment Schema & Field Validation] ---');

test('P1.1: Valid minimal payment passes validation', () => {
  const minimalPayment = {
    amount: 150.5,
    date: new Date('2026-08-30'),
  };
  const parsed = paymentSchema.safeParse(minimalPayment);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.data.amount, 150.5);
  assert.strictEqual(parsed.data.method, undefined);
});

test('P1.2: Valid complete payment with all metadata & soft-delete fields', () => {
  const completePayment = {
    id: 'pay-uuid-1234-5678',
    amount: 500,
    date: new Date('2026-08-30T10:00:00Z'),
    method: 'credit_card',
    transactionId: 'TXN-987654',
    notes: '50% deposit received via Stripe',
    createdAt: new Date('2026-08-30T10:05:00Z'),
    createdBy: 'user-admin-1',
    updatedAt: new Date('2026-08-30T11:00:00Z'),
    updatedBy: 'user-admin-1',
    deletedAt: new Date('2026-08-30T12:00:00Z'),
    deletedBy: 'user-admin-1',
    isDeleted: true,
  };
  const parsed = paymentSchema.safeParse(completePayment);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.data.id, 'pay-uuid-1234-5678');
  assert.strictEqual(parsed.data.transactionId, 'TXN-987654');
  assert.strictEqual(parsed.data.isDeleted, true);
  assert.strictEqual(parsed.data.deletedBy, 'user-admin-1');
});

test('P1.3: Payment with string date coerces correctly', () => {
  const paymentWithStringDate = {
    amount: 250,
    date: '2026-08-30T14:30:00.000Z',
    method: 'bank_transfer',
  };
  const parsed = paymentSchema.safeParse(paymentWithStringDate);
  assert.strictEqual(parsed.success, true);
  assert.ok(parsed.data.date instanceof Date);
  assert.strictEqual(parsed.data.date.toISOString(), '2026-08-30T14:30:00.000Z');
});

test('P1.3b: Payment with Firestore Timestamp (.toDate()) parses correctly', () => {
  const firestoreTimestamp = {
    seconds: 1788100200,
    nanoseconds: 0,
    toDate: () => new Date('2026-08-30T14:30:00.000Z'),
  };
  const paymentWithTimestamp = {
    amount: 250,
    date: firestoreTimestamp,
    createdAt: firestoreTimestamp,
    updatedAt: firestoreTimestamp,
  };
  const parsed = paymentSchema.safeParse(paymentWithTimestamp);
  assert.strictEqual(parsed.success, true);
  assert.ok(parsed.data.date instanceof Date);
  assert.strictEqual(parsed.data.date.toISOString(), '2026-08-30T14:30:00.000Z');
  assert.ok(parsed.data.createdAt instanceof Date);
  assert.strictEqual(parsed.data.createdAt.toISOString(), '2026-08-30T14:30:00.000Z');
});

test('P1.3c: Payment with Firestore serialized object ({ seconds, nanoseconds } and { _seconds, _nanoseconds }) parses correctly', () => {
  const paymentWithSerialized1 = {
    amount: 100,
    date: { seconds: 1788100200, nanoseconds: 0 },
    createdAt: { seconds: 1788100200, nanoseconds: 0 },
  };
  const parsed1 = paymentSchema.safeParse(paymentWithSerialized1);
  assert.strictEqual(parsed1.success, true);
  assert.ok(parsed1.data.date instanceof Date);
  assert.strictEqual(parsed1.data.date.toISOString(), '2026-08-30T14:30:00.000Z');

  const paymentWithSerialized2 = {
    amount: 100,
    date: { _seconds: 1788100200, _nanoseconds: 0 },
  };
  const parsed2 = paymentSchema.safeParse(paymentWithSerialized2);
  assert.strictEqual(parsed2.success, true);
  assert.ok(parsed2.data.date instanceof Date);
  assert.strictEqual(parsed2.data.date.toISOString(), '2026-08-30T14:30:00.000Z');
});

test('P1.4: Reject zero and negative amounts', () => {
  const zeroPayment = { amount: 0, date: new Date() };
  const negativePayment = { amount: -50, date: new Date() };
  assert.strictEqual(paymentSchema.safeParse(zeroPayment).success, false);
  assert.strictEqual(paymentSchema.safeParse(negativePayment).success, false);
});

test('P1.5: Notes max length boundary enforcement (500 chars)', () => {
  const validNotes = {
    amount: 100,
    date: new Date(),
    notes: 'A'.repeat(500),
  };
  const invalidNotes = {
    amount: 100,
    date: new Date(),
    notes: 'A'.repeat(501),
  };
  assert.strictEqual(paymentSchema.safeParse(validNotes).success, true);
  assert.strictEqual(paymentSchema.safeParse(invalidNotes).success, false);
});

// ── 2. Estimate Integration & Lifecycle Tests ──
console.log('\n--- [Suite 2: Estimate Details & Soft-Delete Lifecycle] ---');

test('P2.1: Estimate details with mix of active and soft-deleted payments', () => {
  const estimateData = {
    confirmedItems: [],
    status: WorkStatus.IN_PROCESS,
    customer: {
      name: 'Acme Corp',
      email: 'billing@acme.com',
      phone: '1234567890',
      address: {
        street: '123 Main St',
        city: 'Metropolis',
        state: 'NY',
        zipCode: '10001',
      },
    },
    supplier: {
      name: 'Stone Supplier Inc',
      email: 'sales@stonesupplier.com',
      phone: '9876543210',
      address: {
        street: '456 Quarry Rd',
        city: 'Stone City',
        state: 'VT',
        zipCode: '05401',
      },
    },
    logo: null,
    adjustments: [],
    taxPercentage: 0,
    currency: 'USD',
    notes: 'Estimate with multiple payments',
    payments: [
      {
        id: 'pay-1',
        amount: 1000,
        date: new Date('2026-08-01'),
        method: 'bank_transfer',
        transactionId: 'WIRE-001',
        isDeleted: false,
      },
      {
        id: 'pay-2',
        amount: 200,
        date: new Date('2026-08-05'),
        method: 'check',
        transactionId: 'CHK-100',
        deletedAt: new Date('2026-08-06'),
        deletedBy: 'admin-user',
        isDeleted: true,
      },
      {
        id: 'pay-3',
        amount: 500,
        date: new Date('2026-08-10'),
        method: 'credit_card',
        transactionId: 'CC-888',
        isDeleted: false,
      },
    ],
  };

  const parsed = estimateDetailsStateSchema.safeParse(estimateData);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.data.payments.length, 3);

  // Math test: Active payments should sum to 1500 (1000 + 500), ignoring the 200 soft-deleted payment
  const activePayments = parsed.data.payments.filter(
    (p) => !p.deletedAt && !p.isDeleted,
  );
  assert.strictEqual(activePayments.length, 2);
  const totalActivePaid = activePayments.reduce((sum, p) => sum + p.amount, 0);
  assert.strictEqual(totalActivePaid, 1500);
});

test('P2.2: Soft-delete transition simulation (voiding a payment)', () => {
  const initialPayment = {
    id: 'pay-100',
    amount: 350,
    date: new Date('2026-08-15'),
    method: 'cash',
    isDeleted: false,
  };

  // Void the payment
  const voidedPayment = {
    ...initialPayment,
    deletedAt: new Date('2026-08-16'),
    deletedBy: 'staff-user',
    isDeleted: true,
  };

  const parsedVoided = paymentSchema.safeParse(voidedPayment);
  assert.strictEqual(parsedVoided.success, true);
  assert.strictEqual(parsedVoided.data.isDeleted, true);
  assert.ok(parsedVoided.data.deletedAt instanceof Date);

  // Restore the payment
  const restoredPayment = {
    ...voidedPayment,
    deletedAt: null,
    deletedBy: null,
    isDeleted: false,
    updatedAt: new Date('2026-08-17'),
    updatedBy: 'admin-user',
  };

  const parsedRestored = paymentSchema.safeParse(restoredPayment);
  assert.strictEqual(parsedRestored.success, true);
  assert.strictEqual(parsedRestored.data.isDeleted, false);
  assert.strictEqual(parsedRestored.data.deletedAt, null);
});

// ── 3. i18n Completeness Tests ──
console.log('\n--- [Suite 3: Payment i18n Parity & Token Verification] ---');

test('P3.1: All required payment keys exist in both en.json and pt.json', () => {
  const enPath = path.resolve(__dirname, '../../../frontend/messages/en.json');
  const ptPath = path.resolve(__dirname, '../../../frontend/messages/pt.json');

  const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const ptJson = JSON.parse(fs.readFileSync(ptPath, 'utf8'));

  const requiredPaymentKeys = [
    'title',
    'addPayment',
    'editPayment',
    'recordPayment',
    'voidPayment',
    'restorePayment',
    'deletePermanently',
    'voidConfirmTitle',
    'voidConfirmDescription',
    'permanentDeleteTitle',
    'permanentDeleteDescription',
    'receipt',
    'amount',
    'date',
    'method',
    'customMethod',
    'transactionId',
    'notes',
    'showVoided',
    'hideVoided',
    'fillRemainingBalance',
    'paymentSaved',
    'paymentUpdated',
    'paymentDeleted',
    'paymentRestored',
    'paymentPermanentlyDeleted',
  ];

  for (const key of requiredPaymentKeys) {
    assert.ok(
      enJson.payments[key] !== undefined,
      `Missing key in en.json payments: ${key}`,
    );
    assert.ok(
      ptJson.payments[key] !== undefined,
      `Missing key in pt.json payments: ${key}`,
    );
  }
});

console.log('\n================================================================');
console.log(`Payment Feature Test Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
