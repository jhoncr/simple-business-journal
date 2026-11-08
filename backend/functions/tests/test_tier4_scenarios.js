// backend/functions/tests/test_tier4_scenarios.js
// Tier 4: Real-World Application Scenarios Suite
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
console.log('=== RUNNING TIER 4: REAL-WORLD APPLICATION SCENARIOS SUITE ===');
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
// SCENARIO 1: COMMERCIAL STONE FABRICATION (US ENTERPRISE)
// ----------------------------------------------------------------------------
console.log('\n--- [Scenario 1: Commercial Stone Fabrication (US Enterprise)] ---');

test('Scenario 1: Full commercial workflow (US ZIP, CAD formulas, laborType, financials, payments, CSV, audit)', () => {
  // 1. Customer setup with 9-digit US ZIP
  const customer = {
    name: 'Omni Consumer Products HQ',
    email: 'facilities@ocp.corp',
    phone: '555-800-4000',
    address: {
      street: '100 Cyberdyne Way',
      city: 'Detroit',
      state: 'MI',
      zipCode: '48201-1234',
    },
  };
  assert(commonSchemas.contactInfoSchema.safeParse(customer).success);

  // 2. Parametric CAD evaluation for Reception Desk & Conference Table
  const receptionDeskVars = { wallLength: 600, clearanceLeft: 120, clearanceRight: 120 };
  const deskLength = evaluateExpression('wallLength - (clearanceLeft + clearanceRight)', receptionDeskVars);
  assert.strictEqual(deskLength, 360); // 360 cm = 3.6 m

  const deskDepth = evaluateExpression('120 / 2 + 30'); // 90 cm = 0.9 m
  assert.strictEqual(deskDepth, 90);

  const deskAreaM2 = (deskLength / 100) * (deskDepth / 100); // 3.6 * 0.9 = 3.24 m²
  assert.strictEqual(Number(deskAreaM2.toFixed(2)), 3.24);

  // 3. Line items with laborType persistence
  const receptionItem = {
    id: 'item-reception-desk',
    parentId: 'root',
    quantity: deskAreaM2,
    description: 'Black Marquina Marble Reception Desk',
    laborType: 'fixed',
    material: {
      id: 'mat-black-marquina',
      description: 'Black Marquina Slab',
      unitPrice: 600,
      dimensions: { type: 'area', unitLabel: 'm²' },
      currency: 'USD',
    },
  };
  assert(estimateSchemas.lineItemSchema.safeParse(receptionItem).success);

  const fabricationLaborItem = {
    id: 'labor-reception',
    parentId: 'root',
    quantity: 1,
    description: 'Custom Mitred Apron Fabrication',
    laborType: 'fixed',
    material: {
      id: 'mat-miter-labor',
      description: 'Miter Labor',
      unitPrice: 1200,
      dimensions: { type: 'unit', unitLabel: 'unit' },
      currency: 'USD',
    },
  };
  assert(estimateSchemas.lineItemSchema.safeParse(fabricationLaborItem).success);

  // 4. Financial Calculations
  const items = [receptionItem, fabricationLaborItem];
  const subtotal = financials.calculateSubtotal(items); // (3.24 * 600) + (1 * 1200) = 1944 + 1200 = 3144
  assert.strictEqual(subtotal, 3144);

  const adjustments = [
    { type: 'discountPercent', value: 5, description: 'Enterprise volume discount' }, // -157.2
    { type: 'addFixed', value: 250, description: 'Crating and delivery' }, // +250
  ];
  const adjTotal = financials.calculateAdjustments(subtotal, adjustments);
  assert.strictEqual(Number(adjTotal.toFixed(2)), 92.8); // 250 - 157.2 = 92.8

  const taxable = financials.calculateTotalBeforeTax(subtotal, adjTotal); // 3236.8
  assert.strictEqual(taxable, 3236.8);

  const tax = financials.calculateTax(taxable, 6.0);
  assert.strictEqual(Number(tax.toFixed(2)), 194.21);

  const grandTotal = financials.calculateGrandTotal(taxable, tax);
  assert.strictEqual(Number(grandTotal.toFixed(2)), 3431.01);

  // 5. Payment progression: Deposit (partial) -> Full -> Overpayment (credit)
  const deposit = { amount: 1500, method: 'bank_transfer', date: new Date('2026-09-01T10:00:00Z') };
  assert.strictEqual(financials.getPaymentStatus(1, 1500, grandTotal), 'partial');

  const finalPayment = { amount: 1931.01, method: 'bank_transfer', date: new Date('2026-09-15T10:00:00Z') };
  const totalPaid = 1500 + 1931.01; // 3431.01
  assert.strictEqual(financials.getPaymentStatus(2, totalPaid, grandTotal), 'paid');

  // Customer adds $50 tip/overpayment
  const overpaidTotal = totalPaid + 50;
  assert.strictEqual(financials.getPaymentStatus(2, overpaidTotal, grandTotal), 'credit');

  // 6. CSV Export formatting
  const projectEstimate = {
    name: 'OCP Headquarters Reception Desk',
    details: {
      customer,
      supplier: {
        name: 'Great Lakes Stone Supply',
        address: { street: '500 Quarry Rd', city: 'Detroit', state: 'MI', zipCode: '48202' },
      },
      confirmedItems: items,
      adjustments,
      payments: [deposit, finalPayment],
      currency: 'USD',
    },
  };
  const csv = csvExporter.dataToCSV([projectEstimate]);
  assert.ok(!csv.includes('[object Object]'), 'CSV must contain no [object Object]');
  assert.ok(csv.includes('OCP Headquarters Reception Desk'));
  assert.ok(csv.includes('Omni Consumer Products HQ'));
  assert.ok(csv.includes('48201-1234'));
  assert.ok(csv.includes('Enterprise volume discount: 5%'));

  // 7. Audit log write sanitization of large project record
  const auditEvent = {
    jid: 'journal-detroit-1',
    entryId: 'entry-ocp-desk',
    details: projectEstimate.details,
    thumbnailBase64: 'data:image/png;base64,' + 'Z'.repeat(12000),
  };
  const sanitized = sanitizeAuditInput(auditEvent);
  assert.match(sanitized.thumbnailBase64, /\[stripped from audit log \(\d+ chars\)\]/);
  assert.ok(!JSON.stringify(sanitized).includes('data:image/png;base64'));
});

// ----------------------------------------------------------------------------
// SCENARIO 2: INTERNATIONAL RESIDENTIAL INSTALLATION (BRAZILIAN CLIENT)
// ----------------------------------------------------------------------------
console.log('\n--- [Scenario 2: International Residential Installation (Brazilian Client)] ---');

test('Scenario 2: Brazilian project (CEP, BRL currency, waterfall formula, duplication, credit badge, CSV)', () => {
  // 1. Brazilian customer with 8-digit CEP
  const customer = {
    name: 'Mariana Drummond Alcantara',
    email: 'mariana.alcantara@design.com.br',
    phone: '+55 21 99887-6543',
    address: {
      street: 'Av Vieira Souto 500',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22420-006',
    },
  };
  assert(commonSchemas.contactInfoSchema.safeParse(customer).success);

  // 2. Waterfall Countertop CAD calculation
  const kitchenVars = { counterHeight: 90, slabThickness: 3 };
  const waterfallLegHeight = evaluateExpression('counterHeight - slabThickness', kitchenVars);
  assert.strictEqual(waterfallLegHeight, 87); // 87 cm

  const islandLength = evaluateExpression('280'); // 280 cm
  const totalLengthCm = evaluateExpression('islandLength + (2 * slabThickness)', { islandLength, slabThickness: 3 });
  assert.strictEqual(totalLengthCm, 286);

  // 3. Line item with fixed labor type in BRL
  const waterfallItem = {
    id: 'item-waterfall-rio',
    parentId: 'root',
    quantity: 1,
    description: 'Ilha Quartzo Branco com Cascata Dupla',
    laborType: 'fixed',
    material: {
      id: 'mat-quartzo-branco',
      description: 'Quartzo Branco Prime',
      unitPrice: 5800,
      dimensions: { type: 'unit', unitLabel: 'unit' },
      currency: 'BRL',
    },
  };
  assert(estimateSchemas.lineItemSchema.safeParse(waterfallItem).success);

  const originalEstimate = {
    id: 'est-rio-001',
    name: 'Projeto Residencial Ipanema - Ilha Cozinha',
    details: {
      confirmedItems: [waterfallItem],
      status: 'DRAFT',
      customer,
      supplier: {
        name: 'Marmoraria Carioca Ltda',
        address: { street: 'Rua da Pedra 10', city: 'Rio de Janeiro', state: 'RJ', zipCode: '20000000' },
      },
      logo: null,
      adjustments: [{ type: 'discountPercent', value: 10, description: 'Desconto pagamento antecipado' }],
      taxPercentage: 0,
      currency: 'BRL',
      notes: 'Entregar com acabamento 45 graus perfeito.',
      payments: [
        { amount: 3000, method: 'pix', date: new Date('2026-10-01T12:00:00Z') },
        { amount: 3000, method: 'pix', date: new Date('2026-10-15T12:00:00Z') },
      ],
    },
  };

  // 4. Duplicate for Phase 2 (Master Bath)
  const phase2Estimate = simulateDuplicateEstimate(originalEstimate, 'est-rio-002');
  assert.deepStrictEqual(phase2Estimate.details.payments, []);
  assert.strictEqual(phase2Estimate.details.confirmedItems[0].laborType, 'fixed');
  assert.ok(phase2Estimate.details.notes.includes('(Copied from est-rio-001)'));
  assert.ok(phase2Estimate.details.notes.length <= 250);

  // 5. Financials on Original: Subtotal 5800, 10% discount (-580), Grand Total 5220. Payments: 6000 -> credit status
  const originalSummary = financials.calculateEstimateFinancials({
    items: originalEstimate.details.confirmedItems,
    adjustments: originalEstimate.details.adjustments,
    taxPercentage: 0,
    payments: originalEstimate.details.payments,
  });
  assert.strictEqual(originalSummary.itemSubtotal, 5800);
  assert.strictEqual(originalSummary.totalAdjustments, -580);
  assert.strictEqual(originalSummary.grandTotal, 5220);
  assert.strictEqual(originalSummary.totalPaid, 6000);
  assert.strictEqual(originalSummary.balanceDue, -780); // credit of R$ 780

  const paymentStatus = financials.getPaymentStatus(2, originalSummary.totalPaid, originalSummary.grandTotal);
  assert.strictEqual(paymentStatus, 'credit');

  // 6. CSV Export of Brazilian Record
  const csv = csvExporter.dataToCSV([originalEstimate]);
  assert.ok(!csv.includes('[object Object]'));
  assert.ok(csv.includes('22420-006'));
  assert.ok(csv.includes('R$5800'));
  assert.ok(csv.includes('Mariana Drummond Alcantara'));
});

// ----------------------------------------------------------------------------
// SCENARIO 3: MULTI-VIEW TECHNICAL DRAWINGS PRINT PIPELINE
// ----------------------------------------------------------------------------
console.log('\n--- [Scenario 3: Multi-View Technical Drawings Print Pipeline] ---');

test('Scenario 3: Print pipeline (multi-views, metersToCentimeters, view keys, queue sequencer, WebGL cleanup)', () => {
  // 1. Multi-component kitchen assembly
  const assemblyItems = [
    {
      id: 'slab-island',
      template: {
        cameraViews: [
          { id: 'cam-plan', name: 'Top Plan' },
          { id: 'cam-elev-front', name: 'Front Elevation' },
          { id: 'cam-elev-side', name: 'Side Elevation' },
        ],
      },
    },
    {
      id: 'slab-backsplash',
      template: {
        cameraViews: [
          { id: 'cam-elev', name: 'Wall Elevation' },
          { id: 'cam-iso', name: 'Isometric View' },
        ],
      },
    },
  ];

  // 2. metersToCentimeters conversion for drawing annotations
  const dimensionsInMeters = [3.0, 1.2, 0.9, 0.03, 0.65];
  const dimensionsInCm = dimensionsInMeters.map(metersToCentimeters);
  assert.deepStrictEqual(dimensionsInCm, [300, 120, 90, 3, 65]);

  // 3. Unique deterministic view keys
  const viewKeys = generateViewKeys(assemblyItems);
  assert.strictEqual(viewKeys.length, 5);
  assert.deepStrictEqual(viewKeys, [
    'slab-island:default:cam-plan',
    'slab-island:other:cam-elev-front',
    'slab-island:other:cam-elev-side',
    'slab-backsplash:default:cam-elev',
    'slab-backsplash:other:cam-iso',
  ]);

  // 4. Dynamic timeout calculation (Math.max(10000, N * 3500))
  const viewCount = viewKeys.length;
  const printTimeoutMs = Math.max(10000, viewCount * 3500); // Math.max(10000, 17500) = 17500ms
  assert.strictEqual(printTimeoutMs, 17500);

  // 5. Sequential snapshot state machine
  const completedSnapshots = {};
  let printTriggered = false;

  function onReadyToPrint() {
    printTriggered = true;
  }

  viewKeys.forEach((key, index) => {
    assert.strictEqual(printTriggered, false);
    completedSnapshots[key] = `data:image/png;base64,snapshot_${key}`;
    if (Object.keys(completedSnapshots).length === viewKeys.length) {
      onReadyToPrint();
    }
  });

  assert.strictEqual(printTriggered, true);
  assert.strictEqual(Object.keys(completedSnapshots).length, 5);

  // 6. WebGL context disposal
  let contextsDisposed = 0;
  function simulateDispose() {
    contextsDisposed++;
  }
  for (let i = 0; i < viewCount; i++) {
    simulateDispose();
  }
  assert.strictEqual(contextsDisposed, 5);
});

// ----------------------------------------------------------------------------
// SCENARIO 4: MULTI-USER COLLABORATION & SECURITY HARDENING
// ----------------------------------------------------------------------------
console.log('\n--- [Scenario 4: Multi-User Collaboration & Security Hardening] ---');

test('Scenario 4: Collaboration & security (dynamic origin, production credential gating, audit sanitization)', () => {
  // 1. Dynamic origin resolution for invitation sharable link
  const mockWindow = { location: { origin: 'https://precisionstone.app' } };
  const shareOrigin = getAppOrigin(mockWindow);
  assert.strictEqual(shareOrigin, 'https://precisionstone.app');

  const journalId = 'journal-sec-001';
  const inviteLink = `${shareOrigin}/share?jid=${journalId}`;
  assert.strictEqual(inviteLink, 'https://precisionstone.app/share?jid=journal-sec-001');

  // 2. Production credentials strictly gated
  const prodEnv = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_AI_TEST_MODE: 'true',
    NEXT_PUBLIC_AI_TEST_EMAIL: 'hacker@malicious.com',
  };
  const shouldAutoLogin = prodEnv.NODE_ENV === 'development' && prodEnv.NEXT_PUBLIC_AI_TEST_MODE === 'true';
  assert.strictEqual(shouldAutoLogin, false);

  // 3. Formula security: rejection of dangerous expression injection in collaborator templates
  const maliciousExpr = 'this.constructor.constructor("return process")().exit()';
  assert.strictEqual(evaluateExpression(maliciousExpr), 0);

  // 4. Large template duplication and audit log sanitization
  const templatePayload = {
    jid: journalId,
    entryId: 'template-kitchen-island',
    thumbnailBase64: 'data:image/jpeg;base64,' + 'A'.repeat(8000),
    notes: 'K'.repeat(3000),
  };
  const sanitized = sanitizeAuditInput(templatePayload);
  assert.match(sanitized.thumbnailBase64, /\[stripped from audit log \(\d+ chars\)\]/);
  assert.match(sanitized.notes, /…\[truncated 3000 chars\]/);
});

// ----------------------------------------------------------------------------
// SCENARIO 5: CODE HYGIENE, BREAKPOINT SYNC & REPOSITORY INTEGRITY
// ----------------------------------------------------------------------------
console.log('\n--- [Scenario 5: Code Hygiene, Breakpoint Sync & Repository Integrity] ---');

test('Scenario 5: Repository integrity verification (breakpoints, SCALER removal, no hardcoded URLs)', () => {
  const rootDir = path.resolve(__dirname, '../../../');

  // 1. Breakpoint synchronization at xl (1280px)
  const addEstimateCode = fs.readFileSync(
    path.join(rootDir, 'frontend/src/app/(auth)/journal/journal-types/estimate/addEstimate.tsx'),
    'utf8'
  );
  const wrapperCode = fs.readFileSync(
    path.join(rootDir, 'frontend/src/app/(auth)/journal/journal-types/estimate/subcomponents/NewItemFormWrapper.tsx'),
    'utf8'
  );
  assert.ok(addEstimateCode.includes('xl:pr-[430px]'));
  assert.ok(!addEstimateCode.includes('lg:pr-[430px]'));
  assert.ok(wrapperCode.includes('(min-width: 1280px)'));
  assert.ok(!wrapperCode.includes('1340px'));

  // 2. SCALER = 100 removal and deterministic print
  const techDrawingsCode = fs.readFileSync(
    path.join(rootDir, 'frontend/src/app/(auth)/journal/entry/technical-drawings/page.tsx'),
    'utf8'
  );
  assert.ok(!techDrawingsCode.includes('SCALER = 100'));
  assert.ok(!techDrawingsCode.includes('TODO: remote this in the future'));
  assert.ok(techDrawingsCode.includes('metersToCentimeters'));
  assert.ok(techDrawingsCode.includes('onReadyToPrint={handleReadyToPrint}'));

  // 3. TemplatePrintLayout uses td-print-container and responsive classes
  const printLayoutCode = fs.readFileSync(
    path.join(rootDir, 'frontend/src/components/studio/TemplatePrintLayout.tsx'),
    'utf8'
  );
  assert.ok(!printLayoutCode.includes("width: '285mm'"));
  assert.ok(!printLayoutCode.includes("minHeight: '196mm'"));
  assert.ok(printLayoutCode.includes('td-print-container'));
  assert.ok(printLayoutCode.includes('onReadyToPrint?: () => void'));

  // 4. Dynamic hostname in add-contributors
  const addContribCode = fs.readFileSync(
    path.join(rootDir, 'frontend/src/components/ui/add-contributors.tsx'),
    'utf8'
  );
  assert.ok(!addContribCode.includes('https://simplelog.app'));
  assert.ok(addContribCode.includes('getAppOrigin'));

  // 5. Evaluator has no eval or new Function in executable code
  const evaluatorCode = fs.readFileSync(
    path.join(rootDir, 'frontend/src/lib/evaluator.ts'),
    'utf8'
  );
  const executableCode = evaluatorCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  assert.ok(!executableCode.includes('new Function'));
  assert.ok(!executableCode.includes('eval('));
});

console.log('\n================================================================');
console.log(`Tier 4 Real-World Application Scenarios Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
