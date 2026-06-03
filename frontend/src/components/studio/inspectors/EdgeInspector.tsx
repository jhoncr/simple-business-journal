import React from "react";
import { Plus, Ruler, Tag } from "lucide-react";
import { useTranslations } from "next-intl";

interface EdgeInspectorProps {
  selectedEdge: {
    slabId: string;
    edge: string;
  };
  handleAddEdgeComponent: (
    type: "splash" | "waterfall" | "raised" | "custom",
  ) => void;
  handleAddDimensionLabel: (isCustom?: boolean) => void;
  handleTogglePolish: (edge: string) => void;
  isPolished?: boolean;
}

export const EdgeInspector: React.FC<EdgeInspectorProps> = ({
  selectedEdge,
  handleAddEdgeComponent,
  handleAddDimensionLabel,
  handleTogglePolish,
  isPolished,
}) => {
  const t = useTranslations("studio");

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-gray-900 capitalize mb-1">
          {t("edgeSelected", { edge: t(`edges.${selectedEdge.edge}`) })}
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          {t("edgeDescription")}
        </p>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => handleTogglePolish(selectedEdge.edge)}
            className={`text-xs py-2 px-3 rounded border text-left flex items-center justify-between mb-2 ${
              isPolished
                ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                : "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
            }`}
          >
            <span>{isPolished ? t("removePolishTag") : t("addPolishTag")}</span>
            <Tag className={`w-3.5 h-3.5 ${isPolished ? "text-blue-500" : "text-gray-400"}`} />
          </button>

          <button
            onClick={() => handleAddEdgeComponent("splash")}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between"
          >
            <span>{t("addSplash")}</span>
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => handleAddEdgeComponent("waterfall")}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between"
          >
            <span>{t("addWaterfall")}</span>
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => handleAddEdgeComponent("raised")}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between"
          >
            <span>{t("addRaisedEdge")}</span>
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => handleAddEdgeComponent("custom")}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 px-3 rounded border border-indigo-200 text-left flex items-center justify-between mt-2"
          >
            <span>{t("addCustomComponent")}</span>
            <Plus className="w-3.5 h-3.5 text-indigo-500" />
          </button>
          <button
            onClick={() => handleAddDimensionLabel()}
            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 px-3 rounded border border-amber-200 text-left flex items-center justify-between mt-2"
          >
            <span>{t("addDimensionLabel")}</span>
            <Ruler className="w-3.5 h-3.5 text-amber-500" />
          </button>
          <button
            onClick={() => handleAddDimensionLabel(true)}
            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 px-3 rounded border border-amber-200 text-left flex items-center justify-between mt-2"
          >
            <span>{t("addCustomDimension")}</span>
            <Ruler className="w-3.5 h-3.5 text-amber-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
