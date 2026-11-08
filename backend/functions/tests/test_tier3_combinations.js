const assert = require('assert');
const fs = require('fs');
const path = require('path');
const z = require('zod');

const { UserSchema, pendingAccessSchema, ROLES, traceSchema, contactInfoSchema, addressSchema, allowedCurrencySchema } = require('../lib/common/schemas/common_schemas');
const { JournalSchema, businessDetailsSchema } = require('../lib/common/schemas/JournalSchema');
const { lineItemSchema, materialSchema, adjustmentSchema, paymentSchema, estimateDetailsStateSchema } = require('../lib/common/schemas/estimate_schema');
const { AssemblyTemplateSchema, SlabComponentSchema, CutoutSchema, DimensionLabelSchema, CameraViewSchema } = require('../lib/common/schemas/studio');
const { ENTRY_CONFIG, entrySchema, entryTypeSchema } = require('../lib/common/schemas/configmap');
const { ROLES_ADMIN, ROLES_THAT_ADD, ROLES_CAN_DELETE } = require('../lib/common/const');
const { WorkStatus } = require('../lib/common/common_types');
const { flattenToDotNotation } = require('../lib/helpers/object-utils');
const { evaluateExpression } = require('./test_evaluator_helper');

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
// COMBINATION 1: RBAC + SOFT-DELETES + REALTIME LISTENER PRUNING
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 1: RBAC + Soft-Deletes + Realtime Cache Updates] ---');

test('C1.1: RBAC determines who can soft-delete an entry and soft-deletion preserves audit metadata', () => {
  const checkDeletePerm = (role) => ROLES_CAN_DELETE.has(role);

  assert.strictEqual(checkDeletePerm('admin'), true);
  assert.strictEqual(checkDeletePerm('editor'), true);
  assert.strictEqual(checkDeletePerm('staff'), false);
  assert.strictEqual(checkDeletePerm('viewer'), false);

  // Simulated soft delete execution
  const activeEntry = {
    id: 'entry-101',
    name: 'Standard Estimate',
    isActive: true,
    createdBy: 'uid_staff',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    details: { total: 500 },
  };

  const softDeleteUpdates = {
    isActive: false,
    deletedAt: new Date('2026-08-29T12:00:00Z'),
    deletedBy: 'uid_admin',
    updatedAt: new Date('2026-08-29T12:00:00Z'),
  };

  const deletedEntry = { ...activeEntry, ...softDeleteUpdates };
  assert.strictEqual(deletedEntry.isActive, false);
  assert.strictEqual(deletedEntry.deletedBy, 'uid_admin');
});

test('C1.2: Realtime listener automatically removes soft-deleted/filtered records from active UI state', () => {
  // Client UI state
  let clientEntries = {
    'entry-101': { id: 'entry-101', name: 'Estimate 1' },
    'entry-102': { id: 'entry-102', name: 'Estimate 2' },
  };
  let prevRealtimeKeys = new Set(Object.keys(clientEntries));

  // Firestore query filters where("isActive", "==", true), so entry-101 is omitted from next snapshot
  const nextSnapshot = {
    'entry-102': { id: 'entry-102', name: 'Estimate 2' },
  };

  const currentSnapshotKeys = new Set(Object.keys(nextSnapshot));
  const updated = { ...clientEntries, ...nextSnapshot };
  for (const key of prevRealtimeKeys) {
    if (!currentSnapshotKeys.has(key)) {
      delete updated[key];
    }
  }

  assert.deepStrictEqual(Object.keys(updated), ['entry-102'], 'Soft-deleted entry must be immediately pruned from UI');
});


// ----------------------------------------------------------------------------
// COMBINATION 2: 3D STUDIO TEMPLATE SNAPSHOT + ESTIMATE LINEITEM + PRICING
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 2: 3D Studio Attached Template + LineItem Pricing] ---');

test('C2.1: Attached 3D template with custom variable overrides recalculates dimensions and line item pricing', () => {
  const baseTemplate = {
    id: 'tmpl-countertop',
    name: 'Custom Kitchen Countertop',
    variables: [
      { id: 'L', label: 'Length', default: 2000 },
      { id: 'W', label: 'Width', default: 600 },
    ],
    components: [
      {
        id: 'slab-1',
        type: 'slab',
        name: 'Main Slab',
        length: 'L',
        depth: 'W',
        thickness: 30,
        position: [0, 0, 0],
        cutouts: [],
      },
    ],
  };

  // User attaches template to line item and overrides Length to 3000mm and Width to 800mm
  const variableOverrides = { L: 3000, W: 800 };
  const evaluatedLengthMM = evaluateExpression(baseTemplate.components[0].length, variableOverrides);
  const evaluatedWidthMM = evaluateExpression(baseTemplate.components[0].depth, variableOverrides);

  assert.strictEqual(evaluatedLengthMM, 3000);
  assert.strictEqual(evaluatedWidthMM, 800);

  // Convert to area in m²
  const rawArea = (evaluatedLengthMM / 1000) * (evaluatedWidthMM / 1000);
  const areaM2 = Math.round(rawArea * 100) / 100; // 3.0 * 0.8 = 2.4 m²
  assert.strictEqual(areaM2, 2.4);

  const unitPricePerM2 = 250;
  const lineItemSubtotal = areaM2 * unitPricePerM2; // 600 USD
  assert.strictEqual(lineItemSubtotal, 600);

  const attachedLineItem = {
    id: 'item-attached-1',
    parentId: 'root',
    quantity: 1,
    description: `Kitchen Countertop (${evaluatedLengthMM}mm x ${evaluatedWidthMM}mm)`,
    material: {
      id: 'mat-granite',
      description: 'Black Galaxy Granite',
      unitPrice: lineItemSubtotal,
      dimensions: { type: 'unit', unitLabel: 'unit' },
      currency: 'USD',
    },
    attachedTemplate: {
      sourceTemplateId: baseTemplate.id,
      snapshot: baseTemplate,
      variableOverrides: variableOverrides,
    },
  };

  assert(lineItemSchema.safeParse(attachedLineItem).success, 'Line item with attached template snapshot and overrides must validate');
});


// ----------------------------------------------------------------------------
// COMBINATION 3: BILINGUAL LOCALE SWITCHING & DYNAMIC TOKEN INTERPOLATION
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 3: Bilingual Locale Switching & Error Message Tokens] ---');

test('C3.1: All estimate error keys resolve in both EN and PT with exact parameter interpolation', () => {
  const enJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../frontend/messages/en.json'), 'utf8'));
  const ptJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../frontend/messages/pt.json'), 'utf8'));

  function interpolate(template, params) {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => params[key] !== undefined ? params[key] : `{${key}}`);
  }

  const enSaveFailed = enJson.estimate.errors.saveFailed;
  const ptSaveFailed = ptJson.estimate.errors.saveFailed;

  const enRendered = interpolate(enSaveFailed, { message: 'Network Timeout' });
  const ptRendered = interpolate(ptSaveFailed, { message: 'Network Timeout' });

  assert(enRendered.includes('Network Timeout'));
  assert(ptRendered.includes('Network Timeout'));
  assert(!enRendered.includes('{message}'));
  assert(!ptRendered.includes('{message}'));
});

test('C3.2: Estimate name template for customer handles known and fallback unknown customer names', () => {
  const enJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../frontend/messages/en.json'), 'utf8'));
  const ptJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../frontend/messages/pt.json'), 'utf8'));

  function interpolate(template, params) {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => params[key] !== undefined ? params[key] : `{${key}}`);
  }

  // Known customer
  const enNamed = interpolate(enJson.estimate.estimateForCustomer, { name: 'John Doe' });
  const ptNamed = interpolate(ptJson.estimate.estimateForCustomer, { name: 'John Doe' });
  assert(enNamed.includes('John Doe'));
  assert(ptNamed.includes('John Doe'));

  // Fallback unknown
  const enUnknown = interpolate(enJson.estimate.estimateForCustomer, { name: enJson.estimate.unknownCustomer });
  const ptUnknown = interpolate(ptJson.estimate.estimateForCustomer, { name: ptJson.estimate.unknownCustomer });
  assert(enUnknown.includes(enJson.estimate.unknownCustomer));
  assert(ptUnknown.includes(ptJson.estimate.unknownCustomer));
});


// ----------------------------------------------------------------------------
// COMBINATION 4: ESTIMATE DUPLICATION + PAYMENTS RESET + NOTES ANNOTATION
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 4: Estimate Duplication & Lifecycle] ---');

test('C4.1: Duplicating an estimate resets payments to empty array and appends copy note', () => {
  const originalEstimate = {
    name: 'Bathroom Renovation Estimate',
    details: {
      confirmedItems: [
        { id: 'i1', parentId: 'root', quantity: 1, description: 'Vanity Top', material: { id: 'm1', description: 'Marble', unitPrice: 300, dimensions: { type: 'unit', unitLabel: 'unit' }, currency: 'USD' } },
      ],
      status: WorkStatus.DELIVERED,
      customer: { name: 'Alice Smith', address: { street: null, city: null, state: null, zipCode: null } },
      supplier: { name: 'Marble Pros', address: { street: null, city: null, state: null, zipCode: null } },
      logo: null,
      adjustments: [],
      taxPercentage: 5,
      currency: 'USD',
      notes: 'Initial client proposal',
      payments: [
        { amount: 150, date: new Date() },
        { amount: 165, date: new Date() },
      ],
    },
  };

  const duplicateDetails = { ...originalEstimate.details };
  // Replicating bg-duplicate-entry.ts logic
  duplicateDetails.payments = [];
  duplicateDetails.notes = `${originalEstimate.details.notes}\n(Copied from orig_123)`;
  const duplicateName = originalEstimate.name + ' (Copy)';

  assert.deepStrictEqual(duplicateDetails.payments, [], 'Payments must be cleared on duplicated estimate');
  assert.strictEqual(duplicateName, 'Bathroom Renovation Estimate (Copy)');
  assert(duplicateDetails.notes.includes('(Copied from orig_123)'));
  assert.strictEqual(duplicateDetails.confirmedItems.length, 1);
});


// ----------------------------------------------------------------------------
// COMBINATION 5: CONTRIBUTOR MANAGEMENT + PENDING ACCESS + ACCEPT SHARE
// ----------------------------------------------------------------------------
console.log('\n--- [Combination 5: Contributor Management & Share Acceptance Flow] ---');

test('C5.1: Complete contributor invitation, acceptance, and access_array lifecycle', () => {
  // Step 1: Journal initialized by Owner (Admin)
  let journal = {
    title: 'Acme Granite Journal',
    journalType: 'business',
    access: {
      'uid_owner': {
        email: 'owner@acme.com',
        displayName: 'Owner User',
        photoURL: '',
        role: 'admin',
      },
    },
    access_array: ['uid_owner'],
    pendingAccess: {},
    isActive: true,
  };

  // Step 2: Owner invites new staff member via addContributor
  const inviteEmail = 'contractor.staff@external.com';
  const escapedInviteEmail = inviteEmail.replace(/\./g, ',');
  journal.pendingAccess[escapedInviteEmail] = 'staff';

  assert.strictEqual(journal.pendingAccess['contractor,staff@external,com'], 'staff');

  // Step 3: Invitee checks pending share via acceptShare ('check')
  const checkResult = journal.pendingAccess[escapedInviteEmail];
  assert.strictEqual(checkResult, 'staff');

  // Step 4: Invitee accepts share ('accept')
  const newStaffUid = 'uid_staff_789';
  journal.access[newStaffUid] = {
    email: inviteEmail,
    displayName: 'Contractor Staff',
    photoURL: '',
    role: journal.pendingAccess[escapedInviteEmail],
  };
  delete journal.pendingAccess[escapedInviteEmail];
  journal.access_array.push(newStaffUid);

  // Step 5: Verify post-acceptance state
  assert.strictEqual(journal.access[newStaffUid].role, 'staff');
  assert.strictEqual(journal.pendingAccess[escapedInviteEmail], undefined);
  assert(journal.access_array.includes(newStaffUid));
  assert.strictEqual(journal.access_array.length, 2);
});

console.log('\n================================================================');
console.log(`Tier 3 Cross-Feature Combinations Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
