import { Expression } from '@backend/common/schemas/studio';

/**
 * Safe arithmetic expression evaluator.
 *
 * SECURITY: template expressions are free-form strings stored in Firestore and
 * shared across journal collaborators. They MUST NOT be executed with
 * `new Function` / `eval` — a malicious editor could otherwise run arbitrary
 * JavaScript in every other member's browser session (stored-XSS equivalent,
 * with access to Firebase auth state in browser storage).
 *
 * This module implements a tiny recursive-descent parser that only understands
 * numbers, whitelisted variable names, parentheses and the operators + - * /.
 * Anything else throws, and `evaluateExpression` maps that to 0 (legacy
 * behavior for invalid/partial input while the user is typing).
 */

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; name: string }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '(' | ')' };

const IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const MAX_EXPR_LENGTH = 500;

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return (
    (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    ch === '_' ||
    ch === '$'
  );
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
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
      let digits = 0;
      while (j < src.length && (isDigit(src[j]) || src[j] === '.')) {
        if (src[j] === '.') dots++;
        else digits++;
        j++;
      }
      if (dots > 1 || digits === 0) {
        throw new Error(`Invalid number '${src.slice(i, j)}'`);
      }
      if (j < src.length && (src[j] === 'e' || src[j] === 'E')) {
        j++;
        if (j < src.length && (src[j] === '+' || src[j] === '-')) {
          j++;
        }
        let expDigits = 0;
        while (j < src.length && isDigit(src[j])) {
          expDigits++;
          j++;
        }
        if (expDigits === 0) {
          throw new Error(`Invalid exponent in '${src.slice(i, j)}'`);
        }
      }
      const raw = src.slice(i, j);
      const value = parseFloat(raw);
      if (!Number.isFinite(value)) {
        throw new Error(`Non-finite number '${raw}'`);
      }
      tokens.push({ kind: 'num', value });
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

function parseAndEval(
  tokens: Token[],
  variables: Record<string, number>,
): number {
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const next = (): Token | undefined => tokens[pos++];

  function parseExpr(): number {
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

  function parseTerm(): number {
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

  function parseFactor(): number {
    const t = next();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.kind === 'num') return t.value;
    if (t.kind === 'ident') {
      if (!Object.hasOwn(variables, t.name)) {
        throw new Error(`Unknown variable '${t.name}'`);
      }
      const v = variables[t.name];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
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

export const tryEvaluateExpression = (
  expr: Expression | null | undefined,
  variables: Record<string, number> = {},
): number | null => {
  if (typeof expr === 'number') return Number.isFinite(expr) ? expr : null;
  if (!expr || typeof expr !== 'string' || expr.trim() === '') return null;
  if (expr.length > MAX_EXPR_LENGTH) return null;

  try {
    // Keep the legacy variable-name filter: only safe finite identifiers are visible.
    const validVars: Record<string, number> = Object.create(null);
    if (variables && typeof variables === 'object') {
      for (const [key, val] of Object.entries(variables)) {
        if (IDENT_RE.test(key) && typeof val === 'number' && Number.isFinite(val)) {
          validVars[key] = val;
        }
      }
    }
    const result = parseAndEval(tokenize(expr), validVars);
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

export const evaluateExpression = (
  expr: Expression,
  variables: Record<string, number> = {},
): number => {
  return tryEvaluateExpression(expr, variables) ?? 0;
};
