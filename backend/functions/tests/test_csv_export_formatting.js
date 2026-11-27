// backend/functions/tests/test_csv_export_formatting.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

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
      return require('../lib/common/schemas/common_schemas');
    }
    if (modName.includes('button')) {
      return { Button: () => null };
    }
    return {};
  });
  return mod.exports;
}

const csvExporter = loadCSVExporter();

test('formatContactInfo formats customer and supplier contact details cleanly', () => {
  const contact = {
    name: 'Alice Smith',
    email: 'alice@example.com',
    phone: '555-987-6543',
    address: {
      street: '100 Main St',
      city: 'Boston',
      state: 'MA',
      zipCode: '02101',
      country: 'USA',
    },
  };

  const formatted = csvExporter.formatContactInfo(contact);
  assert.equal(
    formatted,
    'Alice Smith | alice@example.com | 555-987-6543 | 100 Main St, Boston, MA, 02101, USA'
  );
  assert.equal(csvExporter.formatContactInfo(null), '');
  assert.equal(csvExporter.formatContactInfo({}), '');
});

test('formatLineItems formats confirmed items without [object Object]', () => {
  const items = [
    {
      quantity: 2,
      description: 'Kitchen Island Slab',
      material: { unitPrice: 250, currency: 'USD' },
    },
    {
      quantity: 1,
      description: 'Labor Installation',
      material: { unitPrice: 150, currency: 'USD' },
    },
  ];

  const formatted = csvExporter.formatLineItems(items);
  assert.equal(
    formatted,
    '2x Kitchen Island Slab ($250); 1x Labor Installation ($150)'
  );
  assert.equal(csvExporter.formatLineItems([]), '');
  assert.equal(csvExporter.formatLineItems(null), '');
});

test('formatAdjustments formats discount and addition adjustments', () => {
  const adjustments = [
    { description: 'Early Bird Discount', type: 'discountPercent', value: 10 },
    { description: 'Delivery Fee', type: 'addFixed', value: 75 },
  ];

  const formatted = csvExporter.formatAdjustments(adjustments);
  assert.equal(formatted, 'Early Bird Discount: 10%; Delivery Fee: $75');
  assert.equal(csvExporter.formatAdjustments([]), '');
  assert.equal(csvExporter.formatAdjustments(null), '');
});

test('formatPayments formats active payments and omits voided payments', () => {
  const payments = [
    {
      amount: 500,
      method: 'creditCard',
      date: '2026-05-15T00:00:00.000Z',
    },
    {
      amount: 100,
      method: 'cash',
      isDeleted: true,
    },
    {
      amount: 250,
      method: 'bankTransfer',
      date: new Date('2026-06-01T12:00:00.000Z'),
    },
    {
      amount: 75,
      method: 'check',
      deletedAt: new Date(),
    },
  ];

  const formatted = csvExporter.formatPayments(payments);
  assert.equal(
    formatted,
    '$500 (creditCard on 2026-05-15); $250 (bankTransfer on 2026-06-01)'
  );
  assert.equal(formatted.includes('$100'), false, 'Deleted payment omitted');
  assert.equal(formatted.includes('$75'), false, 'Voided payment omitted');
});

test('formatFieldValue handles Date, Timestamp, primitives, and fallback stringification', () => {
  assert.equal(csvExporter.formatFieldValue('name', null), '');
  assert.equal(csvExporter.formatFieldValue('name', undefined), '');
  assert.equal(csvExporter.formatFieldValue('name', 'Hello World'), 'Hello World');
  assert.equal(csvExporter.formatFieldValue('qty', 42), '42');
  assert.equal(csvExporter.formatFieldValue('active', true), 'true');

  const testDate = new Date('2026-11-08T12:00:00.000Z');
  assert.equal(csvExporter.formatFieldValue('createdAt', testDate), '2026-11-08T12:00:00.000Z');

  const tsMock = { toDate: () => testDate };
  assert.equal(csvExporter.formatFieldValue('date', tsMock), '2026-11-08T12:00:00.000Z');

  const rawSeconds = { seconds: 1762603200, nanoseconds: 0 };
  assert.equal(typeof csvExporter.formatFieldValue('timestamp', rawSeconds), 'string');

  // Any unhandled nested object must never return [object Object]
  const unhandledObject = { customField: 'value', nested: { a: 1 } };
  const result = csvExporter.formatFieldValue('details.custom', unhandledObject);
  assert.equal(result.includes('[object Object]'), false);
  assert.equal(result, JSON.stringify(unhandledObject));
});

test('dataToCSV generates RFC-4180 compliant CSV without [object Object]', () => {
  const entryList = [
    {
      id: 'entry-1',
      entryType: 'estimate',
      name: 'Residential Kitchen Remodel',
      createdBy: 'uid-user-1',
      details: {
        customer: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-111-2222',
          address: {
            street: '456 Oak Ave',
            city: 'Denver',
            state: 'CO',
            zipCode: '80201',
          },
        },
        confirmedItems: [
          {
            quantity: 2,
            description: 'Marble Countertop',
            material: { unitPrice: 300, currency: 'USD' },
          },
        ],
        adjustments: [
          { description: 'Military Discount', type: 'discountPercent', value: 5 },
        ],
        payments: [
          { amount: 300, method: 'check', date: '2026-07-01' },
          { amount: 50, method: 'cash', isDeleted: true },
        ],
        currency: 'USD',
      },
    },
    {
      id: 'entry-2',
      entryType: 'estimate',
      name: 'Bathroom Vanity',
      createdBy: 'uid-user-2',
      details: {
        customer: { name: 'Bob Smith' },
        confirmedItems: [],
        currency: 'USD',
      },
    },
  ];

  const access = {
    'uid-user-1': { email: 'architect@studio.com' },
  };

  const csv = csvExporter.dataToCSV(entryList, access);

  // Strictly assert NO [object Object]
  assert.equal(csv.includes('[object Object]'), false, 'Must not contain [object Object]');

  // Assert CRLF line endings
  assert.equal(csv.includes('\r\n'), true, 'Must use CRLF line endings');

  // Assert headers include aggregated detail keys
  assert.equal(csv.includes('details.customer'), true);
  assert.equal(csv.includes('details.confirmedItems'), true);
  assert.equal(csv.includes('details.adjustments'), true);
  assert.equal(csv.includes('details.payments'), true);

  // Assert customer name and items appear in output
  assert.equal(csv.includes('Jane Doe'), true);
  assert.equal(csv.includes('Marble Countertop'), true);
  assert.equal(csv.includes('Military Discount'), true);
  assert.equal(csv.includes('architect@studio.com'), true);

  // Assert headers start with unquoted id, and rows contain quoted cells
  assert.equal(csv.startsWith('id,'), true);
  assert.equal(csv.includes('"entry-1","estimate"'), true);
});

test('dataToCSV handles empty entry list safely', () => {
  assert.equal(csvExporter.dataToCSV([]), '');
  assert.equal(csvExporter.dataToCSV(null), '');
  assert.equal(csvExporter.dataToCSV(undefined), '');
});
