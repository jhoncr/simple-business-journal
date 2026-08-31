import { Expression } from '@backend/common/schemas/studio';

export const evaluateExpression = (expr: Expression, variables: Record<string, number>): number => {
  if (typeof expr === 'number') return expr;
  if (!expr || expr.trim() === '') return 0;
  
  try {
    // Filter out invalid variable names to prevent new Function errors
    const validVars = Object.entries(variables).filter(([key]) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key));
    const varNames = validVars.map(([key]) => key);
    const varValues = validVars.map(([, val]) => val);
    
    // Create a function that takes all variables as arguments and returns the evaluated expression
    const func = new Function(...varNames, `return ${expr};`);
    const result = func(...varValues);
    
    return isNaN(result) ? 0 : result;
  } catch (e) {
    // Return 0 if the expression is invalid (e.g., while the user is typing)
    return 0;
  }
};
