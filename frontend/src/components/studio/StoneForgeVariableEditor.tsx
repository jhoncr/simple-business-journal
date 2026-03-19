'use client';

import React from 'react';
import { AssemblyTemplate } from '@backend/common/schemas/studio';
import { Ruler, Info } from 'lucide-react';

interface StoneForgeVariableEditorProps {
  template: AssemblyTemplate;
  onVariableChange: (id: string, value: number) => void;
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
  onVariableChange,
}: StoneForgeVariableEditorProps) => {
  const variables = template.variables;

  if (variables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 gap-3">
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
    <div className="flex flex-col h-full">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {variables.map((v) => (
          <div key={v.id} className="group">
            <label
              htmlFor={`var-${v.id}`}
              className="block text-xs font-semibold text-gray-700 mb-1.5"
            >
              {humanizeLabel(v.label)}
            </label>
            <div className="relative flex items-center">
              <input
                id={`var-${v.id}`}
                type="number"
                value={v.default}
                step="0.5"
                onChange={(e) =>
                  onVariableChange(v.id, parseFloat(e.target.value) || 0)
                }
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 pr-12 
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                           hover:border-gray-400 transition-colors"
              />
              <span className="absolute right-3 text-xs text-gray-400 pointer-events-none font-medium select-none">
                in
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 hidden group-focus-within:block">
              Variable: <code className="bg-gray-100 px-1 rounded">{v.label}</code>
            </p>
          </div>
        ))}
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
