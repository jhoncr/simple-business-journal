'use client';

import React, { useState } from 'react';
import { AssemblyTemplate, Expression } from '@backend/common/schemas/studio';
import { Ruler, Info } from 'lucide-react';
import { tryEvaluateExpression } from '@/lib/evaluator';
import { useTranslations } from 'next-intl';

interface StoneForgeVariableEditorProps {
  template: AssemblyTemplate;
  overrides?: Record<string, number>;
  onVariableChange: (id: string, value: number) => void;
  scrollable?: boolean;
  showFooterHint?: boolean;
}

/** Converts `snake_case` or `camelCase` labels into a friendly "Title Case" label. */
function humanizeLabel(label: string): string {
  return label
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function evaluateLimit(
  expr: Expression | undefined,
  variables: Record<string, number>,
): number | undefined {
  if (expr === undefined || expr === null) return undefined;
  if (typeof expr === 'string' && expr.trim() === '') return undefined;
  const val = tryEvaluateExpression(expr, variables);
  return val === null ? undefined : val;
}

export const StoneForgeVariableEditor = ({
  template,
  overrides = {},
  onVariableChange,
  scrollable = true,
  showFooterHint,
}: StoneForgeVariableEditorProps) => {
  const t = useTranslations("studio.variableEditor");
  const variables = template.variables;
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const shouldShowFooterHint = showFooterHint ?? scrollable;

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
        <p className="text-sm font-medium text-gray-700">{t("noVariablesDefined")}</p>
        <p className="text-xs text-gray-400 max-w-xs">
          {t("noVariablesDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${scrollable ? 'h-full' : 'w-full'}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <Ruler className="w-3.5 h-3.5" /> {t("dimensions")}
        </h3>
        <p className="text-[11px] text-gray-400 mt-1">
          {t("adjustMeasurements")}
        </p>
      </div>

      {/* Variable List */}
      <div className={`${scrollable ? 'flex-1 overflow-y-auto' : ''} p-4 space-y-4`}>
        {variables.map((v) => {
          const rawMinLimit = evaluateLimit(v.min, currentVariables);
          const rawMaxLimit = evaluateLimit(v.max, currentVariables);
          const hasConflictingBounds =
            rawMinLimit !== undefined &&
            rawMaxLimit !== undefined &&
            rawMinLimit > rawMaxLimit;
          const minLimit = hasConflictingBounds ? undefined : rawMinLimit;
          const maxLimit = hasConflictingBounds ? undefined : rawMaxLimit;
          const currentValue = overrides[v.id] !== undefined ? overrides[v.id] : v.default;
          const inputValue = draftValues[v.id] !== undefined ? draftValues[v.id] : String(currentValue);

          let isError = false;
          let errorMessage = '';
          if (minLimit !== undefined && currentValue < minLimit) {
            isError = true;
            errorMessage = t("minLimitMessage", { min: minLimit });
          }
          if (maxLimit !== undefined && currentValue > maxLimit) {
            isError = true;
            errorMessage = t("maxLimitMessage", { max: maxLimit });
          }

          const handleChange = (raw: string) => {
            setDraftValues((prev) => ({ ...prev, [v.id]: raw }));
            if (raw.trim() === '') return;
            const parsed = parseFloat(raw);
            if (Number.isFinite(parsed)) {
              onVariableChange(v.id, parsed);
            }
          };

          const handleBlur = () => {
            const draft = draftValues[v.id];
            setDraftValues((prev) => {
              if (!(v.id in prev)) return prev;
              const next = { ...prev };
              delete next[v.id];
              return next;
            });

            const parsedDraft = draft !== undefined && draft.trim() !== '' ? parseFloat(draft) : currentValue;
            let clamped = Number.isFinite(parsedDraft) ? parsedDraft : currentValue;
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
                    {minLimit !== undefined && t("minLabel", { min: minLimit })}
                    {minLimit !== undefined && maxLimit !== undefined && ' • '}
                    {maxLimit !== undefined && t("maxLabel", { max: maxLimit })}
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  id={`var-${v.id}`}
                  type="number"
                  value={inputValue}
                  step="0.1"
                  min={minLimit}
                  max={maxLimit}
                  onChange={(e) => handleChange(e.target.value)}
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
                {t("variableLabel")} <code className="bg-gray-100 px-1 rounded">{v.label}</code>
              </p>
            </div>
          );
        })}
      </div>

      {/* Info footer */}
      {shouldShowFooterHint && (
        <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-400 leading-relaxed">
            {t("footerPrefix")}{' '}
            <strong className="text-gray-500">{t("saveTemplateButton")}</strong>{' '}
            {t("footerSuffix")}
          </p>
        </div>
      )}
    </div>
  );
};
