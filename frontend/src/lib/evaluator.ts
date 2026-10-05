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
        value = t.op === '*' ? value * rhs : value / rhs;
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

export const evaluateExpression = (
  expr: Expression,
  variables: Record<string, number>,
): number => {
  if (typeof expr === 'number') return expr;
  if (!expr || expr.trim() === '') return 0;
  if (expr.length > MAX_EXPR_LENGTH) return 0;

  try {
    // Keep the legacy variable-name filter: only safe identifiers are visible.
    const validVars: Record<string, number> = {};
    for (const [key, val] of Object.entries(variables)) {
      if (IDENT_RE.test(key) && typeof val === 'number') {
        validVars[key] = val;
      }
    }
    const result = parseAndEval(tokenize(expr), validVars);
    return Number.isFinite(result) ? result : 0;
  } catch {
    // Return 0 for invalid expressions (e.g. while the user is typing).
    return 0;
  }
};
