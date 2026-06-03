import React from "react";
import { Ruler, Trash2 } from "lucide-react";
import { DimensionLabel, Expression } from "@backend/common/schemas/studio";
import { evaluateExpression } from "@/lib/evaluator";
import { useTranslations } from "next-intl";

interface DimensionInspectorProps {
  selectedDimLabel: {
    slabId: string;
    label: DimensionLabel;
  };
  variablesMap: Record<string, number>;
  handleUpdateDimensionLabel: (
    slabId: string,
    labelId: string,
    field: keyof DimensionLabel,
    value: any,
  ) => void;
  handleRemoveDimensionLabel: (slabId: string, labelId: string) => void;
}

export const DimensionInspector: React.FC<DimensionInspectorProps> = ({
  selectedDimLabel,
  variablesMap,
  handleUpdateDimensionLabel,
  handleRemoveDimensionLabel,
}) => {
  const t = useTranslations("studio");

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-gray-900 capitalize mb-1 flex items-center gap-1.5">
          <Ruler className="w-4 h-4 text-amber-600" /> {t("dimensionLabel")}
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          {t("configureDimension")}
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("name")}
        </label>
        <input
          type="text"
          value={selectedDimLabel.label.name}
          onChange={(e) =>
            handleUpdateDimensionLabel(
              selectedDimLabel.slabId,
              selectedDimLabel.label.id,
              "name",
              e.target.value,
            )
          }
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("edge")}
        </label>
        <div className="text-sm text-gray-600 bg-gray-50 px-2 py-1.5 rounded border border-gray-200 capitalize">
          {t(`edges.${selectedDimLabel.label.edge}`)}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("textExpression")}
        </label>
        <input
          type="text"
          value={selectedDimLabel.label.text as string}
          onChange={(e) =>
            handleUpdateDimensionLabel(
              selectedDimLabel.slabId,
              selectedDimLabel.label.id,
              "text",
              e.target.value,
            )
          }
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
          placeholder="e.g. length_a or 228"
        />
        <p className="text-[10px] text-gray-500 mt-1">
          {t("evaluated")}{" "}
          <span className="font-medium">
            {evaluateExpression(selectedDimLabel.label.text, variablesMap)}
          </span>
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("offset")}
        </label>
        <input
          type="number"
          value={selectedDimLabel.label.offset}
          onChange={(e) =>
            handleUpdateDimensionLabel(
              selectedDimLabel.slabId,
              selectedDimLabel.label.id,
              "offset",
              parseFloat(e.target.value) || 0,
            )
          }
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
      </div>
      {selectedDimLabel.label.edge === "custom" && (
        <div className="pt-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-900 mb-3">
            {t("customPoints")}
          </h4>

          <div className="mb-3">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">
              {t("startPos")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["X", "Y", "Z"].map((axis, i) => (
                <input
                  key={`start-${axis}`}
                  type="text"
                  value={String(selectedDimLabel.label.startPos?.[i] ?? 0)}
                  onChange={(e) => {
                    const newPos = [
                      ...(selectedDimLabel.label.startPos || [0, 0, 0]),
                    ] as [Expression, Expression, Expression];
                    newPos[i] = e.target.value;
                    handleUpdateDimensionLabel(
                      selectedDimLabel.slabId,
                      selectedDimLabel.label.id,
                      "startPos",
                      newPos,
                    );
                  }}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">
              {t("endPos")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["X", "Y", "Z"].map((axis, i) => (
                <input
                  key={`end-${axis}`}
                  type="text"
                  value={String(selectedDimLabel.label.endPos?.[i] ?? 0)}
                  onChange={(e) => {
                    const newPos = [
                      ...(selectedDimLabel.label.endPos || [0, 0, 0]),
                    ] as [Expression, Expression, Expression];
                    newPos[i] = e.target.value;
                    handleUpdateDimensionLabel(
                      selectedDimLabel.slabId,
                      selectedDimLabel.label.id,
                      "endPos",
                      newPos,
                    );
                  }}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="pt-4 border-t border-gray-100">
        <button
          onClick={() =>
            handleRemoveDimensionLabel(
              selectedDimLabel.slabId,
              selectedDimLabel.label.id,
            )
          }
          className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" /> {t("removeLabel")}
        </button>
      </div>
    </div>
  );
};
