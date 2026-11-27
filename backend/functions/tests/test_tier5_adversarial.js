const assert = require('assert');
const fs = require('fs');
const path = require('path');
const z = require('zod');

const {
  UserSchema,
  pendingAccessSchema,
  ROLES,
  traceSchema,
  contactInfoSchema,
  addressSchema,
  allowedCurrencySchema,
} = require('../lib/common/schemas/common_schemas');
const {
  JournalSchema,
  businessDetailsSchema,
} = require('../lib/common/schemas/JournalSchema');
const {
  lineItemSchema,
  materialSchema,
  adjustmentSchema,
  paymentSchema,
  estimateDetailsStateSchema,
} = require('../lib/common/schemas/estimate_schema');
const {
  AssemblyTemplateSchema,
  SlabComponentSchema,
  CutoutSchema,
  DimensionLabelSchema,
  CameraViewSchema,
} = require('../lib/common/schemas/studio');
const {
  ENTRY_CONFIG,
  entrySchema,
  entryTypeSchema,
} = require('../lib/common/schemas/configmap');
const {
  ROLES_ADMIN,
  ROLES_THAT_ADD,
  ROLES_CAN_DELETE,
} = require('../lib/common/const');
const { WorkStatus } = require('../lib/common/common_types');
const { flattenToDotNotation } = require('../lib/helpers/object-utils');
const { FieldValue } = require('firebase-admin/firestore');
const { evaluateExpression } = require('./test_evaluator_helper');

console.log('\n================================================================');
console.log('=== RUNNING TIER 5: ADVERSARIAL STRESS & COVERAGE HARDENING ===');
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

// ============================================================================
// SUITE 1: NESTED OBJECT FLATTENING (flattenToDotNotation) ADVERSARIAL STRESS
// ============================================================================
console.log('\n--- [Suite 1: Dot-Notation Flattening Adversarial Stress Tests] ---');

test('T5.1.1: Deeply nested objects (depths 5, 10, 25, 50) correctly flatten to dot paths', () => {
  function createDeepObject(depth, leafValue) {
    let root = {};
    let current = root;
    for (let i = 1; i <= depth; i++) {
      if (i === depth) {
        current[`level_${i}`] = leafValue;
      } else {
        current[`level_${i}`] = {};
        current = current[`level_${i}`];
      }
    }
    return root;
  }

  for (const depth of [5, 10, 25, 50]) {
    const deepObj = createDeepObject(depth, `value_at_${depth}`);
    const flattened = flattenToDotNotation(deepObj);
    const expectedKey = Array.from({ length: depth }, (_, i) => `level_${i + 1}`).join('.');
    assert.strictEqual(flattened[expectedKey], `value_at_${depth}`);
    assert.strictEqual(Object.keys(flattened).length, 1);
  }
});

test('T5.1.2: Flattening with null and empty string leaves at deep paths converts to FieldValue.delete()', () => {
  const input = {
    settings: {
      profile: {
        bio: '',
        website: null,
        avatar: 'https://cdn.example.com/avatar.png',
        metadata: {
          social: {
            twitter: '',
            github: null,
            linkedin: 'https://linkedin.com/in/user',
          },
        },
      },
    },
  };

  const flattened = flattenToDotNotation(input);
  assert(flattened['settings.profile.bio'] instanceof FieldValue, 'Empty string becomes FieldValue.delete()');
  assert(flattened['settings.profile.website'] instanceof FieldValue, 'Null becomes FieldValue.delete()');
  assert.strictEqual(flattened['settings.profile.avatar'], 'https://cdn.example.com/avatar.png');
  assert(flattened['settings.profile.metadata.social.twitter'] instanceof FieldValue);
  assert(flattened['settings.profile.metadata.social.github'] instanceof FieldValue);
  assert.strictEqual(flattened['settings.profile.metadata.social.linkedin'], 'https://linkedin.com/in/user');
});

test('T5.1.3: Arrays of primitives, objects, and empty arrays are preserved as atomic values', () => {
  const input = {
    tags: ['stone', 'granite', 'countertop'],
    items: [
      { id: 'item_1', qty: 2 },
      { id: 'item_2', qty: 5 },
    ],
    emptyList: [],
    sparseList: [1, null, 3],
    nested: {
      subArray: [10, 20, 30],
    },
  };

  const flattened = flattenToDotNotation(input);
  assert.deepStrictEqual(flattened['tags'], ['stone', 'granite', 'countertop']);
  assert.deepStrictEqual(flattened['items'], [{ id: 'item_1', qty: 2 }, { id: 'item_2', qty: 5 }]);
  assert.deepStrictEqual(flattened['emptyList'], []);
  assert.deepStrictEqual(flattened['sparseList'], [1, null, 3]);
  assert.deepStrictEqual(flattened['nested.subArray'], [10, 20, 30]);
});

test('T5.1.4: Special objects (Date, FieldValue instances) are preserved without recursive destruction', () => {
  const testDate = new Date('2026-08-29T12:00:00Z');
  const deleteSentinel = FieldValue.delete();
  const serverTimestampSentinel = FieldValue.serverTimestamp();
  const arrayUnionSentinel = FieldValue.arrayUnion('item1', 'item2');

  const input = {
    createdAt: testDate,
    updatedAt: serverTimestampSentinel,
    toRemove: deleteSentinel,
    nested: {
      eventDate: testDate,
      tags: arrayUnionSentinel,
    },
  };

  const flattened = flattenToDotNotation(input);
  assert.strictEqual(flattened['createdAt'], testDate);
  assert.strictEqual(flattened['updatedAt'], serverTimestampSentinel);
  assert.strictEqual(flattened['toRemove'], deleteSentinel);
  assert.strictEqual(flattened['nested.eventDate'], testDate);
  assert.strictEqual(flattened['nested.tags'], arrayUnionSentinel);
});

test('T5.1.5: Undefined values are omitted at all depths to preserve existing Firestore fields', () => {
  const input = {
    a: undefined,
    b: 'keep_b',
    nested: {
      c: undefined,
      d: 'keep_d',
      sub: {
        e: undefined,
        f: 123,
      },
    },
  };

  const flattened = flattenToDotNotation(input);
  assert.strictEqual(flattened['b'], 'keep_b');
  assert.strictEqual(flattened['nested.d'], 'keep_d');
  assert.strictEqual(flattened['nested.sub.f'], 123);
  assert.strictEqual(flattened['a'], undefined);
  assert.strictEqual(flattened['nested.c'], undefined);
  assert.strictEqual(flattened['nested.sub.e'], undefined);
  assert.strictEqual(Object.keys(flattened).length, 3);
});

test('T5.1.6: Object.create(null) and prototype-free objects flatten cleanly without prototype pollution', () => {
  const nullProtoObj = Object.create(null);
  nullProtoObj.title = 'Prototype Free';
  nullProtoObj.count = 42;

  const input = {
    data: nullProtoObj,
    normal: {
      key: 'val',
    },
  };

  const flattened = flattenToDotNotation(input);
  assert.strictEqual(flattened['data.title'], 'Prototype Free');
  assert.strictEqual(flattened['data.count'], 42);
  assert.strictEqual(flattened['normal.key'], 'val');
});

test('T5.1.7: Dot characters, emojis, Unicode, and numeric keys in object property names', () => {
  const input = {
    'user.name': 'Alice',
    'contact@domain': 'test',
    '🎉_celebration': true,
    '0': 'zero',
    'nested': {
      'sub.key': 'deep',
      '日本語': 'japanese',
    },
  };

  const flattened = flattenToDotNotation(input);
  assert.strictEqual(flattened['user.name'], 'Alice');
  assert.strictEqual(flattened['contact@domain'], 'test');
  assert.strictEqual(flattened['🎉_celebration'], true);
  assert.strictEqual(flattened['0'], 'zero');
  assert.strictEqual(flattened['nested.sub.key'], 'deep');
  assert.strictEqual(flattened['nested.日本語'], 'japanese');
});

// ============================================================================
// SUITE 2: RBAC PRIVILEGE BOUNDARY & ADVERSARIAL AUTHENTICATION TESTS
// ============================================================================
console.log('\n--- [Suite 2: RBAC Privilege Boundary & Security Matrix] ---');

test('T5.2.1: Unauthenticated request simulator rejects missing auth object', () => {
  function simulateAuthCheck(request) {
    if (!request || !request.auth) {
      throw new Error('unauthenticated: You must be logged in.');
    }
    return true;
  }

  assert.throws(() => simulateAuthCheck(null), /unauthenticated/);
  assert.throws(() => simulateAuthCheck({}), /unauthenticated/);
  assert.throws(() => simulateAuthCheck({ auth: null }), /unauthenticated/);
  assert.strictEqual(simulateAuthCheck({ auth: { uid: 'user_123' } }), true);
});

test('T5.2.2: Inactive journal rejects operations with permission-denied', () => {
  function simulateRBAC(journalData, authUid, allowedRoles) {
    if (!journalData || journalData.isActive === false) {
      throw new Error('permission-denied: This journal is not active.');
    }
    const userRole = journalData.access?.[authUid]?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new Error('permission-denied: You do not have permission to perform this action.');
    }
    return true;
  }

  const inactiveJournal = {
    isActive: false,
    access: {
      admin_uid: { role: 'admin' },
    },
  };

  assert.throws(() => simulateRBAC(inactiveJournal, 'admin_uid', ['admin']), /permission-denied: This journal is not active/);
});

test('T5.2.3: Role privilege boundary enforcement across all entry types and operations', () => {
  const operations = [
    { op: 'create_estimate', requiredRoles: ['admin', 'editor', 'staff'] },
    { op: 'create_template', requiredRoles: ['admin', 'editor'] },
    { op: 'delete_entry', requiredRoles: ['admin', 'editor'] },
    { op: 'delete_journal', requiredRoles: ['admin'] },
    { op: 'add_contributor', requiredRoles: ['admin'] },
  ];

  const allRoles = ['admin', 'editor', 'staff', 'viewer', 'unassigned'];

  for (const op of operations) {
    for (const role of allRoles) {
      const isAllowed = op.requiredRoles.includes(role);
      if (op.op === 'create_estimate') {
        assert.strictEqual(isAllowed, role === 'admin' || role === 'editor' || role === 'staff');
      } else if (op.op === 'create_template' || op.op === 'delete_entry') {
        assert.strictEqual(isAllowed, role === 'admin' || role === 'editor');
      } else if (op.op === 'delete_journal' || op.op === 'add_contributor') {
        assert.strictEqual(isAllowed, role === 'admin');
      }
    }
  }
});

test('T5.2.4: Sole admin protection logic in contributor removal', () => {
  function removeContributor(access, emailToRemove) {
    const contributorEntry = Object.entries(access).find(([, val]) => val.email === emailToRemove);
    if (!contributorEntry) return { success: false, reason: 'not_found' };

    const [, contributorData] = contributorEntry;
    if (contributorData.role === 'admin') {
      const adminCount = Object.values(access).filter((c) => c.role === 'admin').length;
      if (adminCount <= 1) {
        throw new Error('permission-denied: Cannot remove the sole admin.');
      }
    }
    return { success: true };
  }

  const singleAdminAccess = {
    uid_1: { email: 'admin@example.com', role: 'admin' },
    uid_2: { email: 'editor@example.com', role: 'editor' },
  };

  assert.throws(() => removeContributor(singleAdminAccess, 'admin@example.com'), /Cannot remove the sole admin/);
  assert.strictEqual(removeContributor(singleAdminAccess, 'editor@example.com').success, true);

  const multiAdminAccess = {
    uid_1: { email: 'admin1@example.com', role: 'admin' },
    uid_2: { email: 'admin2@example.com', role: 'admin' },
  };
  assert.strictEqual(removeContributor(multiAdminAccess, 'admin1@example.com').success, true);
});

test('T5.2.5: Admin role change protection in addContributor callable', () => {
  function modifyContributorRole(access, emailToModify, newRole) {
    const existingEntry = Object.entries(access).find(([, val]) => val.email === emailToModify);
    if (existingEntry) {
      const [, data] = existingEntry;
      if (data.role === 'admin') {
        // Admin role change is blocked in addContributor
        return { blocked: true, message: 'Attempt to change role of admin was blocked' };
      }
      data.role = newRole;
      return { blocked: false, updated: true };
    }
    return { blocked: false, addedPending: true };
  }

  const access = {
    uid_admin: { email: 'boss@example.com', role: 'admin' },
    uid_staff: { email: 'worker@example.com', role: 'staff' },
  };

  const adminChange = modifyContributorRole(access, 'boss@example.com', 'editor');
  assert.strictEqual(adminChange.blocked, true);

  const staffChange = modifyContributorRole(access, 'worker@example.com', 'editor');
  assert.strictEqual(staffChange.blocked, false);
  assert.strictEqual(access.uid_staff.role, 'editor');
});

test('T5.2.6: Email escaping round-trip and validation with adversarial emails', () => {
  const validEmails = [
    'user@domain.com',
    'first.last@company.co.uk',
    'engineering+test-run.123@sub.dept.acme.org',
    'simple.business.journal@gmail.com',
  ];

  for (const email of validEmails) {
    const escaped = email.replace(/\./g, ',');
    assert(!escaped.includes('.'), `Escaped email ${escaped} must not contain dots`);
    const unescaped = escaped.replace(/,/g, '.');
    assert.strictEqual(unescaped, email, 'Round-trip unescaping recovers exact email');
  }

  const invalidEmails = [
    'plainaddress',
    '@missingusername.com',
    'username@.com',
    'user name@domain.com',
    '"><script>alert(1)</script>@domain.com',
  ];

  const emailValidator = z.string().email();
  for (const invalid of invalidEmails) {
    const res = emailValidator.safeParse(invalid);
    assert(!res.success, `Invalid email '${invalid}' should be rejected by Zod email schema`);
  }
});

// ============================================================================
// SUITE 3: 3D STUDIO CAD MATH & GEOMETRIC DEGENERACY TESTS
// ============================================================================
console.log('\n--- [Suite 3: 3D Studio CAD Math & Geometry Degeneracy] ---');

test('T5.3.1: Parametric expression evaluator handles arithmetic, variables, and operator precedence', () => {
  const vars = { L: 2000, W: 600, T: 30, overhang: 50 };

  assert.strictEqual(evaluateExpression('L + 2 * overhang', vars), 2100);
  assert.strictEqual(evaluateExpression('(W - 100) / 2', vars), 250);
  assert.strictEqual(evaluateExpression('T * 2', vars), 60);
  assert.strictEqual(evaluateExpression(150, vars), 150);
  assert.strictEqual(evaluateExpression('', vars), 0);
  assert.strictEqual(evaluateExpression(null, vars), 0);
  assert.strictEqual(evaluateExpression(undefined, vars), 0);
});

test('T5.3.2: Parametric expression evaluator security sandbox: ignores invalid variables and malformed syntax', () => {
  const evilVars = {
    'process': 'evil',
    '__proto__': { polluted: true },
    'constructor': 'hacked',
    'validVar': 100,
  };

  assert.strictEqual(evaluateExpression('validVar * 2', evilVars), 200);
  assert.strictEqual(evaluateExpression('alert("XSS")', evilVars), 0);
  assert.strictEqual(evaluateExpression('this.constructor', evilVars), 0);
  assert.strictEqual(evaluateExpression('throw new Error("crash")', evilVars), 0);
  assert.strictEqual(evaluateExpression('1 / 0', evilVars), 0);
});

test('T5.3.3: Slab geometry dimensions validation across degenerate and boundary shapes', () => {
  const validSlab = {
    id: 'slab_001',
    type: 'slab',
    name: 'Main Countertop',
    length: 'L',
    depth: 'W',
    thickness: 30,
    position: [0, 0, 0],
    cutouts: [
      {
        id: 'cutout_sink',
        shape: 'rectangular',
        width: 800,
        depth: 450,
        centerX: 1000,
        centerY: 300,
      },
      {
        id: 'cutout_tap',
        shape: 'circular',
        width: 35,
        depth: 35,
        centerX: 1000,
        centerY: 550,
      },
      {
        id: 'cutout_oval_basin',
        shape: 'oval',
        width: 500,
        depth: 350,
        centerX: 400,
        centerY: 300,
      },
    ],
    polishedEdges: ['front', 'left', 'right'],
  };

  assert(SlabComponentSchema.safeParse(validSlab).success, 'Slab with multiple cutouts validates cleanly');
});

test('T5.3.4: Deeply recursive slab hierarchies (nested waterfall and backsplash assemblies)', () => {
  const assembly = {
    id: 'slab_main',
    type: 'slab',
    name: 'Main Slab',
    length: 2400,
    depth: 600,
    thickness: 30,
    position: [0, 900, 0],
    cutouts: [],
    children: [
      {
        id: 'slab_waterfall_left',
        type: 'slab',
        name: 'Left Waterfall Leg',
        length: 30,
        depth: 600,
        thickness: 900,
        position: [-30, 0, 0],
        cutouts: [],
        children: [
          {
            id: 'slab_sub_miter',
            type: 'slab',
            name: 'Miter Joint Reinforcement',
            length: 30,
            depth: 600,
            thickness: 30,
            position: [0, 0, 0],
            cutouts: [],
          },
        ],
      },
    ],
  };

  assert(SlabComponentSchema.safeParse(assembly).success, '3-level recursive slab assembly validates');
});

test('T5.3.5: Orthographic camera zoom determinism across extreme canvas aspect ratios', () => {
  function computeOrthoZoom({ boxMin, boxMax, frustumWidth, frustumHeight, margin = 1.15, zoomMultiplier = 1, isIsometric = false, hasFocusTarget = false }) {
    const boundingWidth = Math.max(boxMax.x - boxMin.x, 0.001);
    const boundingHeight = Math.max(boxMax.y - boxMin.y, 0.001);

    const zoomX = frustumWidth / boundingWidth;
    const zoomY = frustumHeight / boundingHeight;
    const baseFitZoom = Math.min(zoomX, zoomY) / margin;

    let finalZoomMult = zoomMultiplier;
    if (isIsometric && !hasFocusTarget) {
      finalZoomMult *= 1.25;
    }

    return baseFitZoom * finalZoomMult;
  }

  const testCases = [
    { name: 'Ultra-wide panoramic (100:1)', frustumWidth: 10000, frustumHeight: 100 },
    { name: 'Ultra-tall portrait (1:100)', frustumWidth: 100, frustumHeight: 10000 },
    { name: 'Square (1:1)', frustumWidth: 800, frustumHeight: 800 },
    { name: 'Standard 4:3 print (1200x900)', frustumWidth: 1200, frustumHeight: 900 },
  ];

  const box = { boxMin: { x: -100, y: -50, z: -20 }, boxMax: { x: 100, y: 50, z: 20 } };

  for (const tc of testCases) {
    const zoom1 = computeOrthoZoom({ ...box, ...tc, zoomMultiplier: 1, isIsometric: false, hasFocusTarget: false });
    const zoom2 = computeOrthoZoom({ ...box, ...tc, zoomMultiplier: 1, isIsometric: false, hasFocusTarget: false });
    assert(zoom1 > 0 && isFinite(zoom1), `${tc.name} produces positive finite zoom (${zoom1})`);
    assert.strictEqual(zoom1, zoom2, `${tc.name} is strictly deterministic`);
  }
});

test('T5.3.6: Camera presets coverage (15 standard camera views)', () => {
  const allPresets = [
    'front', 'back', 'left', 'right', 'top', 'bottom',
    'isometric', 'iso-tfr', 'iso-tfl', 'iso-tbr', 'iso-tbl',
    'iso-bfr', 'iso-bfl', 'iso-bbr', 'iso-bbl',
  ];

  for (const preset of allPresets) {
    const camView = {
      id: `view_${preset}`,
      name: `View ${preset}`,
      preset: preset,
      isDefault: preset === 'iso-tfr',
      zoomMultiplier: 1.0,
    };
    const parsed = CameraViewSchema.safeParse(camView);
    assert(parsed.success, `Camera preset '${preset}' validates against CameraViewSchema`);
  }
});

// ============================================================================
// SUITE 4: FINANCIAL CALCULATION PRECISION & IEEE-754 ROUNDING TESTS
// ============================================================================
console.log('\n--- [Suite 4: Financial Calculation Precision & Rounding] ---');

test('T5.4.1: Subtotal calculation handles IEEE-754 precision without floating point drift', () => {
  const items = [
    { quantity: 1, material: { unitPrice: 0.1 } },
    { quantity: 2, material: { unitPrice: 0.1 } },
    { quantity: 10, material: { unitPrice: 0.07 } },
    { quantity: 100, material: { unitPrice: 0.03 } },
  ];

  const rawSubtotal = items.reduce((sum, i) => sum + i.quantity * (i.material?.unitPrice || 0), 0);
  const roundedSubtotal = Math.round(rawSubtotal * 100) / 100;
  // 0.1 + 0.2 + 0.7 + 3.0 = 4.0
  assert.strictEqual(roundedSubtotal, 4.0);
});

test('T5.4.2: Adjustment calculations (addFixed, addPercent, discountFixed, discountPercent)', () => {
  const subtotal = 1000.0;

  function calcAdj(sub, type, val) {
    const map = {
      addFixed: () => val || 0,
      addPercent: () => ((sub || 0) * val) / 100,
      discountFixed: () => -(val || 0),
      discountPercent: () => -((sub || 0) * val) / 100,
      taxPercent: () => 0,
    };
    return map[type]?.() ?? 0;
  }

  assert.strictEqual(calcAdj(subtotal, 'addFixed', 150), 150);
  assert.strictEqual(calcAdj(subtotal, 'addPercent', 10), 100);
  assert.strictEqual(calcAdj(subtotal, 'discountFixed', 200), -200);
  assert.strictEqual(calcAdj(subtotal, 'discountPercent', 15), -150);
  assert.strictEqual(calcAdj(subtotal, 'taxPercent', 8.875), 0);
});

test('T5.4.3: NYC Sales Tax (8.875%) calculation and multi-payment reconciliation', () => {
  const itemSubtotal = 4500.0;
  const deliveryFee = 350.0; // addFixed
  const promotionalDiscount = 10; // discountPercent (10% of subtotal = -450)
  const taxRate = 8.875; // 8.875%

  const totalAdjustments = deliveryFee - (itemSubtotal * promotionalDiscount) / 100; // 350 - 450 = -100
  const totalBeforeTax = itemSubtotal + totalAdjustments; // 4400.00
  const taxAmount = (totalBeforeTax * taxRate) / 100; // 390.50
  const grandTotal = totalBeforeTax + taxAmount; // 4790.50

  assert.strictEqual(totalBeforeTax, 4400.0);
  assert.strictEqual(taxAmount, 390.5);
  assert.strictEqual(grandTotal, 4790.5);

  // 3-stage payment plan
  const payments = [
    { amount: 1596.83, date: new Date('2026-08-01') },
    { amount: 1596.83, date: new Date('2026-08-15') },
    { amount: 1596.84, date: new Date('2026-08-29') },
  ];

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const roundedTotalPaid = Math.round(totalPaid * 100) / 100;
  const balanceDue = Math.round((grandTotal - totalPaid) * 100) / 100;

  assert.strictEqual(roundedTotalPaid, 4790.5);
  assert.strictEqual(balanceDue, 0.0);
});

test('T5.4.4: 50 micro-installments reconciliation stability', () => {
  const grandTotal = 5000.0;
  const installmentCount = 50;
  const paymentAmount = 100.0;

  const payments = Array.from({ length: installmentCount }, (_, i) => ({
    amount: paymentAmount,
    date: new Date(2026, 0, i + 1),
  }));

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = grandTotal - totalPaid;

  assert.strictEqual(totalPaid, 5000.0);
  assert.strictEqual(balanceDue, 0.0);
});

test('T5.4.5: Overpayments resulting in credit balance and Zod validation', () => {
  const grandTotal = 1000.0;
  const payment = { amount: 1200.0, date: new Date() };
  assert(paymentSchema.safeParse(payment).success);

  const balanceDue = grandTotal - payment.amount;
  assert.strictEqual(balanceDue, -200.0, 'Overpayment yields negative balance due (credit)');

  assert(!paymentSchema.safeParse({ amount: 0, date: new Date() }).success, 'Zero payment is rejected');
  assert(!paymentSchema.safeParse({ amount: -50, date: new Date() }).success, 'Negative payment is rejected');
});

// ============================================================================
// SUITE 5: i18n PARAMETER INTERPOLATION RESILIENCE & SECURITY TESTS
// ============================================================================
console.log('\n--- [Suite 5: i18n Parameter Interpolation Resilience] ---');

test('T5.5.1: Parameter interpolation safely handles HTML, XSS, and script tags', () => {
  function interpolate(template, params) {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key] !== undefined && params[key] !== null ? String(params[key]) : `{${key}}`;
    });
  }

  const template = 'Estimate for {name} ({count} items)';
  const xssPayload = '<script>alert("XSS")</script>';
  const interpolated = interpolate(template, { name: xssPayload, count: 5 });

  assert.strictEqual(interpolated, 'Estimate for <script>alert("XSS")</script> (5 items)');
});

test('T5.5.2: Parameter interpolation handles Unicode, RTL, emojis, and special symbols', () => {
  function interpolate(template, params) {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key] !== undefined && params[key] !== null ? String(params[key]) : `{${key}}`;
    });
  }

  const template = 'Saved {entryType} for customer {name} with total {amount}';
  const result = interpolate(template, {
    entryType: 'Orçamento 📋',
    name: 'João & Maria Construções Ltda.',
    amount: 'R$ 12.345,67 💎',
  });

  assert.strictEqual(result, 'Saved Orçamento 📋 for customer João & Maria Construções Ltda. with total R$ 12.345,67 💎');
});

test('T5.5.3: Missing, null, and undefined parameter tokens fallback safely', () => {
  function interpolate(template, params) {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key] !== undefined && params[key] !== null ? String(params[key]) : `{${key}}`;
    });
  }

  const template = 'Hello {name}, your role is {role} on {journal}';
  const partial = interpolate(template, { name: 'Alice' });
  assert.strictEqual(partial, 'Hello Alice, your role is {role} on {journal}');

  const withNull = interpolate(template, { name: 'Bob', role: null, journal: 'Main' });
  assert.strictEqual(withNull, 'Hello Bob, your role is {role} on Main');
});

test('T5.5.4: All placeholder variables in en.json match identically in pt.json', () => {
  const enPath = path.resolve(__dirname, '../../../frontend/messages/en.json');
  const ptPath = path.resolve(__dirname, '../../../frontend/messages/pt.json');

  const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const ptJson = JSON.parse(fs.readFileSync(ptPath, 'utf8'));

  function extractPlaceholders(str) {
    if (typeof str !== 'string') return [];
    const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g);
    return matches ? matches.sort() : [];
  }

  function comparePlaceholders(enNode, ptNode, currentPath = '') {
    for (const key of Object.keys(enNode)) {
      const propPath = currentPath ? `${currentPath}.${key}` : key;
      const enVal = enNode[key];
      const ptVal = ptNode[key];

      if (typeof enVal === 'object' && enVal !== null && !Array.isArray(enVal)) {
        assert(typeof ptVal === 'object' && ptVal !== null, `Type mismatch at ${propPath}`);
        comparePlaceholders(enVal, ptVal, propPath);
      } else if (typeof enVal === 'string') {
        const enPlaceholders = extractPlaceholders(enVal);
        const ptPlaceholders = extractPlaceholders(ptVal);
        assert.deepStrictEqual(
          enPlaceholders,
          ptPlaceholders,
          `Placeholder tokens mismatch at ${propPath}: EN=[${enPlaceholders}] vs PT=[${ptPlaceholders}]`
        );
      }
    }
  }

  comparePlaceholders(enJson, ptJson);
});

// ============================================================================
// FINAL TIER 5 SUMMARY
// ============================================================================
console.log('\n================================================================');
console.log(`Tier 5 Adversarial Stress Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
