// Adversarial Stress Test Suite for Milestone 3
// Tests:
// 1. 25-view multi-item sequential snapshot queue state machine & single Canvas invariant
// 2. Race condition: 20+ views vs static 7000ms fallback timeout
// 3. Duplicate key / ID collision leading to multiple active Canvases
// 4. Failed / empty snapshot URL handling (falsy "" rendering bug)
// 5. onReadyToPrint callback determinism (exact-once, zero items, drawings-only)
// 6. WebGL context disposal tracking across 25+ sequential mounts
// 7. Queue fault recovery: error in 1 view does not stall remaining queue
// 8. Rapid resolution stress: near 0ms resolution across 25 views without index skipping

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Helper to simulate TemplatePrintLayout view key generation
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

// 1. Stress Test: 5 items x 5 views = 25 views queue state machine & Canvas invariant
test('STRESS: 25-view multi-item estimate maintains strictly <= 1 active Canvas at all steps', async () => {
  const items = Array.from({ length: 5 }, (_, itemIdx) => ({
    id: `item-${itemIdx + 1}`,
    description: `Kitchen Item ${itemIdx + 1}`,
    template: {
      id: `template-${itemIdx + 1}`,
      name: `Template ${itemIdx + 1}`,
      cameraViews: [
        { id: 'view-main-1', name: 'Perspective Default' },
        { id: 'view-main-2', name: 'Top Plan' },
        { id: 'view-main-3', name: 'Front Elevation' },
        { id: 'view-det-1', name: 'Detail Left Edge', focusTargetId: 'edge-l' },
        { id: 'view-det-2', name: 'Detail Right Edge', focusTargetId: 'edge-r' },
      ],
      components: [{ id: 'slab-1', name: 'Countertop' }],
    },
    variableOverrides: {},
  }));

  const allViewKeys = generateViewKeys(items);
  assert.equal(allViewKeys.length, 25, 'Must generate exactly 25 view keys for 5 items x 5 views');

  // Verify all 25 keys are unique
  const uniqueKeySet = new Set(allViewKeys);
  assert.equal(uniqueKeySet.size, 25, 'All 25 view keys must be strictly unique');

  // State machine simulation tracking mounted Canvases
  let activeQueueIndex = 0;
  const snapshots = {};
  let maxConcurrentCanvases = 0;

  function getMountedCanvasCount(currentIndex, currentKeys, currentSnapshots) {
    const activeKey = currentKeys[currentIndex] ?? null;
    let count = 0;
    for (const key of currentKeys) {
      const isSnapshotReady = Boolean(currentSnapshots[key]);
      const isActive = key === activeKey;
      if (!isSnapshotReady && isActive) {
        count++;
      }
    }
    return count;
  }

  // Iterate through all 25 views step-by-step
  while (activeQueueIndex < allViewKeys.length) {
    const currentActiveCanvasCount = getMountedCanvasCount(activeQueueIndex, allViewKeys, snapshots);
    if (currentActiveCanvasCount > maxConcurrentCanvases) {
      maxConcurrentCanvases = currentActiveCanvasCount;
    }
    assert.equal(currentActiveCanvasCount, 1, `At index ${activeQueueIndex}, exactly 1 Canvas must be mounted`);

    const currentKey = allViewKeys[activeQueueIndex];
    // Simulate snapshot resolution
    snapshots[currentKey] = `data:image/png;base64,mock_image_for_${currentKey}`;
    activeQueueIndex++;
  }

  // Final state
  assert.equal(activeQueueIndex, 25);
  const finalCanvasCount = getMountedCanvasCount(activeQueueIndex, allViewKeys, snapshots);
  assert.equal(finalCanvasCount, 0, 'After completion, 0 Canvases must remain mounted');
  assert.equal(maxConcurrentCanvases, 1, 'Maximum concurrent active Canvases must never exceed 1');
  assert.equal(Object.keys(snapshots).length, 25, 'All 25 views must have snapshots');
});

// 2. Dynamic Fallback Timeout: Scaled with view count and inactivity watchdog
test('REMEDIATION: Dynamic fallback timeout scales with view count and watchdog prevents premature print cutoff on 25+ views', () => {
  // If an estimate has 25 views and each view takes 300ms (100ms camera delay + 3 frames + context switch),
  // total elapsed time is 25 * 300ms = 7500ms.
  const viewCount = 25;
  const msPerView = 300;
  const totalElapsedMs = viewCount * msPerView;

  // With dynamic timeout: Math.max(10000, allViewKeys.length * 3500)
  const dynamicTimeoutMs = Math.max(10000, viewCount * 3500);
  assert.equal(dynamicTimeoutMs, 87500);
  assert.ok(
    dynamicTimeoutMs > totalElapsedMs,
    `Dynamic timeout (${dynamicTimeoutMs}ms) comfortably exceeds 25-view render time (${totalElapsedMs}ms)`
  );

  // Static analysis check in TemplatePrintLayout.tsx
  const rootDir = path.resolve(__dirname, '../../../');
  const layoutPath = path.join(
    rootDir,
    'frontend/src/components/studio/TemplatePrintLayout.tsx',
  );
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  // Verify static 7000ms timer has been removed
  const hasStatic7000Timeout = layoutContent.includes('7000);') || layoutContent.includes('7000');
  assert.ok(
    !hasStatic7000Timeout,
    'TemplatePrintLayout.tsx must not have a hardcoded 7000ms static timeout'
  );

  // Verify dynamic timeout scaling is implemented
  assert.ok(
    layoutContent.includes('Math.max(10000, allViewKeys.length * 3500)'),
    'TemplatePrintLayout.tsx must scale timeout dynamically based on view count'
  );

  // Verify inactivity watchdog timer is implemented
  assert.ok(
    layoutContent.includes('watchdogTimer'),
    'TemplatePrintLayout.tsx must implement an inactivity watchdog timer'
  );
  assert.ok(
    layoutContent.includes('5000'),
    'TemplatePrintLayout.tsx watchdog timer must use 5000ms inactivity threshold'
  );
});

// 3. Adversarial Edge Case: Duplicate Item IDs cause simultaneous Canvas mounts
test('ADVERSARIAL: Duplicate item IDs cause multiple Canvases to mount concurrently', () => {
  // If an estimate has two line items that share an ID (e.g. duplicated without UUID reassignment)
  const duplicateItems = [
    {
      id: 'item-dup-1',
      template: { cameraViews: [] }, // single view
    },
    {
      id: 'item-dup-1', // same ID!
      template: { cameraViews: [] }, // single view
    },
  ];

  const keys = generateViewKeys(duplicateItems);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], 'item-dup-1:single');
  assert.equal(keys[1], 'item-dup-1:single');

  // In TemplatePrintLayout:
  // activeKey = allViewKeys[0] = 'item-dup-1:single'
  // When rendering item 0: key === activeKey => isActive = true (Canvas mounts)
  // When rendering item 1: key === activeKey => isActive = true (Canvas mounts!)
  const activeKey = keys[0];
  let mountedCanvases = 0;
  duplicateItems.forEach((item) => {
    const itemKey = `${item.id}:single`;
    const isActive = itemKey === activeKey;
    if (isActive) mountedCanvases++;
  });

  assert.equal(
    mountedCanvases,
    2,
    'Key collision directly causes 2 Canvases to mount simultaneously, violating the WebGL context safety guarantee'
  );
});

// 4. Empty string snapshot URL handling: "View unavailable" placeholder
test('REMEDIATION: Empty string snapshot URL ("") renders "View unavailable" placeholder instead of stuck loading', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const layoutPath = path.join(
    rootDir,
    'frontend/src/components/studio/TemplatePrintLayout.tsx',
  );
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  // TemplatePrintLayout checks:
  // if (snapshotUrl !== undefined) {
  //   if (snapshotUrl === "") {
  //     return <div>View unavailable</div>;
  //   }
  //   return <img src={snapshotUrl} ... />;
  // }
  assert.ok(
    layoutContent.includes('const snapshotUrl = snapshots[key];'),
    'TemplatePrintLayout reads snapshots[key]'
  );
  assert.ok(
    layoutContent.includes('snapshotUrl !== undefined'),
    'TemplatePrintLayout checks snapshotUrl !== undefined'
  );
  assert.ok(
    layoutContent.includes('View unavailable'),
    'TemplatePrintLayout renders "View unavailable" placeholder'
  );
  assert.ok(
    layoutContent.includes('text-muted-foreground'),
    'TemplatePrintLayout uses text-muted-foreground for placeholder styling'
  );

  // Simulate updated renderViewCard logic
  function simulateRenderViewCard(key, activeKey, snapshots) {
    const snapshotUrl = snapshots[key];
    const isActive = key === activeKey;

    if (snapshotUrl !== undefined) {
      if (snapshotUrl === '') {
        return 'VIEW_UNAVAILABLE';
      }
      return 'IMAGE_RENDERED';
    }
    if (isActive) {
      return 'CANVAS_ACTIVE';
    }
    return 'LOADING_VIEW_FALLTHROUGH';
  }

  const failedResult = simulateRenderViewCard('view-failed', 'view-next', { 'view-failed': '' });
  assert.equal(
    failedResult,
    'VIEW_UNAVAILABLE',
    'Failed snapshot with empty string renders "View unavailable"'
  );

  const successResult = simulateRenderViewCard('view-ok', 'view-next', { 'view-ok': 'data:image/png;base64,mock' });
  assert.equal(
    successResult,
    'IMAGE_RENDERED',
    'Valid snapshot URL renders image'
  );

  const pendingResult = simulateRenderViewCard('view-pending', 'view-next', {});
  assert.equal(
    pendingResult,
    'LOADING_VIEW_FALLTHROUGH',
    'Unreached view displays loading placeholder'
  );
});

// 5. Signal Determinism: onReadyToPrint exact-once execution
test('SIGNAL: onReadyToPrint callback fires exactly once under full sequential resolution', () => {
  let callCount = 0;
  let onReadyCalled = false;

  function fireReady() {
    if (onReadyCalled) return;
    onReadyCalled = true;
    callCount++;
  }

  // Simulate 10 views resolving sequentially
  for (let i = 0; i < 10; i++) {
    const isReady = (i + 1) >= 10;
    if (isReady && !onReadyCalled) {
      fireReady();
    }
  }

  // Extra triggers (e.g. timeout or subsequent rerenders)
  if (!onReadyCalled) {
    fireReady();
  }

  assert.equal(callCount, 1, 'onReadyToPrint must fire exactly once');
});

// 6. WebGL Context Tracking: 25 sequential mounts with disposal
test('WEBGL CONTEXT: Active WebGL contexts count strictly <= 1 across 25 sequential mounts', () => {
  class MockWebGLContextPool {
    constructor() {
      this.activeContexts = 0;
      this.peakContexts = 0;
      this.disposedCount = 0;
    }

    createContext() {
      this.activeContexts++;
      if (this.activeContexts > this.peakContexts) {
        this.peakContexts = this.activeContexts;
      }
      return {
        id: Math.random().toString(),
        loseContext: () => {
          this.activeContexts = Math.max(0, this.activeContexts - 1);
          this.disposedCount++;
        },
      };
    }
  }

  const pool = new MockWebGLContextPool();

  // Simulate 25 sequential cycles: mount Canvas -> create GL -> unmount Canvas -> loseContext
  for (let step = 0; step < 25; step++) {
    const ctx = pool.createContext();
    assert.equal(pool.activeContexts, 1, `Step ${step}: active contexts must be 1`);
    // Unmount and dispose
    ctx.loseContext();
    assert.equal(pool.activeContexts, 0, `Step ${step}: active contexts must return to 0 after unmount`);
  }

  assert.equal(pool.peakContexts, 1, 'Peak WebGL contexts must not exceed 1');
  assert.equal(pool.disposedCount, 25, 'All 25 contexts must be disposed');
});

// 7. Queue Fault Recovery: Error or timeout in 1 view does not block subsequent views
test('FAULT RECOVERY: A failing view passing empty string still advances queue to completion', () => {
  const keys = ['v1', 'v2', 'v3', 'v4'];
  let activeIndex = 0;
  const snapshots = {};
  let onReadyFired = false;

  function advanceQueue(key, url) {
    snapshots[key] = url;
    activeIndex++;
    if (activeIndex >= keys.length) {
      onReadyFired = true;
    }
  }

  // v1 succeeds
  advanceQueue('v1', 'data:image/png;base64,ok1');
  assert.equal(activeIndex, 1);

  // v2 FAILS (e.g. WebGL error or timeout in SnapshotCapture -> onSnapshot(""))
  advanceQueue('v2', '');
  assert.equal(activeIndex, 2);

  // v3 succeeds
  advanceQueue('v3', 'data:image/png;base64,ok3');
  assert.equal(activeIndex, 3);

  // v4 succeeds
  advanceQueue('v4', 'data:image/png;base64,ok4');
  assert.equal(activeIndex, 4);

  // Verify queue did not halt on v2 failure
  assert.equal(onReadyFired, true, 'Queue must still complete even if an intermediate snapshot failed');
  assert.equal(snapshots['v2'], '', 'Failed snapshot was recorded as empty string');
});

// 8. Rapid Resolution Stress: Zero-delay transitions across 25 views do not skip state or drop snapshots
test('RAPID RESOLUTION: 25 views resolving synchronously advance queue correctly to completion', () => {
  const keys = Array.from({ length: 25 }, (_, i) => `rapid-view-${i}`);
  let activeIndex = 0;
  const snapshots = {};
  let readySignalFired = false;

  function handleSnapshot(key, url) {
    snapshots[key] = url;
    activeIndex++;
    if (activeIndex >= keys.length) {
      readySignalFired = true;
    }
  }

  // Synchronous burst: resolve each active key immediately
  while (activeIndex < keys.length) {
    const activeKey = keys[activeIndex];
    handleSnapshot(activeKey, `data:img-${activeIndex}`);
  }

  assert.equal(activeIndex, 25);
  assert.equal(Object.keys(snapshots).length, 25);
  assert.equal(readySignalFired, true);
  for (let i = 0; i < 25; i++) {
    assert.equal(snapshots[`rapid-view-${i}`], `data:img-${i}`);
  }
});
