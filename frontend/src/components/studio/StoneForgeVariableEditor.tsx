'use client';

import React from 'react';
import { AssemblyTemplate } from '@backend/common/schemas/studio';
import { Ruler, Info } from 'lucide-react';
import { evaluateExpression } from '../../lib/evaluator';

interface StoneForgeVariableEditorProps {
  template: AssemblyTemplate;
  overrides?: Record<string, number>;
  onVariableChange: (id: string, value: number) => void;
  scrollable?: boolean;
}

/** Converts `snake_case` or `camelCase` labels into a friendly "Title Case" label. */
function humanizeLabel(label: string): string {
  return label
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StoneForgeVariableEditor = ({
  template,
  overrides = {},
  onVariableChange,
  scrollable = true,
}: StoneForgeVariableEditorProps) => {
  const variables = template.variables;

  const currentVariables = React.useMemo(() => {
    const vars: Record<string, number> = {};
    variables.forEach(v => {
      vars[v.label] = overrides[v.id] !== undefined ? overrides[v.id] : v.default;
    });
    return vars;
  }, [variables, overrides]);

  if (variables.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center text-center px-6 py-12 gap-3 ${scrollable ? 'h-full' : ''}`}>
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <Ruler className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-700">No Variables Defined</p>
        <p className="text-xs text-gray-400 max-w-xs">
          This template has no configurable variables yet. Ask the designer to add variables to
          make this template customizable.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${scrollable ? 'h-full' : 'w-full'}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <Ruler className="w-3.5 h-3.5" /> Dimensions
        </h3>
        <p className="text-[11px] text-gray-400 mt-1">
          Adjust the measurements below to customize this template.
        </p>
      </div>

      {/* Variable List */}
      <div className={`${scrollable ? 'flex-1 overflow-y-auto' : ''} p-4 space-y-4`}>
        {variables.map((v) => {
          const minLimit = v.min !== undefined ? evaluateExpression(v.min, currentVariables) : undefined;
          const maxLimit = v.max !== undefined ? evaluateExpression(v.max, currentVariables) : undefined;
          const currentValue = overrides[v.id] !== undefined ? overrides[v.id] : v.default;

          let isError = false;
          let errorMessage = '';
          if (minLimit !== undefined && currentValue < minLimit) {
            isError = true;
            errorMessage = `Minimum is ${minLimit}`;
          }
          if (maxLimit !== undefined && currentValue > maxLimit) {
            isError = true;
            errorMessage = `Maximum is ${maxLimit}`;
          }

          const handleBlur = () => {
            let clamped = currentValue;
            if (minLimit !== undefined && clamped < minLimit) clamped = minLimit;
            if (maxLimit !== undefined && clamped > maxLimit) clamped = maxLimit;
            if (clamped !== currentValue) {
              onVariableChange(v.id, clamped);
            }
          };

          return (
            <div key={v.id} className="group">
              <div className="flex justify-between items-end mb-1.5">
                <label
                  htmlFor={`var-${v.id}`}
                  className="block text-xs font-semibold text-gray-700"
                >
                  {humanizeLabel(v.label)}
                </label>
                {(minLimit !== undefined || maxLimit !== undefined) && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    {minLimit !== undefined && `Min: ${minLimit}`}
                    {minLimit !== undefined && maxLimit !== undefined && ' • '}
                    {maxLimit !== undefined && `Max: ${maxLimit}`}
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  id={`var-${v.id}`}
                  type="number"
                  value={currentValue}
                  step="0.1"
                  min={minLimit}
                  max={maxLimit}
                  onChange={(e) =>
                    onVariableChange(v.id, parseFloat(e.target.value) || 0)
                  }
                  onBlur={handleBlur}
                  className={`w-full text-sm border rounded-md px-3 py-2 pr-12 focus:outline-none focus:ring-2 transition-colors ${isError
                      ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400'
                    }`}
                />
                <span className={`absolute right-3 text-xs pointer-events-none font-medium select-none ${isError ? 'text-red-400' : 'text-gray-400'}`}>
                  cm
                </span>
              </div>
              {isError && (
                <p className="text-[10px] text-red-500 mt-1 font-medium">
                  {errorMessage}
                </p>
              )}
              <p className={`text-[10px] text-gray-400 mt-1 ${isError ? 'hidden' : 'hidden group-focus-within:block'}`}>
                Variable: <code className="bg-gray-100 px-1 rounded">{v.label}</code>
              </p>
            </div>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Changes are applied to the 3D preview in real time. Click{' '}
          <strong className="text-gray-500">Save Template</strong> in the toolbar to persist them.
        </p>
      </div>
    </div>
  );
};
