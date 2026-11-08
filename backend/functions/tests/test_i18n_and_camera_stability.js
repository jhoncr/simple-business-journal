const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n--- Running Tests for i18n Dictionary Parity & 3D Camera Math --- \n');

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

// ── 1. i18n Keys Parity Tests ──
console.log('[1. Internationalization Dictionary Parity]');

const enPath = path.resolve(__dirname, '../../../frontend/messages/en.json');
const ptPath = path.resolve(__dirname, '../../../frontend/messages/pt.json');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ptJson = JSON.parse(fs.readFileSync(ptPath, 'utf8'));

function getDeepKeys(obj, prefix = '') {
  return Object.keys(obj).reduce((res, el) => {
    const nextPrefix = prefix ? `${prefix}.${el}` : el;
    if (Array.isArray(obj[el])) {
      res.push(nextPrefix);
    } else if (typeof obj[el] === 'object' && obj[el] !== null) {
      res.push(...getDeepKeys(obj[el], nextPrefix));
    } else {
      res.push(nextPrefix);
    }
    return res;
  }, []);
}

const enKeys = new Set(getDeepKeys(enJson));
const ptKeys = new Set(getDeepKeys(ptJson));

test('en.json and pt.json have identical root sections', () => {
  const enRoots = Object.keys(enJson).sort();
  const ptRoots = Object.keys(ptJson).sort();
  assert.deepStrictEqual(enRoots, ptRoots);
});

test('All keys in en.json exist in pt.json', () => {
  const missingInPt = [...enKeys].filter((k) => !ptKeys.has(k));
  assert.strictEqual(
    missingInPt.length,
    0,
    `Missing keys in pt.json: ${missingInPt.join(', ')}`
  );
});

test('All keys in pt.json exist in en.json', () => {
  const missingInEn = [...ptKeys].filter((k) => !enKeys.has(k));
  assert.strictEqual(
    missingInEn.length,
    0,
    `Missing keys in en.json: ${missingInEn.join(', ')}`
  );
});

test('Phase 3 specific sections are defined in both dictionaries', () => {
  const requiredSections = [
    'technicalDrawings',
    'templateGallery',
    'logoUpload',
    'studio',
    'estimate',
    'journal',
  ];
  for (const section of requiredSections) {
    assert(enJson[section], `en.json missing section ${section}`);
    assert(ptJson[section], `pt.json missing section ${section}`);
  }
});

test('Estimate error keys are populated in both dictionaries', () => {
  const errorKeys = [
    'correctCustomerDetails',
    'validateCustomerFailed',
    'invalidEstimateData',
    'saveFailed',
    'couldNotSave',
    'incorrectFormType',
    'currencyNotSet',
    'invalidFormTypeReceived',
    'journalIdMissing',
    'entryNotFound',
    'loadedDataInvalid',
    'failedToLoadDetails',
  ];
  for (const k of errorKeys) {
    assert(enJson.estimate.errors[k], `en.json missing estimate.errors.${k}`);
    assert(ptJson.estimate.errors[k], `pt.json missing estimate.errors.${k}`);
  }
});

// ── 2. 3D Camera Orthographic Zoom Scaling Tests ──
console.log('\n[2. 3D Camera Orthographic Zoom Determinism]');

function computeOrthoZoom({ boxMin, boxMax, frustumWidth, frustumHeight, margin = 1.15, zoomMultiplier = 1, isIsometric = false, hasFocusTarget = false }) {
  const boundingWidth = boxMax.x - boxMin.x;
  const boundingHeight = boxMax.y - boxMin.y;

  const zoomX = boundingWidth > 0 ? frustumWidth / boundingWidth : 1;
  const zoomY = boundingHeight > 0 ? frustumHeight / boundingHeight : 1;
  const baseFitZoom = Math.min(zoomX, zoomY) / margin;

  let finalZoomMult = zoomMultiplier;
  if (isIsometric && !hasFocusTarget) {
    finalZoomMult *= 1.25;
  }

  return baseFitZoom * finalZoomMult;
}

test('Orthographic zoom is deterministic across 100 simulated re-renders', () => {
  const params = {
    boxMin: { x: -50, y: -30, z: -10 },
    boxMax: { x: 50, y: 30, z: 10 },
    frustumWidth: 800,
    frustumHeight: 600,
    margin: 1.15,
    zoomMultiplier: 1.5,
    isIsometric: true,
    hasFocusTarget: false,
  };

  const initialZoom = computeOrthoZoom(params);

  for (let i = 0; i < 100; i++) {
    const zoom = computeOrthoZoom(params);
    assert.strictEqual(zoom, initialZoom, `Zoom drifted on iteration ${i}: expected ${initialZoom}, got ${zoom}`);
  }
});

test('Zoom multiplier scales linearly, not exponentially', () => {
  const baseParams = {
    boxMin: { x: -50, y: -30, z: -10 },
    boxMax: { x: 50, y: 30, z: 10 },
    frustumWidth: 800,
    frustumHeight: 600,
    margin: 1.15,
    isIsometric: false,
    hasFocusTarget: false,
  };

  const zoom1x = computeOrthoZoom({ ...baseParams, zoomMultiplier: 1 });
  const zoom2x = computeOrthoZoom({ ...baseParams, zoomMultiplier: 2 });
  const zoom3x = computeOrthoZoom({ ...baseParams, zoomMultiplier: 3 });

  assert.strictEqual(Math.round((zoom2x / zoom1x) * 100) / 100, 2);
  assert.strictEqual(Math.round((zoom3x / zoom1x) * 100) / 100, 3);
});

console.log(`\nTests Completed: ${passCount} passed, ${failCount} failed.\n`);

if (failCount > 0) {
  process.exit(1);
}
