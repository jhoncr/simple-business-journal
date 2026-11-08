// backend/functions/tests/test_duplicate_entry.js
// Unit tests for duplicate entry validation and note truncation logic.
// Run via: npm test (or node --test tests/test_duplicate_entry.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateDetailsStateSchema } = require('../lib/common/schemas/estimate_schema');
const { AssemblyTemplateSchema } = require('../lib/common/schemas/studio');
const { ENTRY_CONFIG } = require('../lib/common/schemas/configmap');

// Helper simulating the duplication transformation logic in bg-duplicate-entry.ts
function simulateDuplicateDetails(entryType, originalEntry, originalEntryId, newDocId) {
  const duplicateDetails = { ...(originalEntry.details || {}) };

  if (entryType === 'estimate') {
    duplicateDetails.payments = [];

    const MAX_NOTES_LENGTH = 250;
    const annotation = `\n(Copied from ${originalEntryId})`;
    const rawNotes = (originalEntry.details)?.notes;
    const origNotes = typeof rawNotes === 'string' ? rawNotes.trim() : '';

    if (origNotes) {
      const maxOrigLength = Math.max(0, MAX_NOTES_LENGTH - annotation.length);
      const truncatedNotes =
        origNotes.length > maxOrigLength
          ? origNotes.slice(0, maxOrigLength)
          : origNotes;
      duplicateDetails.notes = `${truncatedNotes}${annotation}`;
    } else {
      duplicateDetails.notes = `(Copied from ${originalEntryId})`.slice(
        0,
        MAX_NOTES_LENGTH,
      );
    }
  } else if (entryType === 'template') {
    duplicateDetails.id = newDocId;
  }

  const duplicateName = (
    originalEntry.name ? `${originalEntry.name} (Copy)` : 'Untitled (Copy)'
  ).slice(0, 254);
  duplicateDetails.name = duplicateName;

  const schema = ENTRY_CONFIG[entryType].schema;
  const result = schema.safeParse(duplicateDetails);
  return { duplicateDetails, result };
}

// Sample valid estimate baseline
const validEstimateDoc = {
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
    notes: 'Please measure twice on site.',
    payments: [
      {
        id: 'pay_123',
        amount: 500,
        date: '2026-01-15',
        method: 'creditCard',
      },
    ],
  },
};

test('duplicate estimate preserves short notes and clears payments', () => {
  const { result } = simulateDuplicateDetails(
    'estimate',
    validEstimateDoc,
    'orig_est_001',
    'new_est_002',
  );

  assert.ok(result.success, 'Schema validation should succeed');
  assert.equal(result.data.payments.length, 0, 'Payments should be cleared');
  assert.equal(
    result.data.notes,
    'Please measure twice on site.\n(Copied from orig_est_001)',
  );
  assert.ok(result.data.notes.length <= 250);
});

test('duplicate estimate truncates notes that would exceed 250 chars', () => {
  const originalWithLongNotes = {
    ...validEstimateDoc,
    details: {
      ...validEstimateDoc.details,
      notes: 'X'.repeat(250), // At maximum limit
    },
  };

  const { result } = simulateDuplicateDetails(
    'estimate',
    originalWithLongNotes,
    'orig_est_001',
    'new_est_002',
  );

  assert.ok(result.success, 'Schema validation must succeed with truncated notes');
  assert.ok(result.data.notes.length <= 250, 'Total note length must be <= 250 chars');
  assert.equal(result.data.notes.length, 250, 'Truncated note should maximize available space');
  assert.ok(
    result.data.notes.endsWith('\n(Copied from orig_est_001)'),
    'Should retain copied annotation at the end',
  );
});

test('untruncated note of > 250 chars fails estimate schema validation', () => {
  const badDetails = {
    ...validEstimateDoc.details,
    notes: 'Y'.repeat(251),
  };
  const result = estimateDetailsStateSchema.safeParse(badDetails);
  assert.ok(!result.success, 'Should reject notes > 250 characters');
  assert.match(
    result.error.issues[0].message,
    /Notes must be less than 250 characters/,
  );
});

test('duplicate estimate handles empty, null, and undefined notes', () => {
  for (const emptyNote of [null, undefined, '']) {
    const doc = {
      ...validEstimateDoc,
      details: { ...validEstimateDoc.details, notes: emptyNote },
    };
    const { result } = simulateDuplicateDetails(
      'estimate',
      doc,
      'orig_est_001',
      'new_est_002',
    );
    assert.ok(result.success);
    assert.equal(result.data.notes, '(Copied from orig_est_001)');
    assert.ok(result.data.notes.length <= 250);
  }
});

test('duplicate estimate rejects corrupt payload missing customer', () => {
  const corruptDoc = {
    name: 'Corrupt Estimate',
    details: {
      ...validEstimateDoc.details,
      customer: null, // Invalid
    },
  };
  const { result } = simulateDuplicateDetails(
    'estimate',
    corruptDoc,
    'orig_est_001',
    'new_est_002',
  );
  assert.ok(!result.success, 'Should reject corrupt payload');
});

test('duplicate template assigns new ID and validates AssemblyTemplateSchema', () => {
  const validTemplateDoc = {
    name: 'L-Shaped Countertop',
    details: {
      id: 'tmpl_orig_1',
      name: 'L-Shaped Countertop',
      description: 'Standard kitchen layout',
      variables: [{ id: 'w1', label: 'Width', default: 120 }],
      components: [
        {
          id: 'slab_1',
          type: 'slab',
          name: 'Main Island',
          length: 120,
          depth: 36,
          thickness: 3,
          position: [0, 0, 0],
          cutouts: [],
        },
      ],
      cameraViews: [],
    },
  };

  const { result } = simulateDuplicateDetails(
    'template',
    validTemplateDoc,
    'tmpl_orig_1',
    'tmpl_copy_2',
  );

  assert.ok(result.success, 'Template duplication must validate');
  assert.equal(result.data.id, 'tmpl_copy_2', 'ID must be updated to new doc ID');
  assert.equal(result.data.name, 'L-Shaped Countertop (Copy)');
});

test('duplicate name caps at 254 chars max', () => {
  const normalDoc = {
    name: 'Standard Kitchen',
    details: validEstimateDoc.details,
  };
  const normalResult = simulateDuplicateDetails(
    'estimate',
    normalDoc,
    'orig_001',
    'new_002',
  );
  assert.equal(normalResult.duplicateDetails.name, 'Standard Kitchen (Copy)');

  const longNameDoc = {
    name: 'Z'.repeat(260),
    details: validEstimateDoc.details,
  };
  const { duplicateDetails, result } = simulateDuplicateDetails(
    'estimate',
    longNameDoc,
    'orig_est_001',
    'new_est_002',
  );
  assert.ok(result.success);
  assert.equal(duplicateDetails.name.length, 254);
});
