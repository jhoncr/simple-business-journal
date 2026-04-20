import React from "react";
import { Plus, Ruler } from "lucide-react";

interface EdgeInspectorProps {
  selectedEdge: {
    slabId: string;
    edge: "front" | "back" | "left" | "right";
  };
  handleAddEdgeComponent: (
    type: "splash" | "waterfall" | "raised" | "custom",
  ) => void;
  handleAddDimensionLabel: (isCustom?: boolean) => void;
}

export const EdgeInspector: React.FC<EdgeInspectorProps> = ({
  selectedEdge,
  handleAddEdgeComponent,
  handleAddDimensionLabel,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-gray-900 capitalize mb-1">
          {selectedEdge.edge} Edge Selected
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          Add an attached component to this edge.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => handleAddEdgeComponent("splash")}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between"
          >
            <span>Add Splash</span>
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => handleAddEdgeComponent("waterfall")}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between"
          >
            <span>Add Waterfall</span>
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => handleAddEdgeComponent("raised")}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between"
          >
            <span>Add Raised Edge</span>
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => handleAddEdgeComponent("custom")}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 px-3 rounded border border-indigo-200 text-left flex items-center justify-between mt-2"
          >
            <span>Add Custom Component</span>
            <Plus className="w-3.5 h-3.5 text-indigo-500" />
          </button>
          <button
            onClick={() => handleAddDimensionLabel()}
            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 px-3 rounded border border-amber-200 text-left flex items-center justify-between mt-2"
          >
            <span>Add Dimension Label</span>
            <Ruler className="w-3.5 h-3.5 text-amber-500" />
          </button>
          <button
            onClick={() => handleAddDimensionLabel(true)}
            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 px-3 rounded border border-amber-200 text-left flex items-center justify-between mt-2"
          >
            <span>Add Custom Dimension</span>
            <Ruler className="w-3.5 h-3.5 text-amber-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
