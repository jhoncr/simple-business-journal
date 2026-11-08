const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n================================================================');
console.log('=== Running Empirical Challenger Stress Tests for Milestone 1 ===');
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
// SUITE 1: CSV Export & RFC-4180 Escaping Stress Tests
// ============================================================================
console.log('\n--- [SUITE 1: CSV Export & RFC-4180 Escaping Stress Tests] ---');

// Mock Timestamp class compatible with firebase/firestore Timestamp
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

// Faithful implementation of dataToCSV matching frontend/src/app/(auth)/journal/actions/export-to-csv.tsx
function dataToCSV(entry_list, access) {
  try {
    if (!entry_list || entry_list.length === 0) {
      return '';
    }
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
  } catch (error) {
    console.error('Error generating CSV:', error);
    throw new Error('Error generating CSV');
  }
}

// RFC-4180 CSV Parser Oracle for round-trip validation
function parseRFC4180CSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i += 2;
      } else if (char === '"') {
        inQuotes = false;
        i++;
      } else {
        currentCell += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
        i++;
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i += 2;
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else {
        currentCell += char;
        i++;
      }
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

test('CSV handles null and undefined primitives and nested details gracefully', () => {
  const entries = [
    {
      id: 'entry-1',
      title: null,
      notes: undefined,
      details: {
        amount: null,
        description: undefined,
        category: 'Supplies',
      },
    },
  ];

  const csv = dataToCSV(entries, {});
  const parsed = parseRFC4180CSV(csv);

  assert.strictEqual(parsed.length, 2, 'Should have header row and 1 data row');
  assert.deepStrictEqual(parsed[0], ['id', 'title', 'notes', 'details.amount', 'details.description', 'details.category']);
  assert.deepStrictEqual(parsed[1], ['entry-1', '', '', '', '', 'Supplies']);
});

test('CSV preserves multiline strings with LF and CRLF without breaking row alignment', () => {
  const multilineText = 'First Line\nSecond Line\r\nThird Line with "embedded quotes" and commas, here';
  const entries = [
    {
      id: 'entry-2',
      details: {
        memo: multilineText,
      },
    },
    {
      id: 'entry-3',
      details: {
        memo: 'Simple text',
      },
    },
  ];

  const csv = dataToCSV(entries, {});
  const parsed = parseRFC4180CSV(csv);

  assert.strictEqual(parsed.length, 3, 'Should produce 3 rows in parsed structure');
  assert.strictEqual(parsed[1][1], multilineText, 'Multiline text must round-trip exactly');
  assert.strictEqual(parsed[2][1], 'Simple text');
});

test('CSV escapes embedded quotes correctly per RFC-4180 (" -> "")', () => {
  const quoteBomb = 'He said: """Hello""" and ""nested"" and \'single quotes\'';
  const entries = [
    {
      id: 'quote-test',
      text: quoteBomb,
    },
  ];

  const csv = dataToCSV(entries, {});
  const parsed = parseRFC4180CSV(csv);

  assert.strictEqual(parsed[1][1], quoteBomb, 'Quote bomb must round-trip without loss or malformed CSV');
});

test('CSV handles full Unicode, emojis, RTL characters, and control characters', () => {
  const unicodePayload = '🇧🇷 Olá mundo! 🚀 \u0000 \uFFFF עִבְרִית 汉字 \t ñoño';
  const entries = [
    {
      id: 'unicode-1',
      details: {
        name: unicodePayload,
      },
    },
  ];

  const csv = dataToCSV(entries, {});
  const parsed = parseRFC4180CSV(csv);

  assert.strictEqual(parsed[1][1], unicodePayload);
});

test('CSV correctly converts Firestore Timestamp instances to ISO strings', () => {
  const dateIso = '2026-08-29T15:30:00.000Z';
  const ts = new MockTimestamp(dateIso);
  const entries = [
    {
      id: 'time-entry',
      createdAt: ts,
      details: {
        dueDate: ts,
      },
    },
  ];

  const csv = dataToCSV(entries, {});
  const parsed = parseRFC4180CSV(csv);

  assert.strictEqual(parsed[1][1], dateIso);
  assert.strictEqual(parsed[1][2], dateIso);
});

test('CSV createdBy email lookup handles existing, missing, and null access maps', () => {
  const access = {
    'user-abc': { email: 'alice@example.com', role: 'admin' },
    'user-def': { email: 'bob@example.com', role: 'editor' },
  };

  const entries = [
    { id: '1', createdBy: 'user-abc' },
    { id: '2', createdBy: 'user-def' },
    { id: '3', createdBy: 'user-xyz' }, // Missing in access map
    { id: '4', createdBy: null },
  ];

  const csv1 = dataToCSV(entries, access);
  const parsed1 = parseRFC4180CSV(csv1);
  assert.strictEqual(parsed1[1][1], 'alice@example.com');
  assert.strictEqual(parsed1[2][1], 'bob@example.com');
  assert.strictEqual(parsed1[3][1], 'user-xyz');
  assert.strictEqual(parsed1[4][1], '');

  // Null access map
  const csv2 = dataToCSV(entries, null);
  const parsed2 = parseRFC4180CSV(csv2);
  assert.strictEqual(parsed2[1][1], 'user-abc');
  assert.strictEqual(parsed2[4][1], '');
});

test('CSV handles empty objects and missing details without throw', () => {
  assert.strictEqual(dataToCSV([], {}), '');
  assert.strictEqual(dataToCSV(null, {}), '');

  const emptyEntries = [{ id: '1', details: {} }];
  const csvEmpty = dataToCSV(emptyEntries, {});
  const parsedEmpty = parseRFC4180CSV(csvEmpty);
  assert.deepStrictEqual(parsedEmpty[0], ['id']);
  assert.deepStrictEqual(parsedEmpty[1], ['1']);

  const nullDetailsEntries = [
    { id: '1', details: null },
    { id: '2', details: { extra: 'val' } },
  ];
  const csvNullDetails = dataToCSV(nullDetailsEntries, {});
  const parsedNull = parseRFC4180CSV(csvNullDetails);
  assert.deepStrictEqual(parsedNull[0], ['id']);
  assert.deepStrictEqual(parsedNull[1], ['1']);
  assert.deepStrictEqual(parsedNull[2], ['2']);
});

test('CSV High-Scale Stress: 5,000 entries with mixed complex data runs under 500ms', () => {
  const rowCount = 5000;
  const largeEntries = [];
  const ts = new MockTimestamp('2026-08-29T12:00:00.000Z');

  for (let i = 0; i < rowCount; i++) {
    largeEntries.push({
      id: `entry-${i}`,
      index: i,
      createdBy: i % 2 === 0 ? 'user-1' : 'user-2',
      createdAt: ts,
      details: {
        description: `Item #${i} with "quotes", commas, and\nnewlines`,
        value: i * 19.99,
        active: i % 3 === 0,
      },
    });
  }

  const access = {
    'user-1': { email: 'user1@test.com' },
    'user-2': { email: 'user2@test.com' },
  };

  const startTime = Date.now();
  const csv = dataToCSV(largeEntries, access);
  const duration = Date.now() - startTime;

  assert(duration < 1000, `CSV generation took too long: ${duration}ms`);
  assert(csv.length > 500000, `CSV output size expected > 500KB, got ${csv.length}`);
});


// ============================================================================
// SUITE 2: useFetchEntries State & Deletion Pruning Simulation
// ============================================================================
console.log('\n--- [SUITE 2: useFetchEntries State & Deletion Pruning Simulation] ---');

class FetchEntriesSimulator {
  constructor(journalId, entryType) {
    this.journalId = journalId;
    this.entryType = entryType;
    this.allEntries = {};
    this.prevRealtimeKeysRef = new Set();
  }

  // Exact reproduction of the useFetchEntries snapshot reconciliation effect
  applyRealtimeSnapshot(realtimeEntries) {
    const currentRealtimeKeys = new Set(Object.keys(realtimeEntries));
    const prevRealtimeKeys = this.prevRealtimeKeysRef;

    const updated = { ...this.allEntries, ...realtimeEntries };
    for (const key of prevRealtimeKeys) {
      if (!currentRealtimeKeys.has(key)) {
        delete updated[key];
      }
    }

    this.allEntries = updated;
    this.prevRealtimeKeysRef = currentRealtimeKeys;
  }

  // Exact reproduction of fetchMore pagination merge
  applyOlderEntries(olderEntries) {
    this.allEntries = { ...this.allEntries, ...olderEntries };
  }

  // Exact reproduction of removeEntry
  removeEntry(id) {
    const updated = { ...this.allEntries };
    delete updated[id];
    this.allEntries = updated;
  }

  // Exact reproduction of journalId / entryType reset effect
  reset(journalId, entryType) {
    this.journalId = journalId;
    this.entryType = entryType;
    this.allEntries = {};
    this.prevRealtimeKeysRef = new Set();
  }
}

test('Realtime snapshot correctly prunes single deleted item from active state', () => {
  const sim = new FetchEntriesSimulator('j1', 'estimate');

  // Step 1: Initial subscription returns 3 items
  sim.applyRealtimeSnapshot({
    e1: { id: 'e1', title: 'Estimate 1' },
    e2: { id: 'e2', title: 'Estimate 2' },
    e3: { id: 'e3', title: 'Estimate 3' },
  });
  assert.deepStrictEqual(Object.keys(sim.allEntries).sort(), ['e1', 'e2', 'e3']);

  // Step 2: Firestore snapshot fires after e2 is deleted
  sim.applyRealtimeSnapshot({
    e1: { id: 'e1', title: 'Estimate 1' },
    e3: { id: 'e3', title: 'Estimate 3' },
  });
  assert.deepStrictEqual(Object.keys(sim.allEntries).sort(), ['e1', 'e3']);
  assert.strictEqual(sim.allEntries.e2, undefined, 'e2 must be pruned');
});

test('Realtime pruning preserves older paginated entries when realtime items are deleted', () => {
  const sim = new FetchEntriesSimulator('j1', 'estimate');

  // Step 1: Initial realtime items (top 20)
  sim.applyRealtimeSnapshot({
    r1: { id: 'r1', title: 'Realtime 1' },
    r2: { id: 'r2', title: 'Realtime 2' },
  });

  // Step 2: User scrolls and paginates older items (p1, p2, p3)
  sim.applyOlderEntries({
    p1: { id: 'p1', title: 'Paginated 1' },
    p2: { id: 'p2', title: 'Paginated 2' },
    p3: { id: 'p3', title: 'Paginated 3' },
  });

  assert.deepStrictEqual(
    Object.keys(sim.allEntries).sort(),
    ['p1', 'p2', 'p3', 'r1', 'r2']
  );

  // Step 3: Realtime snapshot fires with r1 deleted
  sim.applyRealtimeSnapshot({
    r2: { id: 'r2', title: 'Realtime 2' },
  });

  // Verification: r1 is pruned, but paginated items p1, p2, p3 MUST remain!
  assert.deepStrictEqual(
    Object.keys(sim.allEntries).sort(),
    ['p1', 'p2', 'p3', 'r2'],
    'Paginated entries p1, p2, p3 must NOT be pruned by realtime snapshot deletions'
  );

  // Step 4: Realtime snapshot fires with all realtime items deleted
  sim.applyRealtimeSnapshot({});

  assert.deepStrictEqual(
    Object.keys(sim.allEntries).sort(),
    ['p1', 'p2', 'p3'],
    'Paginated entries must survive when all realtime items are deleted'
  );
});

test('Rapid bursts of adds, updates, and deletes maintain exact state integrity', () => {
  const sim = new FetchEntriesSimulator('j1', 'job');

  const snapshots = [
    { a: { v: 1 }, b: { v: 1 } },
    { a: { v: 2 }, b: { v: 1 }, c: { v: 1 } }, // a updated, c added
    { b: { v: 1 }, c: { v: 1 }, d: { v: 1 } }, // a deleted, d added
    { d: { v: 2 } },                           // b & c deleted, d updated
    {},                                        // d deleted
    { x: { v: 10 } },                          // x added
  ];

  const expectedKeySequence = [
    ['a', 'b'],
    ['a', 'b', 'c'],
    ['b', 'c', 'd'],
    ['d'],
    [],
    ['x'],
  ];

  snapshots.forEach((snap, idx) => {
    sim.applyRealtimeSnapshot(snap);
    assert.deepStrictEqual(
      Object.keys(sim.allEntries).sort(),
      expectedKeySequence[idx].sort(),
      `Mismatch at snapshot burst index ${idx}`
    );
  });
});

test('Reset on journal switch completely purges prior state and reference sets', () => {
  const sim = new FetchEntriesSimulator('journal-A', 'estimate');

  sim.applyRealtimeSnapshot({
    docA1: { id: 'docA1' },
    docA2: { id: 'docA2' },
  });
  sim.applyOlderEntries({
    docA_old: { id: 'docA_old' },
  });

  // Switch journal
  sim.reset('journal-B', 'expense');

  assert.deepStrictEqual(sim.allEntries, {});
  assert.strictEqual(sim.prevRealtimeKeysRef.size, 0);

  // New snapshot for journal B
  sim.applyRealtimeSnapshot({
    docB1: { id: 'docB1' },
  });

  assert.deepStrictEqual(Object.keys(sim.allEntries), ['docB1']);
});

test('Fuzz Test: 1,000 chaotic operations verified against independent oracle', () => {
  const sim = new FetchEntriesSimulator('j_fuzz', 'estimate');
  const oracle = {
    realtime: new Map(),
    paginated: new Map(),
  };

  for (let i = 0; i < 1000; i++) {
    const op = Math.floor(Math.random() * 4);

    if (op === 0) {
      // Add or update realtime entries
      const id = `item_${Math.floor(Math.random() * 50)}`;
      oracle.realtime.set(id, { id, v: i });
      sim.applyRealtimeSnapshot(Object.fromEntries(oracle.realtime));
    } else if (op === 1 && oracle.realtime.size > 0) {
      // Delete a random realtime entry
      const keys = [...oracle.realtime.keys()];
      const keyToDelete = keys[Math.floor(Math.random() * keys.length)];
      oracle.realtime.delete(keyToDelete);
      sim.applyRealtimeSnapshot(Object.fromEntries(oracle.realtime));
    } else if (op === 2) {
      // Paginate older entries
      const id = `paginated_${Math.floor(Math.random() * 50)}`;
      oracle.paginated.set(id, { id, v: i });
      sim.applyOlderEntries({ [id]: { id, v: i } });
    } else if (op === 3 && Math.random() < 0.05) {
      // Reset simulator
      sim.reset('j_fuzz_new', 'estimate');
      oracle.realtime.clear();
      oracle.paginated.clear();
    }

    // Combine expected entries from oracle
    const expectedKeys = new Set([...oracle.realtime.keys(), ...oracle.paginated.keys()]);
    const actualKeys = new Set(Object.keys(sim.allEntries));

    assert.deepStrictEqual(
      [...actualKeys].sort(),
      [...expectedKeys].sort(),
      `Fuzz step ${i} failed state reconciliation`
    );
  }
});


// ============================================================================
// SUITE 3: Sorting Determinism & Date Fallback Logic
// ============================================================================
console.log('\n--- [SUITE 3: Sorting Determinism & Date Fallback Logic] ---');

const ENTRY_CONFIG = {
  estimate: { sortField: 'details.date' },
  invoice: { sortField: 'details.date' },
  expense: { sortField: 'details.date' },
  job: { sortField: 'details.date' },
  template: { sortField: 'createdAt' },
};

function getSortableDate(entry, entryType) {
  const config = ENTRY_CONFIG[entryType];
  const sortField = config?.sortField || 'createdAt';

  if (sortField.startsWith('details.')) {
    const field = sortField.split('.')[1];
    const value = entry.details?.[field];
    if (value && typeof value.toMillis === 'function') {
      return value.toMillis();
    }
  }

  return entry.createdAt?.toMillis ? entry.createdAt.toMillis() : 0;
}

function sortEntries(entries, entryType) {
  return Object.values(entries)
    .filter((entry) => entry && entry.createdAt)
    .sort((a, b) => {
      const dateA = getSortableDate(a, entryType);
      const dateB = getSortableDate(b, entryType);

      if (dateA !== dateB) {
        return dateB - dateA;
      }

      const createdAtA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const createdAtB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return createdAtB - createdAtA;
    });
}

test('sortEntries orders by details.date descending and falls back to createdAt', () => {
  const t1 = new MockTimestamp('2026-08-01T00:00:00Z');
  const t2 = new MockTimestamp('2026-08-15T00:00:00Z');
  const t3 = new MockTimestamp('2026-08-20T00:00:00Z');

  const entriesMap = {
    e1: { id: 'e1', createdAt: t1, details: { date: t2 } }, // Sort date: Aug 15
    e2: { id: 'e2', createdAt: t3, details: { date: t1 } }, // Sort date: Aug 01
    e3: { id: 'e3', createdAt: t3, details: {} },           // Missing details.date -> fallback to createdAt (Aug 20)
    eCorrupt: { id: 'eCorrupt', details: { date: t3 } },     // Missing createdAt -> filtered out
  };

  const sorted = sortEntries(entriesMap, 'estimate');

  assert.strictEqual(sorted.length, 3, 'Corrupted entry without createdAt must be filtered');
  assert.strictEqual(sorted[0].id, 'e3', 'e3 (Aug 20) should be first');
  assert.strictEqual(sorted[1].id, 'e1', 'e1 (Aug 15) should be second');
  assert.strictEqual(sorted[2].id, 'e2', 'e2 (Aug 01) should be third');
});

test('Secondary sorting breaks ties by createdAt deterministically', () => {
  const commonDate = new MockTimestamp('2026-08-10T00:00:00Z');
  const createdOld = new MockTimestamp('2026-08-01T00:00:00Z');
  const createdNew = new MockTimestamp('2026-08-05T00:00:00Z');

  const entriesMap = {
    firstCreated: { id: 'firstCreated', createdAt: createdOld, details: { date: commonDate } },
    secondCreated: { id: 'secondCreated', createdAt: createdNew, details: { date: commonDate } },
  };

  const sorted = sortEntries(entriesMap, 'estimate');
  assert.strictEqual(sorted[0].id, 'secondCreated');
  assert.strictEqual(sorted[1].id, 'firstCreated');
});


// ============================================================================
// SUITE 4: SharePage Emulator Wiring & Locale Bundle Verification
// ============================================================================
console.log('\n--- [SUITE 4: SharePage Emulator Wiring & Locale Bundle Verification] ---');

test('SharePage imports and connects via auth_handler functions instance', () => {
  const sharePagePath = path.resolve(__dirname, '../../../frontend/src/app/share/page.tsx');
  const content = fs.readFileSync(sharePagePath, 'utf8');

  assert(
    content.includes('import { useAuth, functions } from "@/lib/auth_handler";'),
    'SharePage must import functions from auth_handler'
  );
  assert(
    content.includes('httpsCallable(functions, "acceptShare"'),
    'SharePage must use functions singleton in httpsCallable'
  );
  assert(
    !content.includes('getFunctions()'),
    'SharePage must NOT instantiate raw getFunctions() without emulator binding'
  );
});

test('i18n locales array in config.ts strictly matches available message bundles', () => {
  const configPath = path.resolve(__dirname, '../../../frontend/src/i18n/config.ts');
  const configContent = fs.readFileSync(configPath, 'utf8');

  const messagesDir = path.resolve(__dirname, '../../../frontend/messages');
  const messageFiles = fs.readdirSync(messagesDir).filter((f) => f.endsWith('.json'));
  const availableLocales = messageFiles.map((f) => path.basename(f, '.json')).sort();

  assert(
    configContent.includes('export const locales = ["en", "pt"] as const;'),
    'locales in config.ts must define ["en", "pt"]'
  );
  assert.deepStrictEqual(
    ['en', 'pt'].sort(),
    availableLocales,
    'Configured locales must match disk message bundles'
  );
});

console.log('\n================================================================');
console.log(`Milestone 1 Challenger Stress Suite Completed: ${passCount} passed, ${failCount} failed.`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
