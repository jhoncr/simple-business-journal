// Expression evaluator matching frontend/src/lib/evaluator.ts
function evaluateExpression(expr, variables = {}) {
  if (typeof expr === 'number') return expr;
  if (!expr || typeof expr !== 'string' || expr.trim() === '') return 0;

  try {
    const validVars = Object.entries(variables).filter(([key]) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key));
    const varNames = validVars.map(([key]) => key);
    const varValues = validVars.map(([, val]) => val);

    const func = new Function(...varNames, `return ${expr};`);
    const result = func(...varValues);

    return isNaN(result) ? 0 : result;
  } catch (e) {
    return 0;
  }
}

module.exports = { evaluateExpression };
