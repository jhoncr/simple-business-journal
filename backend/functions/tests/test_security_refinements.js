// backend/functions/tests/test_security_refinements.js
// Unit tests for backend security, validation, RBAC, and schema hardening.
// Run via: npm test (or node --test tests/test_security_refinements.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

const {
  PRODUCTION_ALLOWED_ORIGINS,
  EMULATOR_ALLOWED_ORIGINS,
} = require('../lib/lib/bg-consts');
const { flattenToDotNotation } = require('../lib/helpers/object-utils');
const { sanitizeAuditInput } = require('../lib/helpers/audited-function');
const {
  normalizeEmail,
  escapeEmailKey,
  findPendingAccessKey,
} = require('../lib/helpers/email-utils');
const {
  paymentSchema,
  materialSchema,
  lineItemSchema,
  adjustmentSchema,
  estimateDetailsStateSchema,
  attachedTemplateSchema,
} = require('../lib/common/schemas/estimate_schema');
const {
  ExpressionSchema,
  DimensionLabelSchema,
  CameraViewSchema,
  AssemblyVariableSchema,
  AssemblyTemplateSchema,
} = require('../lib/common/schemas/studio');
const { entrySchema } = require('../lib/common/schemas/configmap');
const { docIdSchema } = require('../lib/common/schemas/common_schemas');
const {
  parseThumbnailDataUrl,
  preserveServerPayments,
} = require('../lib/bg-add-log-entry');
const { assertVerifiedEmailForShare } = require('../lib/bg-accept-share');
const {
  buildJournalUpdatePayload,
  UpdateJournalPayloadSchema,
} = require('../lib/bg-journal-management');
const { applyPaymentMutations } = require('../lib/bg-payments');

function matchesAnyOrigin(origin, patterns) {
  return patterns.some((p) => (p instanceof RegExp ? p.test(origin) : p === origin));
}

// ---------------------------------------------------------------------------
// 1. CORS Origin Anchoring
// ---------------------------------------------------------------------------
test('CORS production regexes accept anchored project and custom HTTPS origins', () => {
  const allowed = [
    'https://nessedia-3d219.web.app',
    'https://nessedia-3d219--pr-42.web.app',
    'https://nessedia-3d219.firebaseapp.com',
    'https://simple-log-19f86.web.app',
    'https://simple-log-19f86--preview-1.firebaseapp.com',
    'https://demo-dummy.web.app',
    'https://j3cordeiro.com',
    'https://app.j3cordeiro.com',
  ];
  for (const origin of allowed) {
    assert.ok(
      matchesAnyOrigin(origin, PRODUCTION_ALLOWED_ORIGINS),
      `Expected ${origin} to be allowed`,
    );
  }
});

test('CORS production regexes reject unanchored, HTTP, and foreign origins', () => {
  const rejected = [
    'http://nessedia-3d219.web.app',
    'http://j3cordeiro.com',
    'https://attacker.web.app',
    'https://attacker.firebaseapp.com',
    'https://evil-j3cordeiro.com',
    'https://evil.com/nessedia-3d219.web.app',
    'https://nessedia-3d219.web.app.evil.com',
    'https://evil.com?ref=j3cordeiro.com',
    'http://localhost:3000',
  ];
  for (const origin of rejected) {
    assert.ok(
      !matchesAnyOrigin(origin, PRODUCTION_ALLOWED_ORIGINS),
      `Expected ${origin} to be rejected in production`,
    );
  }
});

test('CORS emulator regexes allow localhost and 127.0.0.1', () => {
  assert.ok(matchesAnyOrigin('http://localhost:3000', EMULATOR_ALLOWED_ORIGINS));
  assert.ok(matchesAnyOrigin('http://127.0.0.1:3000', EMULATOR_ALLOWED_ORIGINS));
  assert.ok(!matchesAnyOrigin('https://evil.com', EMULATOR_ALLOWED_ORIGINS));
});

// ---------------------------------------------------------------------------
// 2. object-utils dot-key guard & logo:null preservation
// ---------------------------------------------------------------------------
test('flattenToDotNotation rejects top-level and nested keys containing dots', () => {
  assert.throws(
    () => flattenToDotNotation({ 'access.evil': 'admin' }),
    /must not contain "\."/,
  );
  assert.throws(
    () => flattenToDotNotation({ contactInfo: { 'a.b': 'c' } }, 'details'),
    /must not contain "\."/,
  );
});

test('buildJournalUpdatePayload keeps explicit details.logo = null instead of FieldValue.delete()', () => {
  const payload = buildJournalUpdatePayload('Acme Stone', {
    logo: null,
    contactInfo: {
      phone: null,
      name: 'Acme Stone',
    },
  });
  assert.equal(payload.title, 'Acme Stone');
  assert.equal(payload['details.logo'], null);
  assert.ok(payload['details.contactInfo.phone'] instanceof FieldValue);
  assert.equal(payload['details.contactInfo.name'], 'Acme Stone');
});

test('UpdateJournalPayloadSchema enforces title min(1).max(120) and valid jid', () => {
  assert.ok(
    UpdateJournalPayloadSchema.safeParse({ jid: 'journal_123', title: 'A' }).success,
  );
  assert.ok(
    UpdateJournalPayloadSchema.safeParse({ jid: 'journal_123', title: 'A'.repeat(120) }).success,
  );
  assert.ok(
    !UpdateJournalPayloadSchema.safeParse({ jid: 'journal_123', title: '' }).success,
  );
  assert.ok(
    !UpdateJournalPayloadSchema.safeParse({ jid: 'journal_123', title: 'A'.repeat(121) }).success,
  );
  assert.ok(
    !UpdateJournalPayloadSchema.safeParse({ jid: '../escape', title: 'Valid' }).success,
  );
});

// ---------------------------------------------------------------------------
// 3. estimate_schema numeric .finite(), .nonnegative(), and payment caps
// ---------------------------------------------------------------------------
test('estimate_schema rejects non-finite numbers and negative unitPrice', () => {
  const baseMaterial = {
    id: 'm1',
    description: 'Granite',
    unitPrice: 100,
    dimensions: { type: 'area', unitLabel: 'm²' },
    currency: 'USD',
  };

  assert.ok(materialSchema.safeParse(baseMaterial).success);
  assert.ok(!materialSchema.safeParse({ ...baseMaterial, unitPrice: -1 }).success);
  assert.ok(!materialSchema.safeParse({ ...baseMaterial, unitPrice: Infinity }).success);
  assert.ok(!materialSchema.safeParse({ ...baseMaterial, unitPrice: NaN }).success);

  const basePayment = { amount: 50, date: new Date() };
  assert.ok(paymentSchema.safeParse(basePayment).success);
  assert.ok(!paymentSchema.safeParse({ ...basePayment, amount: Infinity }).success);
  assert.ok(!paymentSchema.safeParse({ ...basePayment, amount: NaN }).success);
  assert.ok(paymentSchema.safeParse({ ...basePayment, method: 'x'.repeat(60) }).success);
  assert.ok(!paymentSchema.safeParse({ ...basePayment, method: 'x'.repeat(61) }).success);
  assert.ok(paymentSchema.safeParse({ ...basePayment, transactionId: 't'.repeat(120) }).success);
  assert.ok(!paymentSchema.safeParse({ ...basePayment, transactionId: 't'.repeat(121) }).success);

  assert.ok(
    !adjustmentSchema.safeParse({ type: 'addFixed', value: Infinity, description: 'fee' }).success,
  );
  assert.ok(
    !lineItemSchema.safeParse({
      id: 'i1',
      parentId: 'root',
      quantity: Infinity,
      description: 'Item',
      material: baseMaterial,
    }).success,
  );
  assert.ok(
    !attachedTemplateSchema.safeParse({
      sourceTemplateId: 'tpl1',
      snapshot: { id: 'tpl1', name: 'T', variables: [], components: [] },
      variableOverrides: { width: Infinity },
    }).success,
  );
  assert.ok(
    !estimateDetailsStateSchema.safeParse({
      confirmedItems: [],
      status: 'DRAFT',
      customer: { name: 'Customer One', address: {} },
      supplier: { name: 'Supplier One', address: {} },
      logo: null,
      adjustments: [],
      taxPercentage: Infinity,
      currency: 'USD',
    }).success,
  );
});

// ---------------------------------------------------------------------------
// 4. studio.ts numeric .finite(), zoomMultiplier, edge compatibility, array caps
// ---------------------------------------------------------------------------
test('studio.ts enforces finite/positive zoomMultiplier, finite numbers, edge names, and array caps', () => {
  // zoomMultiplier
  const baseCam = { id: 'c1', name: 'Main', preset: 'iso-tfr', isDefault: true };
  assert.ok(CameraViewSchema.safeParse({ ...baseCam, zoomMultiplier: 1.5 }).success);
  assert.ok(!CameraViewSchema.safeParse({ ...baseCam, zoomMultiplier: 0 }).success);
  assert.ok(!CameraViewSchema.safeParse({ ...baseCam, zoomMultiplier: -2 }).success);
  assert.ok(!CameraViewSchema.safeParse({ ...baseCam, zoomMultiplier: Infinity }).success);
  assert.ok(!CameraViewSchema.safeParse({ ...baseCam, zoomMultiplier: NaN }).success);

  // ExpressionSchema & AssemblyVariableSchema finite guard
  assert.ok(ExpressionSchema.safeParse(120).success);
  assert.ok(!ExpressionSchema.safeParse(Infinity).success);
  assert.ok(!ExpressionSchema.safeParse(NaN).success);
  assert.ok(
    !AssemblyVariableSchema.safeParse({ id: 'v1', label: 'L', default: Infinity }).success,
  );

  // DimensionLabelSchema edge compatibility across all edge types
  const edges = [
    'front',
    'back',
    'left',
    'right',
    'custom',
    'top-front',
    'top-back',
    'bottom-left',
    'front-right',
    'back-left',
  ];
  for (const edge of edges) {
    assert.ok(
      DimensionLabelSchema.safeParse({
        id: 'dl1',
        type: 'dimension_label',
        name: 'Length',
        edge,
        text: 'L',
        offset: 15,
      }).success,
      `DimensionLabelSchema should accept edge '${edge}'`,
    );
  }
  assert.ok(
    !DimensionLabelSchema.safeParse({
      id: 'dl1',
      type: 'dimension_label',
      name: 'Length',
      edge: 'front',
      text: 'L',
      offset: Infinity,
    }).success,
  );

  // Array caps on AssemblyTemplateSchema
  const tooManyVars = Array.from({ length: 101 }, (_, i) => ({
    id: `v${i}`,
    label: `Var ${i}`,
    default: 10,
  }));
  assert.ok(
    !AssemblyTemplateSchema.safeParse({
      id: 'tpl1',
      name: 'Too Many Vars',
      variables: tooManyVars,
      components: [],
    }).success,
  );

  const tooManyViews = Array.from({ length: 51 }, (_, i) => ({
    id: `cam${i}`,
    name: `Cam ${i}`,
    preset: 'front',
    isDefault: i === 0,
  }));
  assert.ok(
    !AssemblyTemplateSchema.safeParse({
      id: 'tpl1',
      name: 'Too Many Views',
      variables: [],
      components: [],
      cameraViews: tooManyViews,
    }).success,
  );
});

// ---------------------------------------------------------------------------
// 5. Email normalization & legacy mixed-case pendingAccess matching
// ---------------------------------------------------------------------------
test('email-utils normalizes, escapes, and matches legacy mixed-case pendingAccess keys', () => {
  assert.equal(normalizeEmail('  Alice.Smith@Example.COM  '), 'alice.smith@example.com');
  assert.equal(escapeEmailKey('  Alice.Smith@Example.COM  '), 'alice,smith@example,com');

  const legacyPending = {
    'Bob,Jones@Company,COM': 'editor',
    'carol@test,io': 'viewer',
  };
  assert.equal(
    findPendingAccessKey(legacyPending, 'bob.jones@company.com'),
    'Bob,Jones@Company,COM',
  );
  assert.equal(
    findPendingAccessKey(legacyPending, '  CAROL@TEST.IO '),
    'carol@test,io',
  );
  assert.equal(
    findPendingAccessKey(legacyPending, 'nobody@example.com'),
    undefined,
  );
});

// ---------------------------------------------------------------------------
// 6. bg-add-log-entry: doc ID validation, MIME allowlist, server-owned payments
// ---------------------------------------------------------------------------
test('docIdSchema and entrySchema reject path traversal and malformed document IDs', () => {
  assert.ok(docIdSchema.safeParse('journal_abc-123').success);
  assert.ok(!docIdSchema.safeParse('').success);
  assert.ok(!docIdSchema.safeParse('../otherJournal').success);
  assert.ok(!docIdSchema.safeParse('a/b').success);
  assert.ok(!docIdSchema.safeParse('a.b').success);
  assert.ok(!docIdSchema.safeParse('a'.repeat(129)).success);

  const baseEntry = {
    jid: 'journal_123',
    entryType: 'estimate',
    name: 'Valid Estimate',
    details: {},
  };
  assert.ok(entrySchema.safeParse(baseEntry).success);
  assert.ok(entrySchema.safeParse({ ...baseEntry, entryId: 'entry_456' }).success);
  assert.ok(!entrySchema.safeParse({ ...baseEntry, jid: 'bad/jid' }).success);
  assert.ok(!entrySchema.safeParse({ ...baseEntry, entryId: '../bad' }).success);
});

test('parseThumbnailDataUrl allows PNG, JPEG, WebP and rejects SVG/malformed data URLs', () => {
  const png = parseThumbnailDataUrl('data:image/png;base64,iVBORw0KGgo=');
  assert.equal(png.contentType, 'image/png');
  assert.equal(png.ext, 'png');
  assert.ok(png.buffer.length > 0);

  const jpeg = parseThumbnailDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  assert.equal(jpeg.contentType, 'image/jpeg');
  assert.equal(jpeg.ext, 'jpeg');

  const webp = parseThumbnailDataUrl('data:image/webp;base64,UklGRh4AAABXRUJQ');
  assert.equal(webp.contentType, 'image/webp');
  assert.equal(webp.ext, 'webp');

  assert.throws(
    () => parseThumbnailDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='),
    /Unsupported thumbnail MIME type/,
  );
  assert.throws(
    () => parseThumbnailDataUrl('data:text/html;base64,PHNjcmlwdD4='),
    /Invalid thumbnail image format/,
  );
  assert.throws(
    () => parseThumbnailDataUrl('not-a-data-url'),
    /Invalid thumbnail image format/,
  );
});

test('preserveServerPayments enforces empty payments on create and preserves server payments on update', () => {
  const forged = [{ id: 'fake', amount: 9999, date: new Date() }];
  const onCreate = preserveServerPayments({ notes: 'test', payments: forged });
  assert.deepEqual(onCreate.payments, []);

  const serverPayments = [{ id: 'srv-1', amount: 250, date: new Date() }];
  const onUpdate = preserveServerPayments(
    { notes: 'updated', payments: forged },
    serverPayments,
  );
  assert.deepEqual(onUpdate.payments, serverPayments);

  const onUpdateEmptyClient = preserveServerPayments(
    { notes: 'updated', payments: [] },
    serverPayments,
  );
  assert.deepEqual(onUpdateEmptyClient.payments, serverPayments);
});

// ---------------------------------------------------------------------------
// 7. bg-accept-share: email_verified requirement & audit/status guards
// ---------------------------------------------------------------------------
test('assertVerifiedEmailForShare rejects unverified or missing email and normalizes verified email', () => {
  assert.equal(
    assertVerifiedEmailForShare({
      email: '  Alice@Example.COM ',
      email_verified: true,
    }),
    'alice@example.com',
  );
  assert.throws(
    () => assertVerifiedEmailForShare({ email: 'alice@example.com', email_verified: false }),
    /must be verified/,
  );
  assert.throws(
    () => assertVerifiedEmailForShare({ email: 'alice@example.com' }),
    /must be verified/,
  );
  assert.throws(
    () => assertVerifiedEmailForShare({ email_verified: true }),
    /must be verified/,
  );
});

// ---------------------------------------------------------------------------
// 8. bg-payments: legacy payments missing id & non-finite guard
// ---------------------------------------------------------------------------
test('applyPaymentMutations handles legacy payments missing id cleanly', () => {
  const legacyDetails = {
    confirmedItems: [{ quantity: 1, material: { unitPrice: 500 } }],
    adjustments: [],
    taxPercentage: 0,
    payments: [
      { amount: 100, date: new Date('2026-01-01') }, // no id
      { amount: 150, date: new Date('2026-01-02') }, // no id
    ],
  };

  const result = applyPaymentMutations(
    legacyDetails,
    {
      add: [{ amount: 50, date: new Date('2026-02-01') }],
    },
    'user-1',
    Timestamp.now(),
  );

  assert.equal(result.length, 3);
  const ids = new Set(result.map((p) => p.id));
  assert.equal(ids.size, 3, 'All legacy and new payments must receive unique IDs');
  for (const p of result) {
    assert.equal(typeof p.id, 'string');
    assert.ok(p.id.length > 0);
  }
});

// ---------------------------------------------------------------------------
// 9. audited-function: DATA_IMAGE_REGEX strips hyphenated & numeric MIME subtypes
// ---------------------------------------------------------------------------
test('sanitizeAuditInput strips base64 data URLs with hyphenated and numeric MIME subtypes', () => {
  const out = sanitizeAuditInput({
    icon: 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    jp2: 'data:image/jp2;base64,AAAAIGZ0eXBqcDI=',
    svg: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
  });
  assert.match(out.icon, /\[stripped image data URL \(\d+ chars\)\]/);
  assert.match(out.jp2, /\[stripped image data URL \(\d+ chars\)\]/);
  assert.match(out.svg, /\[stripped image data URL \(\d+ chars\)\]/);
});

// ---------------------------------------------------------------------------
// 10. Security Rules static verification
// ---------------------------------------------------------------------------
test('firestore.rules and storage.rules include auth, exists, and isActive guards', () => {
  const firestoreRules = fs.readFileSync(
    path.resolve(__dirname, '../../firestore.rules'),
    'utf8',
  );
  assert.ok(firestoreRules.includes('request.auth != null'));
  assert.ok(firestoreRules.includes('exists(/databases/$(database)/documents/journals/$(journalId))'));
  assert.ok(firestoreRules.includes("!('isActive' in docData)"));
  assert.ok(!firestoreRules.includes('function isDocumentActive'));

  const storageRules = fs.readFileSync(
    path.resolve(__dirname, '../../storage.rules'),
    'utf8',
  );
  assert.ok(storageRules.includes('let journalData = firestore.get('));
  assert.ok(storageRules.includes('firestore.exists(/databases/(default)/documents/journals/$(journalId))'));
  assert.ok(
    storageRules.includes(
      'firestore.exists(/databases/(default)/documents/journals/$(journalId)/templates/$(templateId))',
    ),
  );
  assert.ok(storageRules.includes("!('isActive' in docData)"));
});
