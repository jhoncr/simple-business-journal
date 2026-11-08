const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { z } = require('zod');

console.log('\n================================================================');
console.log('=== RUNNING ESTIMATE STATUS FILTERING TEST SUITE ===');
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

// WorkStatus enum mirroring backend/functions/src/common/common_types.ts
const WorkStatus = {
  DRAFT: 'DRAFT',
  IN_PROCESS: 'IN_PROCESS',
  DELIVERED: 'DELIVERED',
};

const VALID_STATUSES = new Set(Object.values(WorkStatus));

// Status extraction logic mirroring frontend/src/lib/utils.ts
function getEstimateStatus(entry) {
  if (!entry) return WorkStatus.DRAFT;
  if (
    entry.details &&
    typeof entry.details === 'object' &&
    'status' in entry.details &&
    entry.details.status &&
    VALID_STATUSES.has(entry.details.status)
  ) {
    return entry.details.status;
  }
  if (entry.status && VALID_STATUSES.has(entry.status)) {
    return entry.status;
  }
  return WorkStatus.DRAFT;
}

// Mock Timestamp class
class MockTimestamp {
  constructor(date) {
    this._date = new Date(date);
  }
  toDate() {
    return this._date;
  }
  toMillis() {
    return this._date.getTime();
  }
}

// CSV generator helper mirroring frontend/src/app/(auth)/journal/actions/export-to-csv.tsx
function dataToCSV(entry_list, access) {
  if (entry_list.length === 0) return '';
  const headers = Object.keys(entry_list[0])
    .map((header) => {
      if (header.startsWith('details')) {
        let details = entry_list[0]?.details || {};
        return Object.keys(details).map((detailKey) => `details.${detailKey}`);
      }
      return header;
    })
    .flat();

  const csv = [headers.join(',')];

  entry_list.forEach((object) => {
    const values = headers.map((header) => {
      let v;
      if (header === 'createdBy') {
        v = access?.[object[header]]?.email || object[header] || '';
      } else if (header.startsWith('details.')) {
        const detailKey = header.split('.')[1];
        v = object.details ? object.details[detailKey] : '';
      } else {
        v = object[header];
      }

      if (v === null || v === undefined) {
        return '""';
      }

      if (v instanceof MockTimestamp || (v && typeof v.toDate === 'function')) {
        return `"${v.toDate().toISOString()}"`;
      }

      const strVal = String(v).replaceAll('"', '""');
      return `"${strVal}"`;
    });
    csv.push(values.join(','));
  });

  return csv.join('\r\n');
}

function getExportFilename(title, dateRange, selectedStatuses) {
  const safeTitle = title || 'Journal';
  const dateStr = dateRange
    ? `${dateRange.from}-${dateRange.to}`
    : '';
  const statusStr =
    selectedStatuses && selectedStatuses.length > 0 ? selectedStatuses.join('-') : '';

  if (dateStr && statusStr) {
    return `${safeTitle}-Estimates-${statusStr}-${dateStr}.csv`;
  }
  if (dateStr) {
    return `${safeTitle}-Estimates-${dateStr}.csv`;
  }
  if (statusStr) {
    return `${safeTitle}-Estimates-${statusStr}.csv`;
  }
  return `${safeTitle}-Estimates.csv`;
}

// ============================================================================
// SUITE 1: WorkStatus Schema & Data Extraction
// ============================================================================
console.log('\n--- [Suite 1: WorkStatus Extraction & Fallbacks] ---');

test('S1.1: Extract status directly from details.status', () => {
  const entry = {
    id: 'est-1',
    details: { status: WorkStatus.IN_PROCESS },
  };
  assert.strictEqual(getEstimateStatus(entry), WorkStatus.IN_PROCESS);
});

test('S1.2: Extract status from entry.status if details.status is missing', () => {
  const entry = {
    id: 'est-2',
    status: WorkStatus.DELIVERED,
    details: {},
  };
  assert.strictEqual(getEstimateStatus(entry), WorkStatus.DELIVERED);
});

test('S1.3: Fallback to WorkStatus.DRAFT if status is missing or undefined', () => {
  const entry1 = { id: 'est-3', details: {} };
  const entry2 = { id: 'est-4' };
  assert.strictEqual(getEstimateStatus(entry1), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus(entry2), WorkStatus.DRAFT);
});

test('S1.4: Fallback to WorkStatus.DRAFT on invalid, unknown, or corrupted status strings', () => {
  const entryCorrupt1 = { id: 'est-c1', details: { status: 'INVALID_STATUS' } };
  const entryCorrupt2 = { id: 'est-c2', details: { status: 12345 } };
  const entryCorrupt3 = { id: 'est-c3', details: { status: null } };
  const entryCorrupt4 = { id: 'est-c4', status: 'bogus' };
  assert.strictEqual(getEstimateStatus(entryCorrupt1), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus(entryCorrupt2), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus(entryCorrupt3), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus(entryCorrupt4), WorkStatus.DRAFT);
});

test('S1.5: WorkStatus enum contains exactly DRAFT, IN_PROCESS, DELIVERED', () => {
  const keys = Object.keys(WorkStatus).sort();
  assert.deepStrictEqual(keys, ['DELIVERED', 'DRAFT', 'IN_PROCESS']);
  assert.strictEqual(WorkStatus.DRAFT, 'DRAFT');
  assert.strictEqual(WorkStatus.IN_PROCESS, 'IN_PROCESS');
  assert.strictEqual(WorkStatus.DELIVERED, 'DELIVERED');
});

test('S1.6: Fallback to WorkStatus.DRAFT on null entry or non-object details/status', () => {
  assert.strictEqual(getEstimateStatus(null), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus(undefined), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus({ details: 'invalid-string' }), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus({ details: 42 }), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus({ details: [WorkStatus.DELIVERED] }), WorkStatus.DRAFT);
  assert.strictEqual(getEstimateStatus({ status: null }), WorkStatus.DRAFT);
});

// ============================================================================
// SUITE 2: Multi-Select Status Filtering Logic
// ============================================================================
console.log('\n--- [Suite 2: Multi-Select Status Filtering Logic] ---');

const mockEstimates = [
  { id: 'est-1', name: 'Est 1', details: { status: WorkStatus.DRAFT }, createdAt: new MockTimestamp('2026-08-01T10:00:00Z') },
  { id: 'est-2', name: 'Est 2', details: { status: WorkStatus.IN_PROCESS }, createdAt: new MockTimestamp('2026-08-05T10:00:00Z') },
  { id: 'est-3', name: 'Est 3', details: { status: WorkStatus.DELIVERED }, createdAt: new MockTimestamp('2026-08-10T10:00:00Z') },
  { id: 'est-4', name: 'Est 4', details: { status: WorkStatus.DRAFT }, createdAt: new MockTimestamp('2026-08-15T10:00:00Z') },
  { id: 'est-5', name: 'Est 5', details: { status: WorkStatus.DELIVERED }, createdAt: new MockTimestamp('2026-08-20T10:00:00Z') },
];

function filterEstimates(list, selectedStatuses) {
  if (!selectedStatuses || selectedStatuses.length === 0) {
    return list;
  }
  return list.filter((e) => selectedStatuses.includes(getEstimateStatus(e)));
}

test('S2.1: Empty status filter returns all estimates', () => {
  const result = filterEstimates(mockEstimates, []);
  assert.strictEqual(result.length, 5);
});

test('S2.2: Single status filter [DRAFT] returns only draft estimates', () => {
  const result = filterEstimates(mockEstimates, [WorkStatus.DRAFT]);
  assert.strictEqual(result.length, 2);
  assert.deepStrictEqual(result.map((e) => e.id), ['est-1', 'est-4']);
});

test('S2.3: Single status filter [IN_PROCESS] returns only in-process estimates', () => {
  const result = filterEstimates(mockEstimates, [WorkStatus.IN_PROCESS]);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 'est-2');
});

test('S2.4: Multi-select status filter [DRAFT, DELIVERED] returns matching estimates', () => {
  const result = filterEstimates(mockEstimates, [WorkStatus.DRAFT, WorkStatus.DELIVERED]);
  assert.strictEqual(result.length, 4);
  assert.deepStrictEqual(result.map((e) => e.id), ['est-1', 'est-3', 'est-4', 'est-5']);
});

test('S2.5: Multi-select status filter [DRAFT, IN_PROCESS, DELIVERED] returns all estimates', () => {
  const result = filterEstimates(mockEstimates, [
    WorkStatus.DRAFT,
    WorkStatus.IN_PROCESS,
    WorkStatus.DELIVERED,
  ]);
  assert.strictEqual(result.length, 5);
});

test('S2.6: Deselecting / clearing statuses restores full list', () => {
  let selected = [WorkStatus.DRAFT];
  assert.strictEqual(filterEstimates(mockEstimates, selected).length, 2);
  selected = selected.filter((s) => s !== WorkStatus.DRAFT);
  assert.strictEqual(filterEstimates(mockEstimates, selected).length, 5);
});

test('S2.7: Dynamic real-time list updates: status changes, additions, deletions', () => {
  let liveList = [...mockEstimates];
  const selected = [WorkStatus.DELIVERED];

  // 1. Initial filtered count
  assert.strictEqual(filterEstimates(liveList, selected).length, 2);

  // 2. Real-time addition of a new DELIVERED estimate
  liveList.push({
    id: 'est-6',
    name: 'Est 6',
    details: { status: WorkStatus.DELIVERED },
    createdAt: new MockTimestamp('2026-08-25T10:00:00Z'),
  });
  assert.strictEqual(filterEstimates(liveList, selected).length, 3);

  // 3. Real-time update of est-2 from IN_PROCESS to DELIVERED
  liveList = liveList.map((e) =>
    e.id === 'est-2' ? { ...e, details: { status: WorkStatus.DELIVERED } } : e
  );
  assert.strictEqual(filterEstimates(liveList, selected).length, 4);

  // 4. Real-time deletion of est-3
  liveList = liveList.filter((e) => e.id !== 'est-3');
  assert.strictEqual(filterEstimates(liveList, selected).length, 3);
});

test('S2.8: Multi-select status filter handles duplicate statuses or invalid items robustly', () => {
  const resultWithDuplicates = filterEstimates(mockEstimates, [WorkStatus.DRAFT, WorkStatus.DRAFT]);
  assert.strictEqual(resultWithDuplicates.length, 2);
  assert.deepStrictEqual(resultWithDuplicates.map((e) => e.id), ['est-1', 'est-4']);

  const resultWithInvalid = filterEstimates(mockEstimates, ['NON_EXISTENT_STATUS']);
  assert.strictEqual(resultWithInvalid.length, 0);
});

// ============================================================================
// SUITE 3: Combined Date Range & Status Filtering
// ============================================================================
console.log('\n--- [Suite 3: Combined Date Range & Status Filtering] ---');

test('S3.1: Combining date range (Aug 1 - Aug 10) with status [DELIVERED]', () => {
  const from = new Date('2026-08-01T00:00:00Z');
  const to = new Date('2026-08-10T23:59:59Z');

  const dateFiltered = mockEstimates.filter((e) => {
    const d = e.createdAt.toDate();
    return d >= from && d <= to;
  });
  assert.strictEqual(dateFiltered.length, 3); // est-1, est-2, est-3

  const combined = filterEstimates(dateFiltered, [WorkStatus.DELIVERED]);
  assert.strictEqual(combined.length, 1);
  assert.strictEqual(combined[0].id, 'est-3');
});

test('S3.2: Combining date range with status yields 0 results when no matches in range', () => {
  const from = new Date('2026-08-01T00:00:00Z');
  const to = new Date('2026-08-04T23:59:59Z');

  const dateFiltered = mockEstimates.filter((e) => {
    const d = e.createdAt.toDate();
    return d >= from && d <= to;
  });
  // only est-1 (DRAFT)
  assert.strictEqual(dateFiltered.length, 1);

  const combined = filterEstimates(dateFiltered, [WorkStatus.DELIVERED]);
  assert.strictEqual(combined.length, 0);
});

// ============================================================================
// SUITE 4: Non-Estimate Entry Types (Studio Templates) Integrity
// ============================================================================
console.log('\n--- [Suite 4: Studio Templates and Non-Estimate Types] ---');

test('S4.1: Studio templates are unaffected by estimate status filters', () => {
  const mockTemplates = [
    { id: 'tpl-1', name: 'Kitchen Counter', entryType: 'template', details: { width: 120, depth: 60 } },
    { id: 'tpl-2', name: 'Vanity Top', entryType: 'template', details: { width: 90, depth: 50 } },
  ];

  function filterEntriesByType(list, entryType, selectedStatuses) {
    if (entryType !== 'estimate') {
      return list;
    }
    return filterEstimates(list, selectedStatuses);
  }

  const result = filterEntriesByType(mockTemplates, 'template', [WorkStatus.DRAFT]);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].id, 'tpl-1');
  assert.strictEqual(result[1].id, 'tpl-2');
});

// ============================================================================
// SUITE 5: CSV Export with Active Status Filters
// ============================================================================
console.log('\n--- [Suite 5: CSV Export with Active Status Filters] ---');

test('S5.1: Exporting filtered estimates generates CSV only containing filtered items', () => {
  const filtered = filterEstimates(mockEstimates, [WorkStatus.DELIVERED]);
  const access = { user1: { email: 'admin@example.com' } };
  const csv = dataToCSV(filtered, access);

  const lines = csv.split('\r\n');
  assert.strictEqual(lines.length, 3); // Header + 2 data rows
  assert(csv.includes('"est-3"'));
  assert(csv.includes('"est-5"'));
  assert(!csv.includes('"est-1"'));
  assert(!csv.includes('"est-2"'));
  assert(!csv.includes('"est-4"'));
});

test('S5.2: Filename generation handles date range, single status, and multi status', () => {
  const title = 'Acme Marble';
  const range = { from: '20260801', to: '20260831' };

  // Date only
  assert.strictEqual(
    getExportFilename(title, range, []),
    'Acme Marble-Estimates-20260801-20260831.csv'
  );

  // Status only
  assert.strictEqual(
    getExportFilename(title, null, [WorkStatus.DELIVERED]),
    'Acme Marble-Estimates-DELIVERED.csv'
  );

  // Date + single status
  assert.strictEqual(
    getExportFilename(title, range, [WorkStatus.DELIVERED]),
    'Acme Marble-Estimates-DELIVERED-20260801-20260831.csv'
  );

  // Date + multiple statuses
  assert.strictEqual(
    getExportFilename(title, range, [WorkStatus.DRAFT, WorkStatus.IN_PROCESS]),
    'Acme Marble-Estimates-DRAFT-IN_PROCESS-20260801-20260831.csv'
  );

  // No filter
  assert.strictEqual(
    getExportFilename(title, null, []),
    'Acme Marble-Estimates.csv'
  );

  // Missing or null title fallback
  assert.strictEqual(
    getExportFilename(null, null, []),
    'Journal-Estimates.csv'
  );
});

test('S5.3: CSV export data sanitization with quotes and special characters', () => {
  const estimatesWithQuotes = [
    {
      id: 'est-q1',
      name: 'Client "Special" Project',
      details: {
        status: WorkStatus.DELIVERED,
        notes: 'Notes with "quotes" and, commas',
      },
    },
  ];
  const access = { user1: { email: 'admin@example.com' } };
  const csv = dataToCSV(estimatesWithQuotes, access);
  assert(csv.includes('""Special""'));
  assert(csv.includes('""quotes"" and, commas'));
});

// ============================================================================
// SUITE 6: i18n Verification for Status Filter Keys
// ============================================================================
console.log('\n--- [Suite 6: i18n Parity for Status Filtering] ---');

test('S6.1: All status filter user-facing keys exist in en.json and pt.json', () => {
  const enPath = path.resolve(__dirname, '../../../frontend/messages/en.json');
  const ptPath = path.resolve(__dirname, '../../../frontend/messages/pt.json');

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));

  const requiredJournalKeys = [
    'clearAll',
    'clearFilters',
    'filterByStatus',
    'noMatchingEntries',
    'removeFilter',
    'selectAll',
    'statusFilter',
  ];

  for (const key of requiredJournalKeys) {
    assert(en.journal[key], `en.json missing journal.${key}`);
    assert(pt.journal[key], `pt.json missing journal.${key}`);
  }

  const requiredEstimateKeys = [
    'status',
    'statusDraft',
    'statusInProcess',
    'statusDelivered',
  ];

  for (const key of requiredEstimateKeys) {
    assert(en.estimate[key], `en.json missing estimate.${key}`);
    assert(pt.estimate[key], `pt.json missing estimate.${key}`);
  }
});

test('S6.2: Placeholders in removeFilter match in both en and pt', () => {
  const enPath = path.resolve(__dirname, '../../../frontend/messages/en.json');
  const ptPath = path.resolve(__dirname, '../../../frontend/messages/pt.json');

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));

  assert(en.journal.removeFilter.includes('{name}'));
  assert(pt.journal.removeFilter.includes('{name}'));
});

console.log('\n================================================================');
console.log(`Status Filtering Test Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}

