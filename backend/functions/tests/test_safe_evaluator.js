// backend/functions/tests/test_safe_evaluator.js
// Unit tests for the safe expression evaluator (frontend/src/lib/evaluator.ts
// & test_evaluator_helper.js).
// Run via: node --test tests/test_safe_evaluator.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateExpression } = require('./test_evaluator_helper');

test('evaluates basic arithmetic and operator precedence', () => {
  assert.equal(evaluateExpression('1 + 2'), 3);
  assert.equal(evaluateExpression('2 + 3 * 4'), 14);
  assert.equal(evaluateExpression('(2 + 3) * 4'), 20);
  assert.equal(evaluateExpression('10 - 4 - 2'), 4);
  assert.equal(evaluateExpression('100 / 10 / 2'), 5);
  assert.equal(evaluateExpression('50 - (10 - 5)'), 45);
});

test('evaluates numeric input directly', () => {
  assert.equal(evaluateExpression(42), 42);
  assert.equal(evaluateExpression(0), 0);
  assert.equal(evaluateExpression(-15.5), -15.5);
});

test('evaluates unary plus and minus operators', () => {
  assert.equal(evaluateExpression('-5 + 10'), 5);
  assert.equal(evaluateExpression('-(2 + 3)'), -5);
  assert.equal(evaluateExpression('+10 + -3'), 7);
  assert.equal(evaluateExpression('-(-5)'), 5);
});

test('evaluates variable substitution with allowed identifiers', () => {
  const vars = { width: 100, depth: 50, $factor: 2, _offset: 10 };
  assert.equal(evaluateExpression('width * 2 + depth', vars), 250);
  assert.equal(evaluateExpression('(width - _offset) * $factor', vars), 180);
});

test('works when variables parameter is omitted', () => {
  assert.equal(evaluateExpression('15 * 3'), 45);
  assert.equal(evaluateExpression('(100 - 20) / 4'), 20);
});

test('handles floating point arithmetic', () => {
  assert.equal(evaluateExpression('3.14 * 2'), 6.28);
  assert.equal(evaluateExpression('.5 + .5'), 1);
  assert.equal(evaluateExpression('10.5 - 2.25'), 8.25);
});

test('returns 0 for division by zero without throwing', () => {
  assert.equal(evaluateExpression('10 / 0'), 0);
  assert.equal(evaluateExpression('0 / 0'), 0);
  assert.equal(evaluateExpression('10 / (5 - 5)'), 0);
});

test('returns 0 for typing state and invalid syntax', () => {
  assert.equal(evaluateExpression(''), 0);
  assert.equal(evaluateExpression('   '), 0);
  assert.equal(evaluateExpression(null), 0);
  assert.equal(evaluateExpression(undefined), 0);
  assert.equal(evaluateExpression('10 + '), 0);
  assert.equal(evaluateExpression('* 5'), 0);
  assert.equal(evaluateExpression('(10 + 2'), 0);
  assert.equal(evaluateExpression('10 + 2)'), 0);
  assert.equal(evaluateExpression('unknown_var * 2', { width: 10 }), 0);
});

test('strictly rejects arbitrary JavaScript execution and injection attempts', () => {
  assert.equal(evaluateExpression('(function(){ return 42; })()'), 0);
  assert.equal(evaluateExpression('eval("1 + 1")'), 0);
  assert.equal(evaluateExpression('new Function("return 1")()'), 0);
  assert.equal(evaluateExpression('process.exit(1)'), 0);
  assert.equal(evaluateExpression('window.alert(1)'), 0);
  assert.equal(evaluateExpression('console.log("leak")'), 0);
  assert.equal(evaluateExpression('a; b'), 0);
  assert.equal(evaluateExpression('`malicious`'), 0);
  assert.equal(evaluateExpression('"hello" + "world"'), 0);
  assert.equal(evaluateExpression("'test'"), 0);
  assert.equal(evaluateExpression('{ a: 1 }'), 0);
  assert.equal(evaluateExpression('constructor.constructor("return 1")()'), 0);
  assert.equal(evaluateExpression('__proto__'), 0);
});

test('rejects expressions exceeding maximum length (500 chars)', () => {
  const longExpr = '1 + '.repeat(150) + '1';
  assert.ok(longExpr.length > 500);
  assert.equal(evaluateExpression(longExpr), 0);
});
