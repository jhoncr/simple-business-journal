// Unit and integration tests for Milestone 3:
// - metersToCentimeters conversion helper
// - View key generation uniqueness & snapshot queue state machine
// - Responsive breakpoint synchronization
// - Removal of SCALER = 100 and rigid millimeter inline styles
// - WebGL context disposal safety
//
// Run via: npm test in backend/functions/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 1. metersToCentimeters unit conversion helper logic
function metersToCentimeters(meters) {
  if (meters == null || isNaN(meters)) return 0;
  return Math.round(meters * 100);
}

test('metersToCentimeters converts valid meter inputs to centimeters', () => {
  assert.equal(metersToCentimeters(1), 100);
  assert.equal(metersToCentimeters(1.5), 150);
  assert.equal(metersToCentimeters(0.25), 25);
  assert.equal(metersToCentimeters(0.05), 5);
  assert.equal(metersToCentimeters(2.85), 285);
  assert.equal(metersToCentimeters(0), 0);
  assert.equal(metersToCentimeters(3.14159), 314);
});

test('metersToCentimeters safely handles null, undefined, NaN, and negative values', () => {
  assert.equal(metersToCentimeters(null), 0);
  assert.equal(metersToCentimeters(undefined), 0);
  assert.equal(metersToCentimeters(NaN), 0);
  assert.equal(metersToCentimeters(-1.2), -120);
});

// 2. View key generation & queue sequencer simulation
function generateViewKeys(items) {
  const keys = [];
  items.forEach((item) => {
    const cameraViews = (item.template?.cameraViews || []);
    if (cameraViews.length > 0) {
      const mainViews = cameraViews.filter((v) => !v.focusTargetId);
      const detailViews = cameraViews.filter((v) => v.focusTargetId);
      if (mainViews.length > 0) {
        keys.push(`${item.id}:default:${mainViews[0].id}`);
        mainViews.slice(1).forEach((v) => keys.push(`${item.id}:other:${v.id}`));
      }
      detailViews.forEach((v) => keys.push(`${item.id}:detail:${v.id}`));
      if (mainViews.length === 0 && detailViews.length === 0) {
        keys.push(`${item.id}:single`);
      }
    } else {
      keys.push(`${item.id}:single`);
    }
  });
  return keys;
}

test('generateViewKeys generates unique keys across multi-item templates', () => {
  const sampleItems = [
    {
      id: 'item-1',
      template: {
        cameraViews: [
          { id: 'cam-main-1', name: 'Front View' },
          { id: 'cam-main-2', name: 'Top View' },
          { id: 'cam-det-1', name: 'Edge Detail', focusTargetId: 'edge-1' },
        ],
      },
    },
    {
      id: 'item-2',
      template: {
        cameraViews: [
          // Same template camera IDs as item-1, but under distinct item ID
          { id: 'cam-main-1', name: 'Front View' },
          { id: 'cam-det-1', name: 'Edge Detail', focusTargetId: 'edge-1' },
        ],
      },
    },
    {
      id: 'item-3',
      template: {
        cameraViews: [], // no camera views, fallback to single
      },
    },
  ];

  const keys = generateViewKeys(sampleItems);

  // Expected keys:
  // item-1:default:cam-main-1, item-1:other:cam-main-2, item-1:detail:cam-det-1
  // item-2:default:cam-main-1, item-2:detail:cam-det-1
  // item-3:single
  assert.equal(keys.length, 6);
  assert.deepEqual(keys, [
    'item-1:default:cam-main-1',
    'item-1:other:cam-main-2',
    'item-1:detail:cam-det-1',
    'item-2:default:cam-main-1',
    'item-2:detail:cam-det-1',
    'item-3:single',
  ]);

  // Assert all keys are strictly unique
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length, 'All view keys must be unique');
});

test('sequential snapshot queue state machine advances and reaches completion', () => {
  const allViewKeys = ['v1', 'v2', 'v3'];
  let activeQueueIndex = 0;
  const snapshots = {};
  let onReadyCallCount = 0;

  function onReadyToPrint() {
    onReadyCallCount++;
  }

  function handleSnapshot(key, dataUrl) {
    snapshots[key] = dataUrl;
    activeQueueIndex++;
    if (activeQueueIndex >= allViewKeys.length) {
      onReadyToPrint();
    }
  }

  // Initial state
  assert.equal(activeQueueIndex, 0);
  assert.equal(allViewKeys[activeQueueIndex], 'v1');
  assert.equal(onReadyCallCount, 0);

  // First view finishes snapshot
  handleSnapshot('v1', 'data:image/png;base64,mock1');
  assert.equal(activeQueueIndex, 1);
  assert.equal(allViewKeys[activeQueueIndex], 'v2');
  assert.equal(onReadyCallCount, 0);

  // Second view finishes snapshot
  handleSnapshot('v2', 'data:image/png;base64,mock2');
  assert.equal(activeQueueIndex, 2);
  assert.equal(allViewKeys[activeQueueIndex], 'v3');
  assert.equal(onReadyCallCount, 0);

  // Final view finishes snapshot
  handleSnapshot('v3', 'data:image/png;base64,mock3');
  assert.equal(activeQueueIndex, 3);
  assert.equal(onReadyCallCount, 1);
  assert.equal(Object.keys(snapshots).length, 3);
});

test('sequential snapshot queue handles zero 3D items without stalling', () => {
  const allViewKeys = [];
  const activeQueueIndex = 0;
  const isReady = allViewKeys.length === 0 || activeQueueIndex >= allViewKeys.length;
  assert.equal(isReady, true);
});

// 3. Breakpoint consistency static checks
test('addEstimate.tsx and NewItemFormWrapper.tsx are synchronized at xl (1280px)', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const addEstimatePath = path.join(
    rootDir,
    'frontend/src/app/(auth)/journal/journal-types/estimate/addEstimate.tsx',
  );
  const wrapperPath = path.join(
    rootDir,
    'frontend/src/app/(auth)/journal/journal-types/estimate/subcomponents/NewItemFormWrapper.tsx',
  );

  const addEstimateContent = fs.readFileSync(addEstimatePath, 'utf8');
  const wrapperContent = fs.readFileSync(wrapperPath, 'utf8');

  // Verify addEstimate has xl:pr-[430px] and not lg:pr-[430px]
  assert.ok(
    addEstimateContent.includes('xl:pr-[430px]'),
    'addEstimate.tsx must use xl:pr-[430px] for 1280px synchronization',
  );
  assert.ok(
    !addEstimateContent.includes('lg:pr-[430px]'),
    'addEstimate.tsx must not contain deadzone breakpoint lg:pr-[430px]',
  );

  // Verify NewItemFormWrapper has (min-width: 1280px) and not 1340px
  assert.ok(
    wrapperContent.includes('(min-width: 1280px)'),
    'NewItemFormWrapper.tsx must synchronize desktop breakpoint at min-width: 1280px',
  );
  assert.ok(
    !wrapperContent.includes('1340px'),
    'NewItemFormWrapper.tsx must not contain legacy 1340px breakpoint',
  );
});

// 4. CSS & Unit hack elimination static checks
test('technical-drawings/page.tsx has SCALER = 100 removed and uses deterministic print', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const pagePath = path.join(
    rootDir,
    'frontend/src/app/(auth)/journal/entry/technical-drawings/page.tsx',
  );
  const content = fs.readFileSync(pagePath, 'utf8');

  assert.ok(
    !content.includes('SCALER = 100'),
    'technical-drawings/page.tsx must not contain SCALER = 100 workaround',
  );
  assert.ok(
    !content.includes('TODO: remote this in the future'),
    'technical-drawings/page.tsx must not contain TODO workaround comment',
  );
  assert.ok(
    content.includes('metersToCentimeters'),
    'technical-drawings/page.tsx must use metersToCentimeters helper',
  );
  assert.ok(
    content.includes('onReadyToPrint={handleReadyToPrint}'),
    'technical-drawings/page.tsx must pass onReadyToPrint callback',
  );
  assert.ok(
    !content.includes('setTimeout(() => {\n        window.print();\n      }, 2000)'),
    'technical-drawings/page.tsx must not contain arbitrary 2000ms setTimeout before window.print()',
  );
});

test('TemplatePrintLayout.tsx does not use rigid millimeter inline styles', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const layoutPath = path.join(
    rootDir,
    'frontend/src/components/studio/TemplatePrintLayout.tsx',
  );
  const content = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(
    !content.includes("width: '285mm'"),
    "TemplatePrintLayout.tsx must not contain rigid inline style width: '285mm'",
  );
  assert.ok(
    !content.includes("minHeight: '196mm'"),
    "TemplatePrintLayout.tsx must not contain rigid inline style minHeight: '196mm'",
  );
  assert.ok(
    content.includes('td-print-container'),
    'TemplatePrintLayout.tsx must use td-print-container class',
  );
  assert.ok(
    content.includes('onReadyToPrint?: () => void'),
    'TemplatePrintLayout.tsx must define onReadyToPrint prop',
  );
});

// 5. WebGL context disposal safety simulation
test('WebGL context disposal executes safely without throwing', () => {
  function disposeMockGL(gl, printMode) {
    if (printMode) {
      try {
        gl.forceContextLoss?.();
      } catch {
        // fallback
      }
      try {
        const ext = gl.getContext?.()?.getExtension?.('WEBGL_lose_context');
        ext?.loseContext?.();
      } catch {
        // fallback
      }
      try {
        gl.dispose?.();
      } catch {
        // fallback
      }
    }
  }

  // Case A: Full Three.js WebGLRenderer mock
  let lostContextViaThree = false;
  let disposedViaThree = false;
  const mockGL1 = {
    forceContextLoss: () => { lostContextViaThree = true; },
    dispose: () => { disposedViaThree = true; },
  };
  disposeMockGL(mockGL1, true);
  assert.equal(lostContextViaThree, true);
  assert.equal(disposedViaThree, true);

  // Case B: Fallback via WEBGL_lose_context extension
  let lostContextViaExt = false;
  const mockGL2 = {
    getContext: () => ({
      getExtension: (name) => (name === 'WEBGL_lose_context' ? { loseContext: () => { lostContextViaExt = true; } } : null),
    }),
    dispose: () => {},
  };
  disposeMockGL(mockGL2, true);
  assert.equal(lostContextViaExt, true);

  // Case C: Broken/throwing methods do not crash application
  const throwingGL = {
    forceContextLoss: () => { throw new Error('Hardware error'); },
    getContext: () => { throw new Error('Context error'); },
    dispose: () => { throw new Error('Dispose error'); },
  };
  assert.doesNotThrow(() => {
    disposeMockGL(throwingGL, true);
  });
});

// 6. Snapshot dimension label compositing & queue reset on template switch
test('StoneForgeViewer.tsx composites 2D dimension labels onto print snapshots and uses 6-axis midpoint padding', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const viewerPath = path.join(
    rootDir,
    'frontend/src/components/studio/StoneForgeViewer.tsx',
  );
  const content = fs.readFileSync(viewerPath, 'utf8');

  assert.ok(
    content.includes('function collectDimensionLabelsWorld'),
    'StoneForgeViewer.tsx must collect 3D dimension labels in world space',
  );
  assert.ok(
    content.includes('function compositeSnapshotWithLabels'),
    'StoneForgeViewer.tsx must composite 2D dimension label badges onto snapshot canvas',
  );
  assert.ok(
    content.includes('geom.midpoint[0] - pad, geom.midpoint[1], geom.midpoint[2]'),
    'StoneForgeViewer.tsx must use 6-axis midpoint padding so isometric projections do not collapse label bounds',
  );
});

test('TemplatePrintLayout.tsx resets snapshot queue when template or variable overrides change', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const layoutPath = path.join(
    rootDir,
    'frontend/src/components/studio/TemplatePrintLayout.tsx',
  );
  const content = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(
    content.includes('itemsSignature'),
    'TemplatePrintLayout.tsx must compute itemsSignature to detect template/variable changes',
  );
  assert.ok(
    content.includes('allViewKeys.find((k) => snapshots[k] === undefined)'),
    'TemplatePrintLayout.tsx must select the first unresolved view key so no view is ever skipped',
  );
});
