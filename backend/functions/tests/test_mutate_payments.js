// Regression tests for transactional payment mutations (backend/functions/src/bg-payments.ts).
// Specifically verifies that Firestore WriteBatch.update accepts the payload
// produced by add/update/void/restore (no FieldValue.serverTimestamp() inside arrays).
// Run via: npm test  (builds, then node --test tests/)
const test = require('node:test');
const assert = require('node:assert/strict');
const { Firestore, FieldValue, Timestamp } = require('@google-cloud/firestore');
const {
  applyPaymentMutations,
  toMillis,
} = require('../lib/bg-payments');

function makeDetails(payments = []) {
  return {
    confirmedItems: [
      { quantity: 2, material: { unitPrice: 250 } },
    ],
    adjustments: [],
    taxPercentage: 0,
    payments,
  };
}

function assertValidFirestoreUpdatePayload(payments) {
  // Uses Firestore's real WriteBatch.update() validator without committing any network RPC.
  const firestore = new Firestore({ projectId: 'demo-test-project' });
  const docRef = firestore.doc('journals/j1/estimates/e1');
  const batch = firestore.batch();
  assert.doesNotThrow(() => {
    batch.update(docRef, {
      'details.payments': payments,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  });
}

test('add/update/void/restore produce Firestore-valid array values (no serverTimestamp in arrays)', () => {
  const details = makeDetails();

  // 1. Add
  const added = applyPaymentMutations(
    details,
    {
      add: [
        {
          amount: 100,
          date: new Date('2026-11-27T17:50:00.000Z'),
          method: 'card',
          notes: undefined,
        },
      ],
    },
    'user-1',
  );
  assert.equal(added.length, 1);
  assert.ok(added[0].id);
  assert.ok(added[0].createdAt instanceof Timestamp);
  assert.ok(added[0].updatedAt instanceof Timestamp);
  assert.equal('notes' in added[0], false);
  assertValidFirestoreUpdatePayload(added);

  // 2. Update
  const updated = applyPaymentMutations(
    makeDetails(added),
    {
      update: [
        {
          id: added[0].id,
          amount: 150,
          notes: 'Updated note',
          method: undefined,
        },
      ],
    },
    'user-2',
  );
  assert.equal(updated[0].amount, 150);
  assert.equal(updated[0].method, 'card');
  assert.equal(updated[0].notes, 'Updated note');
  assert.ok(updated[0].updatedAt instanceof Timestamp);
  assertValidFirestoreUpdatePayload(updated);

  // 3. Void
  const voided = applyPaymentMutations(
    makeDetails(updated),
    { voidIds: [added[0].id] },
    'user-3',
  );
  assert.equal(voided[0].isDeleted, true);
  assert.ok(voided[0].deletedAt instanceof Timestamp);
  assert.ok(voided[0].updatedAt instanceof Timestamp);
  assertValidFirestoreUpdatePayload(voided);

  // 4. Restore
  const restored = applyPaymentMutations(
    makeDetails(voided),
    { restoreIds: [added[0].id] },
    'user-4',
  );
  assert.equal(restored[0].isDeleted, false);
  assert.equal(restored[0].deletedAt, null);
  assert.equal(restored[0].deletedBy, null);
  assert.ok(restored[0].updatedAt instanceof Timestamp);
  assertValidFirestoreUpdatePayload(restored);
});

test('applyPaymentMutations rejects payments exceeding estimate total', () => {
  const details = makeDetails(); // grandTotal = 500
  assert.throws(
    () =>
      applyPaymentMutations(
        details,
        {
          add: [{ amount: 600, date: new Date('2026-11-27T17:50:00.000Z') }],
        },
        'user-1',
      ),
    /exceed the estimate total/,
  );
});

test('toMillis handles Timestamp, Date, number, and ISO string', () => {
  const iso = '2026-11-27T17:50:29.000Z';
  const expected = Date.parse(iso);
  assert.equal(toMillis(Timestamp.fromMillis(expected)), expected);
  assert.equal(toMillis(new Date(iso)), expected);
  assert.equal(toMillis(expected), expected);
  assert.equal(toMillis(iso), expected);
  assert.equal(toMillis(null), null);
  assert.equal(toMillis(undefined), null);
  assert.equal(toMillis('not-a-date'), null);
});
