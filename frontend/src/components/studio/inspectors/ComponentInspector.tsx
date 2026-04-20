import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { SlabComponent, Cutout, Expression } from "@backend/common/schemas/studio";

interface ComponentInspectorProps {
  selectedComponent: SlabComponent;
  handleComponentChange: (
    id: string,
    field: keyof SlabComponent,
    value: any,
  ) => void;
  handleAddCutout: (slabId: string) => void;
  handleRemoveCutout: (slabId: string, cutoutId: string) => void;
  handleUpdateCutout: (
    slabId: string,
    cutoutId: string,
    field: keyof Cutout,
    value: any,
  ) => void;
}

export const ComponentInspector: React.FC<ComponentInspectorProps> = ({
  selectedComponent,
  handleComponentChange,
  handleAddCutout,
  handleRemoveCutout,
  handleUpdateCutout,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={selectedComponent.name}
          onChange={(e) =>
            handleComponentChange(selectedComponent.id, "name", e.target.value)
          }
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Length (X)
          </label>
          <input
            type="text"
            value={String(selectedComponent.length)}
            onChange={(e) =>
              handleComponentChange(
                selectedComponent.id,
                "length",
                e.target.value,
              )
            }
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Thickness (Y)
          </label>
          <input
            type="text"
            value={String(selectedComponent.thickness)}
            onChange={(e) =>
              handleComponentChange(
                selectedComponent.id,
                "thickness",
                e.target.value,
              )
            }
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Depth (Z)
          </label>
          <input
            type="text"
            value={String(selectedComponent.depth)}
            onChange={(e) =>
              handleComponentChange(
                selectedComponent.id,
                "depth",
                e.target.value,
              )
            }
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h4 className="text-xs font-semibold text-gray-900 mb-3">Position</h4>
        <div className="grid grid-cols-3 gap-2">
          {["X", "Y", "Z"].map((axis, i) => (
            <div key={axis}>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                {axis}
              </label>
              <input
                type="text"
                value={String(selectedComponent.position[i as 0 | 1 | 2])}
                onChange={(e) => {
                  const newPos = [
                    ...selectedComponent.position,
                  ] as [Expression, Expression, Expression];
                  newPos[i] = e.target.value;
                  handleComponentChange(
                    selectedComponent.id,
                    "position",
                    newPos,
                  );
                }}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h4 className="text-xs font-semibold text-gray-900 mb-3">
          Rotation (Radians)
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {["X", "Y", "Z"].map((axis, i) => (
            <div key={axis}>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                {axis}
              </label>
              <input
                type="text"
                value={String(selectedComponent.rotation?.[i as 0 | 1 | 2] || 0)}
                onChange={(e) => {
                  const newRot = [
                    ...(selectedComponent.rotation || [0, 0, 0]),
                  ] as [Expression, Expression, Expression];
                  newRot[i] = e.target.value;
                  handleComponentChange(
                    selectedComponent.id,
                    "rotation",
                    newRot,
                  );
                }}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-900">
            Sinks / Cutouts
          </h4>
          <button
            onClick={() => handleAddCutout(selectedComponent.id)}
            className="text-indigo-600 hover:text-indigo-800"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {selectedComponent.cutouts.length === 0 && (
          <p className="text-[10px] text-gray-500 mb-4">No sinks added.</p>
        )}
        {selectedComponent.cutouts.map((cutout, idx) => (
          <div
            key={cutout.id}
            className="mb-3 bg-gray-50 p-2 rounded-md border border-gray-100"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-gray-700">
                Sink {idx + 1}
              </span>
              <button
                onClick={() =>
                  handleRemoveCutout(selectedComponent.id, cutout.id)
                }
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">
                  Shape
                </label>
                <select
                  value={cutout.shape}
                  onChange={(e) =>
                    handleUpdateCutout(
                      selectedComponent.id,
                      cutout.id,
                      "shape",
                      e.target.value,
                    )
                  }
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="rectangular">Rectangular</option>
                  <option value="circular">Circular</option>
                  <option value="oval">Oval</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">
                    Center X (from Left)
                  </label>
                  <input
                    type="text"
                    value={String(cutout.centerX)}
                    onChange={(e) =>
                      handleUpdateCutout(
                        selectedComponent.id,
                        cutout.id,
                        "centerX",
                        e.target.value,
                      )
                    }
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">
                    Center Y (from Front)
                  </label>
                  <input
                    type="text"
                    value={String(cutout.centerY)}
                    onChange={(e) =>
                      handleUpdateCutout(
                        selectedComponent.id,
                        cutout.id,
                        "centerY",
                        e.target.value,
                      )
                    }
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">
                    {cutout.shape === "circular" ? "Diameter" : "Width"}
                  </label>
                  <input
                    type="text"
                    value={String(cutout.width)}
                    onChange={(e) =>
                      handleUpdateCutout(
                        selectedComponent.id,
                        cutout.id,
                        "width",
                        e.target.value,
                      )
                    }
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                  />
                </div>
                {cutout.shape !== "circular" && (
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">
                      Depth
                    </label>
                    <input
                      type="text"
                      value={String(cutout.depth)}
                      onChange={(e) =>
                        handleUpdateCutout(
                          selectedComponent.id,
                          cutout.id,
                          "depth",
                          e.target.value,
                        )
                      }
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
