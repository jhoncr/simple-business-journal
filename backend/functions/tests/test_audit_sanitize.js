// Tests for sanitizeAuditInput (backend/functions/src/helpers/audited-function.ts).
// Run via: npm test  (builds, then node --test tests/)
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeAuditInput,
} = require('../lib/helpers/audited-function');

test('strips thumbnailBase64 instead of logging megabytes of image data', () => {
  const out = sanitizeAuditInput({
    jid: 'abc123',
    thumbnailBase64: 'x'.repeat(100),
  });
  assert.equal(out.jid, 'abc123');
  assert.match(out.thumbnailBase64, /\[stripped from audit log \(100 chars\)\]/);
});

test('truncates very long strings', () => {
  const out = sanitizeAuditInput({ notes: 'y'.repeat(5000) });
  assert.match(out.notes, /truncated 5000 chars/);
  assert.ok(out.notes.length < 5000);
});

test('caps the total serialized payload size', () => {
  const big = {};
  for (let i = 0; i < 200; i++) big['key' + i] = 'z'.repeat(100);
  const out = sanitizeAuditInput(big);
  assert.match(out._auditNote, /input truncated to 8192 chars/);
  assert.ok(out.preview.length <= 8192);
});

test('small payloads pass through untouched in shape', () => {
  const input = { jid: 'j1', entryId: 'e1', name: 'Estimate', count: 3 };
  assert.deepEqual(sanitizeAuditInput(input), input);
});

test('handles nested objects, arrays and circular references', () => {
  const inner = { x: 1 };
  inner.self = inner;
  const out = sanitizeAuditInput({ nested: { deep: inner }, list: [1, 'a'] });
  assert.equal(out.nested.deep.self, '[circular]');
  assert.deepEqual(out.list, [1, 'a']);
});
