// backend/functions/tests/test_evaluator_helper.js
// Safe arithmetic expression evaluator matching frontend/src/lib/evaluator.ts
// ZERO use of new Function or eval.

const IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const MAX_EXPR_LENGTH = 500;

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch) {
  return (
    (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    ch === '_' ||
    ch === '$'
  );
}

function isIdentPart(ch) {
  return isIdentStart(ch) || isDigit(ch);
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (isDigit(ch) || ch === '.') {
      let j = i;
      let dots = 0;
      while (j < src.length && (isDigit(src[j]) || src[j] === '.')) {
        if (src[j] === '.') dots++;
        j++;
      }
      const raw = src.slice(i, j);
      if (dots > 1 || raw === '.') {
        throw new Error(`Invalid number '${raw}'`);
      }
      tokens.push({ kind: 'num', value: parseFloat(raw) });
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < src.length && isIdentPart(src[j])) j++;
      tokens.push({ kind: 'ident', name: src.slice(i, j) });
      i = j;
      continue;
    }
    if (
      ch === '+' ||
      ch === '-' ||
      ch === '*' ||
      ch === '/' ||
      ch === '(' ||
      ch === ')'
    ) {
      tokens.push({ kind: 'op', op: ch });
      i++;
      continue;
    }
    throw new Error(`Unsupported character '${ch}' in expression`);
  }
  if (tokens.length === 0) {
    throw new Error('Empty expression');
  }
  return tokens;
}

function parseAndEval(tokens, variables) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let value = parseTerm();
    for (;;) {
      const t = peek();
      if (t && t.kind === 'op' && (t.op === '+' || t.op === '-')) {
        next();
        const rhs = parseTerm();
        value = t.op === '+' ? value + rhs : value - rhs;
      } else {
        return value;
      }
    }
  }

  function parseTerm() {
    let value = parseFactor();
    for (;;) {
      const t = peek();
      if (t && t.kind === 'op' && (t.op === '*' || t.op === '/')) {
        next();
        const rhs = parseFactor();
        if (t.op === '/') {
          if (rhs === 0) {
            throw new Error('Division by zero');
          }
          value = value / rhs;
        } else {
          value = value * rhs;
        }
      } else {
        return value;
      }
    }
  }

  function parseFactor() {
    const t = next();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.kind === 'num') return t.value;
    if (t.kind === 'ident') {
      const v = variables[t.name];
      if (typeof v !== 'number' || Number.isNaN(v)) {
        throw new Error(`Unknown variable '${t.name}'`);
      }
      return v;
    }
    if (t.kind === 'op') {
      if (t.op === '(') {
        const v = parseExpr();
        const closing = next();
        if (!closing || closing.kind !== 'op' || closing.op !== ')') {
          throw new Error('Missing closing parenthesis');
        }
        return v;
      }
      if (t.op === '-') return -parseFactor();
      if (t.op === '+') return parseFactor();
    }
    throw new Error('Unexpected token in expression');
  }

  const result = parseExpr();
  if (pos !== tokens.length) {
    throw new Error('Unexpected trailing input in expression');
  }
  return result;
}

function evaluateExpression(expr, variables = {}) {
  if (typeof expr === 'number') return expr;
  if (!expr || typeof expr !== 'string' || expr.trim() === '') return 0;
  if (expr.length > MAX_EXPR_LENGTH) return 0;

  try {
    const validVars = {};
    if (variables && typeof variables === 'object') {
      for (const [key, val] of Object.entries(variables)) {
        if (IDENT_RE.test(key) && typeof val === 'number') {
          validVars[key] = val;
        }
      }
    }
    const result = parseAndEval(tokenize(expr), validVars);
    return Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

module.exports = { evaluateExpression };
