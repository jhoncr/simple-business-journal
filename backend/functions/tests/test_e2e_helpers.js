// backend/functions/tests/test_e2e_helpers.js
// Centralized E2E test helpers for Tiers 1-4
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { evaluateExpression } = require('./test_evaluator_helper');
const { sanitizeAuditInput } = require('../lib/helpers/audited-function');
const commonSchemas = require('../lib/common/schemas/common_schemas');
const estimateSchemas = require('../lib/common/schemas/estimate_schema');
const configmapSchemas = require('../lib/common/schemas/configmap');
const studioSchemas = require('../lib/common/schemas/studio');

// Load and transpile frontend/src/lib/financials.ts
function loadFinancials() {
  const filePath = path.resolve(__dirname, '../../../frontend/src/lib/financials.ts');
  const code = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('exports', 'module', 'require', transpiled);
  fn(mod.exports, mod, (modName) => {
    if (modName.includes('estimate_schema')) {
      return estimateSchemas;
    }
    return require(modName);
  });
  return mod.exports;
}

// Load and transpile frontend/src/app/(auth)/journal/actions/export-to-csv.tsx
function loadCSVExporter() {
  const filePath = path.resolve(
    __dirname,
    '../../../frontend/src/app/(auth)/journal/actions/export-to-csv.tsx'
  );
  const code = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('exports', 'module', 'require', transpiled);
  fn(mod.exports, mod, (modName) => {
    if (modName === 'react') return { createElement: () => null };
    if (modName === 'lucide-react') return { Download: () => null };
    if (modName === 'next-intl') return { useTranslations: () => () => '' };
    if (modName === 'firebase/firestore') {
      return {
        Timestamp: class Timestamp {
          constructor(date) {
            this._date = date || new Date();
          }
          toDate() {
            return this._date;
          }
        },
      };
    }
    if (modName.includes('common_schemas')) {
      return commonSchemas;
    }
    if (modName.includes('button')) {
      return { Button: () => null };
    }
    return {};
  });
  return mod.exports;
}

// Unit conversion helper
function metersToCentimeters(meters) {
  if (meters == null || isNaN(meters) || !isFinite(meters)) return 0;
  const cm = Math.round(meters * 100);
  return cm === 0 ? 0 : cm;
}

// View keys generator
function generateViewKeys(items) {
  const keys = [];
  (items || []).forEach((item) => {
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

// Dynamic origin helper (matches frontend/src/components/ui/add-contributors.tsx)
function getAppOrigin(mockWindow, mockEnv) {
  const currentWindow = mockWindow !== undefined ? mockWindow : (typeof window !== 'undefined' ? window : undefined);
  const env = mockEnv || process.env;

  if (currentWindow && currentWindow.location?.origin) {
    return currentWindow.location.origin;
  }
  if (env.NEXT_PUBLIC_APP_URL) {
    return env.NEXT_PUBLIC_APP_URL;
  }
  if (env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return '';
}

// Duplicate entry logic simulator (matches backend/functions/src/bg-duplicate-entry.ts)
function simulateDuplicateEstimate(originalEntry, newDocId = 'new-doc-id-123') {
  const duplicateDetails = { ...(originalEntry.details || {}) };
  duplicateDetails.payments = [];

  const MAX_NOTES_LENGTH = 250;
  const originalId = originalEntry.id || 'orig-entry-id';
  const annotation = `\n(Copied from ${originalId})`;
  const rawNotes = (originalEntry.details)?.notes;
  const origNotes = typeof rawNotes === 'string' ? rawNotes.trim() : '';

  if (origNotes) {
    const maxOrigLength = Math.max(0, MAX_NOTES_LENGTH - annotation.length);
    const truncatedNotes =
      origNotes.length > maxOrigLength ?
        origNotes.slice(0, maxOrigLength) :
        origNotes;
    duplicateDetails.notes = `${truncatedNotes}${annotation}`;
  } else {
    duplicateDetails.notes = `(Copied from ${originalId})`.slice(0, MAX_NOTES_LENGTH);
  }

  const duplicateName = (
    originalEntry.name ? `${originalEntry.name} (Copy)` : 'Untitled (Copy)'
  ).slice(0, 254);
  duplicateDetails.name = duplicateName;

  const validationResult = estimateSchemas.estimateDetailsStateSchema.safeParse(duplicateDetails);

  return {
    name: duplicateName,
    details: duplicateDetails,
    validationResult,
  };
}

module.exports = {
  evaluateExpression,
  sanitizeAuditInput,
  commonSchemas,
  estimateSchemas,
  configmapSchemas,
  studioSchemas,
  financials: loadFinancials(),
  csvExporter: loadCSVExporter(),
  metersToCentimeters,
  generateViewKeys,
  getAppOrigin,
  simulateDuplicateEstimate,
};
