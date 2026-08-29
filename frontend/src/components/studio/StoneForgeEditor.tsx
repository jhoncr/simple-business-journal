"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useToolbar } from "@/app/(auth)/nav_tool_handler";
import { useTranslations } from "next-intl";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Bounds } from "@react-three/drei";
import { PresetCameraFitter } from "./StoneForgeViewer";
import {
  SlabComponent,
  AssemblyTemplate,
  Cutout,
  Expression,
  DimensionLabel,
  CameraView,
} from "@backend/common/schemas/studio";
import { evaluateExpression } from "../../lib/evaluator";
import { Slab3D } from "./Slab3D";
import {
  Box,
  Layers,
  Settings,
  Save,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  LayoutTemplate,
  Eye,
  Ruler,
  Camera,
} from "lucide-react";
import { StoneForgeVariableEditor } from "./StoneForgeVariableEditor";
import { useSearchParams } from "next/navigation";
import { findComponentDeep, updateComponentDeep, deleteComponentDeep, findDimensionLabelDeep } from "../../lib/tree-utils";
import { ISOMETRIC_PRESETS } from "./constants";
import { useStoneForgeData } from "../../hooks/useStoneForgeData";
import { EdgeInspector } from "./inspectors/EdgeInspector";
import { DimensionInspector } from "./inspectors/DimensionInspector";
import { ComponentInspector } from "./inspectors/ComponentInspector";
import { GlobalInspector } from "./inspectors/GlobalInspector";

export const StoneForgeEditor = () => {
  const t = useTranslations("studio");
  const searchParams = useSearchParams();
  const journalId = searchParams.get("jid");
  const entryId = searchParams.get("eid");

  const {
    template,
    setTemplate,
    isLoading,
    isSaving,
    showToast,
    handleSaveTemplate,
    handleDuplicateTemplate,
  } = useStoneForgeData(journalId, entryId);

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    "slab_1",
  );
  const [selectedEdge, setSelectedEdge] = useState<{
    slabId: string;
    edge: "front" | "back" | "left" | "right";
  } | null>(null);
  const [selectedDimensionLabelId, setSelectedDimensionLabelId] = useState<
    string | null
  >(null);
  const [activeLeftTab, setActiveLeftTab] = useState<
    "assembly" | "variables" | "views"
  >("assembly");
  const [viewMode, setViewMode] = useState<"user" | "designer">(() =>
    searchParams.get("mode") === "designer" ? "designer" : "user",
  );

  const { setToolBar } = useToolbar();

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = React.useRef<HTMLDivElement>(null);

  const [selectedPreviewViewId, setSelectedPreviewViewId] = useState<string | null>(null);
  const [previewRefreshCount, setPreviewRefreshCount] = useState<number>(0);

  const handleSelectPreviewView = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPreviewViewId(id);
    setPreviewRefreshCount((prev) => prev + 1);
  };

  const resizeImage = (dataUrl: string, maxWidth = 400): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scaleSize = maxWidth / img.width;

        // If the canvas is already smaller than our target, just return a compressed version
        if (scaleSize >= 1) {
          canvas.width = img.width;
          canvas.height = img.height;
        } else {
          canvas.width = maxWidth;
          canvas.height = img.height * scaleSize;
        }

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Compress as WebP at 80% quality for a massive size reduction
        resolve(canvas.toDataURL("image/webp", 0.8));
      };
    });
  };

  const onSave = async () => {
    let thumbnailBase64;
    if (canvasRef.current) {
      try {
        // Capture the raw canvas
        const rawDataUrl = canvasRef.current.toDataURL("image/png");
        // Resize and compress it before sending to the backend
        thumbnailBase64 = await resizeImage(rawDataUrl, 400);
      } catch (err) {
        console.warn("Failed to capture canvas thumbnail:", err);
      }
    }
    await handleSaveTemplate(thumbnailBase64);
  };

  const selectedComponent = selectedComponentId
    ? findComponentDeep(template.components, selectedComponentId)
    : null;

  const handleSelectComponent = (id: string) => {
    // Check if this is a dimension label
    const isDimLabel = findDimensionLabelDeep(template.components, id);
    if (isDimLabel) {
      setSelectedDimensionLabelId(id);
      setSelectedComponentId(null);
      setSelectedEdge(null);
      return;
    }
    setSelectedComponentId(id);
    setSelectedEdge(null);
    setSelectedDimensionLabelId(null);
  };

  const handleSelectEdge = (
    id: string,
    edge: "front" | "back" | "left" | "right",
  ) => {
    setSelectedEdge({ slabId: id, edge });
    setSelectedComponentId(null);
    setSelectedDimensionLabelId(null);
  };

  const variablesMap = useMemo(() => {
    const map: Record<string, number> = {};
    template.variables.forEach((v) => {
      if (v.label) {
        map[v.label] = v.default;
      }
    });
    return map;
  }, [template.variables]);

  const handleAddComponent = () => {
    const newId = `slab_${Date.now()}`;

    // Find the largest Z coordinate in the existing design
    let maxZ = 0;
    const findMaxZ = (comps: SlabComponent[], currentZ: number) => {
      comps.forEach((c) => {
        const z = currentZ + evaluateExpression(c.position[2], variablesMap);
        if (z > maxZ) maxZ = z;
        if (c.children) findMaxZ(c.children, z);
      });
    };
    findMaxZ(template.components, 0);

    // Place the new component 4 units away from the front-most edge
    // Since depth goes into -Z, placing it at maxZ + 60 + 4 ensures its back edge is at maxZ + 4
    const newZ = maxZ === 0 && template.components.length === 0 ? 0 : maxZ + 64;

    setTemplate((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        {
          id: newId,
          type: "slab",
          name: t("newSlab", { num: prev.components.length + 1 }),
          length: 100.0,
          depth: 60.0,
          thickness: 2.0,
          position: [0, 0, newZ],
          rotation: [0, 0, 0],
          cutouts: [],
          children: [],
        },
      ],
    }));
    setSelectedComponentId(newId);
    setSelectedEdge(null);
  };

  const handleRemoveComponent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplate((prev) => ({
      ...prev,
      components: deleteComponentDeep(prev.components, id),
    }));
    if (selectedComponentId === id) setSelectedComponentId(null);
    if (selectedEdge?.slabId === id) setSelectedEdge(null);
  };

  const handleTogglePolish = (edge: string) => {
    if (!selectedEdge) return;
    const { slabId } = selectedEdge;

    let mapEdge: "front" | "back" | "left" | "right" | null = null;
    if (edge.includes("front")) mapEdge = "front";
    else if (edge.includes("back")) mapEdge = "back";
    else if (edge.includes("left")) mapEdge = "left";
    else if (edge.includes("right")) mapEdge = "right";

    if (!mapEdge) return;

    setTemplate((prev) => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => {
        // Strip any existing invalid strings to avoid zod errors from previous attempts
        const currentEdges = (c.polishedEdges || []).filter(e => 
          e === 'front' || e === 'back' || e === 'left' || e === 'right'
        ) as ("front" | "back" | "left" | "right")[];

        const isPolished = currentEdges.includes(mapEdge!);
        return {
          ...c,
          polishedEdges: isPolished
            ? currentEdges.filter((e) => e !== mapEdge)
            : [...currentEdges, mapEdge!],
        };
      }),
    }));
  };

  const handleAddEdgeComponent = (
    type: "splash" | "waterfall" | "raised" | "custom",
  ) => {
    if (!selectedEdge) return;
    const { slabId, edge } = selectedEdge;
    const parent = findComponentDeep(template.components, slabId);
    if (!parent) return;

    const newId = `comp_${Date.now()}`;
    let newComp: SlabComponent = {
      id: newId,
      type: "slab",
      name: t("newComponent"),
      length: 100,
      depth: 60,
      thickness: 2,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      cutouts: [],
      children: [],
    };

    const T = parent.thickness;
    const L = parent.length;
    const D = parent.depth;

    const subExpr = (e1: Expression, e2: Expression): Expression => {
      if (typeof e1 === "number" && typeof e2 === "number") return e1 - e2;
      return `(${e1}) - (${e2})`;
    };

    let addToRoot = false;

    const isTop =
      edge.includes("top") ||
      edge === "front" ||
      edge === "back" ||
      edge === "left" ||
      edge === "right";
    const isBottom = edge.includes("bottom");
    const isFront = edge.includes("front");
    const isBack = edge.includes("back");
    const isLeft = edge.includes("left");
    const isRight = edge.includes("right");

    const isXAxis = (isTop || isBottom) && (isFront || isBack);
    const isZAxis = (isTop || isBottom) && (isLeft || isRight);
    const isYAxis = !isTop && !isBottom;

    if (type === "custom") {
      addToRoot = true;
      newComp.name = `${t(`edges.${edge}`)} ${t("custom")}`;
      newComp.thickness = T;

      const localOffset = new THREE.Vector3();
      const evalL = evaluateExpression(L, variablesMap);
      const evalD = evaluateExpression(D, variablesMap);

      if (isXAxis) {
        newComp.length = L;
        newComp.depth = 60;
        if (isFront) {
          localOffset.set(0, 0, 60);
        } else {
          localOffset.set(0, 0, -evalD);
        }
      } else if (isZAxis) {
        newComp.length = 60;
        newComp.depth = D;
        if (isLeft) {
          localOffset.set(-60, 0, 0);
        } else {
          localOffset.set(evalL, 0, 0);
        }
      } else if (isYAxis) {
        newComp.length = 60;
        newComp.depth = 60;
        if (isLeft) {
          localOffset.set(-60, 0, 0);
        } else {
          localOffset.set(evalL, 0, 0);
        }
      }

      const getComponentWorldTransform = (
        comps: SlabComponent[],
        targetId: string,
        parentObj = new THREE.Object3D(),
      ): { pos: THREE.Vector3; rot: THREE.Euler } | null => {
        for (const c of comps) {
          const childObj = new THREE.Object3D();
          childObj.position.set(
            evaluateExpression(c.position[0], variablesMap),
            evaluateExpression(c.position[1], variablesMap),
            evaluateExpression(c.position[2], variablesMap),
          );
          childObj.rotation.set(
            c.rotation ? evaluateExpression(c.rotation[0], variablesMap) : 0,
            c.rotation ? evaluateExpression(c.rotation[1], variablesMap) : 0,
            c.rotation ? evaluateExpression(c.rotation[2], variablesMap) : 0,
          );
          parentObj.add(childObj);
          parentObj.updateMatrixWorld(true);

          if (c.id === targetId) {
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            childObj.getWorldPosition(worldPos);
            childObj.getWorldQuaternion(worldQuat);
            const worldRot = new THREE.Euler().setFromQuaternion(worldQuat);
            parentObj.remove(childObj);
            return { pos: worldPos, rot: worldRot };
          }

          if (c.children) {
            const res = getComponentWorldTransform(
              c.children,
              targetId,
              childObj,
            );
            if (res) {
              parentObj.remove(childObj);
              return res;
            }
          }
          parentObj.remove(childObj);
        }
        return null;
      };

      const worldTransform = getComponentWorldTransform(
        template.components,
        slabId,
      );
      if (worldTransform) {
        localOffset.applyEuler(worldTransform.rot);
        const newWorldPos = worldTransform.pos.add(localOffset);

        const round = (n: number) => Math.round(n * 100) / 100;

        newComp.position = [
          round(newWorldPos.x),
          round(newWorldPos.y),
          round(newWorldPos.z),
        ];
        newComp.rotation = [
          round(worldTransform.rot.x),
          round(worldTransform.rot.y),
          round(worldTransform.rot.z),
        ];
      }
    } else {
      if (isXAxis) {
        newComp.length = L;
        newComp.depth = type === "raised" ? 4 : 2;
        newComp.thickness =
          type === "splash" ? 10 : type === "waterfall" ? 90 : 2;

        let yPos: Expression = 0;
        if (isTop) {
          if (type === "splash" || type === "raised") yPos = T;
          else yPos = subExpr(T, newComp.thickness);
        } else {
          if (type === "splash" || type === "raised")
            yPos = subExpr(0, newComp.thickness);
          else yPos = 0;
        }

        const zPos = isFront ? 0 : subExpr(newComp.depth, D);

        newComp.position = [0, yPos, zPos];
      } else if (isZAxis) {
        newComp.length = type === "raised" ? 4 : 2;
        newComp.depth = D;
        newComp.thickness =
          type === "splash" ? 10 : type === "waterfall" ? 90 : 2;

        let yPos: Expression = 0;
        if (isTop) {
          if (type === "splash" || type === "raised") yPos = T;
          else yPos = subExpr(T, newComp.thickness);
        } else {
          if (type === "splash" || type === "raised")
            yPos = subExpr(0, newComp.thickness);
          else yPos = 0;
        }

        const xPos = isLeft ? 0 : subExpr(L, newComp.length);

        newComp.position = [xPos, yPos, 0];
      } else if (isYAxis) {
        newComp.thickness = T;
        newComp.length =
          type === "splash"
            ? 10
            : type === "waterfall"
              ? 90
              : type === "raised"
                ? 4
                : 2;
        newComp.depth = 2;

        const xPos = isLeft ? subExpr(0, newComp.length) : L;
        const zPos = isFront ? 0 : subExpr(newComp.depth, D);

        newComp.position = [xPos, 0, zPos];
      }
    }

    setTemplate((prev) => {
      if (addToRoot) {
        return {
          ...prev,
          components: [...prev.components, newComp],
        };
      } else {
        return {
          ...prev,
          components: updateComponentDeep(prev.components, slabId, (c) => ({
            ...c,
            children: [...(c.children || []), newComp],
          })),
        };
      }
    });
    setSelectedComponentId(newId);
    setSelectedEdge(null);
  };

  const handleAddVariable = () => {
    const newId = `var_${Date.now()}`;
    setTemplate((prev) => ({
      ...prev,
      variables: [
        ...prev.variables,
        { id: newId, label: "new_var", default: 0 },
      ],
    }));
  };

  const handleUpdateVariable = (
    id: string,
    field: "label" | "default" | "min" | "max",
    value: any,
  ) => {
    setTemplate((prev) => ({
      ...prev,
      variables: prev.variables.map((v) =>
        v.id === id ? { ...v, [field]: value } : v,
      ),
    }));
  };

  const handleRemoveVariable = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      variables: prev.variables.filter((v) => v.id !== id),
    }));
  };

  const handleAddCutout = (slabId: string) => {
    setTemplate((prev) => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        cutouts: [
          ...c.cutouts,
          {
            id: `cut_${Date.now()}`,
            shape: "rectangular",
            width: 40,
            depth: 30,
            centerX: evaluateExpression(c.length, variablesMap) / 2,
            centerY: evaluateExpression(c.depth, variablesMap) / 2,
          },
        ],
      })),
    }));
  };

  const handleUpdateCutout = (
    slabId: string,
    cutoutId: string,
    field: keyof Cutout,
    value: any,
  ) => {
    setTemplate((prev) => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        cutouts: c.cutouts.map((cut) =>
          cut.id === cutoutId ? { ...cut, [field]: value } : cut,
        ),
      })),
    }));
  };

  const handleRemoveCutout = (slabId: string, cutoutId: string) => {
    setTemplate((prev) => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        cutouts: c.cutouts.filter((cut) => cut.id !== cutoutId),
      })),
    }));
  };

  // ── Camera Views Handlers ──────────────────────────

  const handleCaptureCameraView = () => {
    const existingViews = template.cameraViews || [];

    if (existingViews.length >= 10) {
      showToast(t("maxCameraViews"));
      return;
    }

    setTemplate((prev) => ({
      ...prev,
      cameraViews: [
        ...existingViews,
        {
          id: `cam_${Date.now()}`,
          name: `${t("tabViews")} ${existingViews.length + 1}`,
          preset: 'iso-tfr',
          isDefault: existingViews.length === 0,
        },
      ],
    }));
    showToast(t("cameraViewAdded"));
  };



  const handlePromoteToDefault = (id: string) => {
    setTemplate((prev) => {
      const views = prev.cameraViews || [];
      const index = views.findIndex((v) => v.id === id);
      if (index <= 0) return prev; // already default or not found

      const newViews = [...views];
      const [promotedView] = newViews.splice(index, 1);

      promotedView.isDefault = true;
      for (let i = 0; i < newViews.length; i++) {
        newViews[i].isDefault = false;
      }
      newViews.unshift(promotedView);

      return { ...prev, cameraViews: newViews };
    });
  };

  const handleRemoveCameraView = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      cameraViews: (prev.cameraViews || []).filter((v) => v.id !== id),
    }));
  };



  // ── Dimension Label Handlers ──────────────────────────

  const handleAddDimensionLabel = (isCustom: boolean = false) => {
    if (!selectedEdge) return;
    const { slabId, edge } = selectedEdge;
    const parent = findComponentDeep(template.components, slabId);
    if (!parent) return;

    let newLabel: DimensionLabel;

    if (isCustom) {
      newLabel = {
        id: `dim_${Date.now()}`,
        type: "dimension_label",
        name: t("customDimension"),
        edge: "custom",
        text: "0",
        offset: 15,
        startPos: [0, 0, 0],
        endPos: [parent.length, 0, 0],
      };
    } else {
      // Default text expression: use the dimension that the edge measures
      const isXEdge = edge.includes("front") || edge.includes("back");
      const isZEdge = edge.includes("left") || edge.includes("right");
      const isVertical = !edge.includes("top") && !edge.includes("bottom");
      let defaultText: Expression = parent.length;
      if (isZEdge) defaultText = parent.depth;
      if (isVertical) defaultText = parent.thickness;

      newLabel = {
        id: `dim_${Date.now()}`,
        type: "dimension_label",
        name: `${t(`edges.${edge}`)} ${t("dimension")}`,
        edge: edge,
        text: defaultText,
        offset: 15,
      };
    }

    setTemplate((prev) => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        dimensionLabels: [...(c.dimensionLabels || []), newLabel],
      })),
    }));
    setSelectedDimensionLabelId(newLabel.id);
    setSelectedEdge(null);
  };

  const handleUpdateDimensionLabel = (
    slabId: string,
    labelId: string,
    field: keyof DimensionLabel,
    value: any,
  ) => {
    setTemplate((prev) => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        dimensionLabels: (c.dimensionLabels || []).map((l) =>
          l.id === labelId ? { ...l, [field]: value } : l,
        ),
      })),
    }));
  };

  const handleRemoveDimensionLabel = (
    slabId: string,
    labelId: string,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setTemplate((prev) => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        dimensionLabels: (c.dimensionLabels || []).filter(
          (l) => l.id !== labelId,
        ),
      })),
    }));
    if (selectedDimensionLabelId === labelId) setSelectedDimensionLabelId(null);
  };

  const selectedDimLabel = selectedDimensionLabelId
    ? findDimensionLabelDeep(template.components, selectedDimensionLabelId)
    : null;

  const handleExport = () => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      try {
        const dataURL = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = "stoneforge-design.png";
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("Error exporting image:", error);
      }
    }
  };

  const handleComponentChange = (
    id: string,
    field: keyof SlabComponent,
    value: any,
  ) => {
    setTemplate((prev) => ({
      ...prev,
      components: updateComponentDeep(prev.components, id, (c) => ({
        ...c,
        [field]: value,
      })),
    }));
  };

  const renderComponentTree = (components: SlabComponent[], depth = 0) => {
    return components.map((comp) => (
      <React.Fragment key={comp.id}>
        <div
          onClick={() => handleSelectComponent(comp.id)}
          className={`px-3 py-2 rounded-md text-sm cursor-pointer flex justify-between items-center ${selectedComponentId === comp.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
          style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
        >
          <span className="truncate pr-2">{comp.name}</span>
          <button onClick={(e) => handleRemoveComponent(comp.id, e)}>
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 flex-shrink-0" />
          </button>
        </div>
        {/* Dimension Labels */}
        {comp.dimensionLabels?.map((label) => (
          <div
            key={label.id}
            onClick={() => handleSelectComponent(label.id)}
            className={`px-3 py-1.5 rounded-md text-xs cursor-pointer flex justify-between items-center ${selectedDimensionLabelId === label.id ? "bg-amber-50 text-amber-700 font-medium" : "text-gray-500 hover:bg-gray-50"}`}
            style={{ paddingLeft: `${(depth + 1) * 1.5 + 0.75}rem` }}
          >
            <span className="truncate pr-2 flex items-center gap-1">
              <Ruler className="w-3 h-3 flex-shrink-0" />
              {label.name}
            </span>
            <button
              onClick={(e) => handleRemoveDimensionLabel(comp.id, label.id, e)}
            >
              <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500 flex-shrink-0" />
            </button>
          </div>
        ))}
        {comp.children && renderComponentTree(comp.children, depth + 1)}
      </React.Fragment>
    ));
  };

  // Set toolbar content in the auth layout header
  useEffect(() => {
    if (isLoading) return;
    setToolBar(
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-indigo-600" />
          <h1 className="font-semibold text-gray-900">{t("brandTitle")}</h1>
          <span className="text-gray-400 mx-2">|</span>
          {viewMode === "designer" ? (
            <input
              type="text"
              value={template.name}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, name: e.target.value }))
              }
              className="text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 p-0 w-48"
            />
          ) : (
            <span className="text-sm font-medium text-gray-700 truncate max-w-48">
              {template.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-md p-0.5 border border-gray-200">
            <button
              onClick={() => setViewMode("user")}
              title={t("userTooltip")}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded text-xs font-medium transition-colors ${viewMode === "user"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <Eye className="w-3.5 h-3.5" /> {t("user")}
            </button>
            <button
              onClick={() => setViewMode("designer")}
              title={t("designerTooltip")}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded text-xs font-medium transition-colors ${viewMode === "designer"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" /> {t("designer")}
            </button>
          </div>

          {viewMode === "designer" && (
            <button
              onClick={handleExport}
              className="bg-white border border-gray-300 text-gray-700 py-1.5 px-3 rounded-md text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> {t("exportImage")}
            </button>
          )}
          {viewMode === "designer" && template.id !== "temp_1" && (
            <button
              onClick={handleDuplicateTemplate}
              disabled={isSaving}
              className="bg-white border border-indigo-200 text-indigo-700 py-1.5 px-3 rounded-md text-xs font-medium hover:bg-indigo-50 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> {t("duplicateDesign")}
            </button>
          )}
          <button
            onClick={onSave}
            disabled={isSaving}
            className="bg-indigo-600 text-white py-1.5 px-3 rounded-md text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />{" "}
            {isSaving ? t("saving") : t("saveTemplate")}
          </button>
        </div>
      </div>,
    );
    return () => setToolBar(null);
  }, [isLoading, template, isSaving, viewMode, setToolBar]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-sm font-medium text-gray-500">
            {t("loadingWorkspace")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-100 overflow-hidden font-sans">
      <div className="flex flex-1 overflow-hidden">
        {/* ── USER VIEW ─────────────────────────────────────────────── */}
        {viewMode === "user" && (
          <>
            {/* Full-width 3D Canvas */}
            <div className="flex-1 relative bg-gray-50">
              <Canvas
                ref={canvasRef}
                orthographic
                camera={{ position: [200, 200, 200], zoom: 2 }}
                gl={{ preserveDrawingBuffer: true }}
              >
                <color attach="background" args={["#f9fafb"]} />
                <ambientLight intensity={0.5} />
                <directionalLight
                  position={[100, 200, 100]}
                  intensity={1}
                  castShadow
                />
                <React.Suspense fallback={null}>
                  <Environment preset="city" />
                  <group position={[-100, 0, 50]}>
                    {template.components.map((comp) => (
                      <Slab3D
                        key={comp.id}
                        slab={comp}
                        isSelected={false}
                        onSelect={() => { }}
                        selectedComponentId={null}
                        onEdgeSelect={() => { }}
                        selectedEdge={null}
                        selectedDimensionLabelId={null}
                        variables={variablesMap}
                      />
                    ))}
                  </group>
                </React.Suspense>
                <OrbitControls makeDefault minDistance={50} maxDistance={500} />
              </Canvas>
            </div>

            {/* Right Panel – Variable Editor */}
            <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full shadow-sm z-10">
              <StoneForgeVariableEditor
                template={template}
                onVariableChange={(id, value) =>
                  handleUpdateVariable(id, "default", value)
                }
              />
            </div>
          </>
        )}

        {/* ── DESIGNER VIEW ──────────────────────────────────────────── */}
        {viewMode === "designer" && (
          <>
            {/* Left Sidebar (Library & Variables) */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
              <div className="p-3 border-b border-gray-100 bg-gray-50 flex gap-2">
                <button
                  onClick={() => setActiveLeftTab("assembly")}
                  className={`flex-1 text-xs font-medium py-1.5 rounded ${activeLeftTab === "assembly" ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  {t("tabAssembly")}
                </button>
                <button
                  onClick={() => setActiveLeftTab("views")}
                  className={`flex-1 text-xs font-medium py-1.5 rounded ${activeLeftTab === "views" ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  {t("tabViews")}
                </button>
                <button
                  onClick={() => setActiveLeftTab("variables")}
                  className={`flex-1 text-xs font-medium py-1.5 rounded ${activeLeftTab === "variables" ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  {t("tabVariables")}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activeLeftTab === "assembly" ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> {t("components")}
                      </h3>
                      <button
                        onClick={handleAddComponent}
                        className="text-gray-400 hover:text-indigo-600"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {renderComponentTree(template.components)}
                    </div>
                  </>
                ) : activeLeftTab === "views" ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" /> {t("cameraViews")}
                      </h3>
                      <button
                        onClick={handleCaptureCameraView}
                        className="text-gray-400 hover:text-indigo-600"
                        title={t("captureCurrentView")}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">
                      {t("cameraViewsDescription")}
                    </p>
                    <div className="space-y-2">
                      {template.cameraViews?.map((view) => (
                        <div
                          key={view.id}
                          onClick={() => handleSelectPreviewView(view.id)}
                          className={`p-3 bg-gray-50 rounded-md flex flex-col gap-2 transition-colors border cursor-pointer ${selectedPreviewViewId === view.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}
                        >
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={view.name}
                              onChange={(e) => {
                                setTemplate((prev) => ({
                                  ...prev,
                                  cameraViews: prev.cameraViews?.map((v) =>
                                    v.id === view.id ? { ...v, name: e.target.value } : v,
                                  ),
                                }));
                              }}
                              className="text-xs font-semibold text-gray-800 w-full p-1 border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded bg-transparent focus:bg-white"
                            />
                            {!view.isDefault && (
                              <button
                                onClick={() => handleRemoveCameraView(view.id)}
                                className="p-1 hover:bg-gray-200 rounded shrink-0 ml-2"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-500 w-16 shrink-0">{t("preset")}</span>
                            <select
                              value={view.preset || 'iso-tfr'}
                              onChange={(e) => {
                                setTemplate((prev) => ({
                                  ...prev,
                                  cameraViews: prev.cameraViews?.map((v) =>
                                    v.id === view.id ? { ...v, preset: e.target.value as any } : v,
                                  ),
                                }));
                              }}
                              className="text-xs flex-1 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                            >
                              <optgroup label={t("presetStandard")}>
                                <option value="front">{t("edges.front")}</option>
                                <option value="back">{t("edges.back")}</option>
                                <option value="left">{t("edges.left")}</option>
                                <option value="right">{t("edges.right")}</option>
                                <option value="top">{t("edges.top")}</option>
                                <option value="bottom">{t("edges.bottom")}</option>
                              </optgroup>
                              <optgroup label={t("presetIsometric")}>
                                <option value="iso-tfr">{t("presetIsometricOptions.isoTfr")}</option>
                                <option value="iso-tfl">{t("presetIsometricOptions.isoTfl")}</option>
                                <option value="iso-tbr">{t("presetIsometricOptions.isoTbr")}</option>
                                <option value="iso-tbl">{t("presetIsometricOptions.isoTbl")}</option>
                                <option value="iso-bfr">{t("presetIsometricOptions.isoBfr")}</option>
                                <option value="iso-bfl">{t("presetIsometricOptions.isoBfl")}</option>
                                <option value="iso-bbr">{t("presetIsometricOptions.isoBbr")}</option>
                                <option value="iso-bbl">{t("presetIsometricOptions.isoBbl")}</option>
                                <option value="isometric" className="hidden">{t("presetIsometricOptions.isoLegacy")}</option>
                              </optgroup>
                            </select>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-1 mt-1 pl-18">
                              {ISOMETRIC_PRESETS.map(preset => {
                                const isActive = view.preset === preset.id || (view.preset === 'isometric' && preset.id === 'iso-tfr');
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTemplate((prev) => ({
                                        ...prev,
                                        cameraViews: prev.cameraViews?.map((v) =>
                                          v.id === view.id ? { ...v, preset: preset.id as any } : v,
                                        ),
                                      }));
                                    }}
                                    className={`p-1.5 border rounded flex items-center justify-center transition-colors ${
                                      isActive 
                                        ? "bg-indigo-50 border-indigo-400 text-indigo-700" 
                                        : "bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 border-gray-200"
                                    }`}
                                    title={preset.title}
                                  >
                                    {preset.icon}
                                  </button>
                                );
                              })}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-500 w-16 shrink-0">{t("target")}</span>
                            <select
                              value={view.focusTargetId || ''}
                              onChange={(e) => {
                                setTemplate((prev) => ({
                                  ...prev,
                                  cameraViews: prev.cameraViews?.map((v) =>
                                    v.id === view.id ? { ...v, focusTargetId: e.target.value } : v,
                                  ),
                                }));
                              }}
                              className="text-xs flex-1 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                            >
                              <option value="">{t("entireModel")}</option>
                              {/* Flatten components to populate list recursively */}
                              {(() => {
                                const renderOptions = (comps: SlabComponent[], indent = '') => {
                                  return comps.flatMap((c) => [
                                    <option key={c.id} value={c.id}>{indent}{c.name}</option>,
                                    ...(c.dimensionLabels ? c.dimensionLabels.map(l => (
                                      <option key={l.id} value={l.id}>{indent}- [Dim] {l.name}</option>
                                    )) : []),
                                    ...(c.children ? renderOptions(c.children, indent + '- ') : [])
                                  ]);
                                };
                                return renderOptions(template.components);
                              })()}
                            </select>
                          </div>
                          <div className="mt-1 pt-2 border-t border-gray-200">
                            {view.isDefault ? (
                              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-max">
                                {t("defaultView")}
                              </span>
                            ) : (
                              <button
                                onClick={() => handlePromoteToDefault(view.id)}
                                className="text-[10px] font-semibold text-gray-500 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 px-2 py-0.5 rounded w-max"
                              >
                                {t("setAsDefault")}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!template.cameraViews ||
                        template.cameraViews.length === 0) && (
                          <p className="text-xs text-gray-500 text-center py-4">
                            {t("noCameraViews")}
                          </p>
                        )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        {t("tabVariables")}
                      </h3>
                      <button
                        onClick={handleAddVariable}
                        className="text-gray-400 hover:text-indigo-600"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {template.variables.length === 0 && (
                        <p className="text-xs text-gray-500 text-center py-4">
                          {t("noVariables")}
                        </p>
                      )}
                      {template.variables.map((v) => (
                        <div
                          key={v.id}
                          className="p-2 bg-gray-50 rounded-md border border-gray-200"
                        >
                          <input
                            type="text"
                            value={v.label}
                            onChange={(e) => {
                              // Only allow alphanumeric and underscores
                              const safeLabel = e.target.value.replace(
                                /[^a-zA-Z0-9_]/g,
                                "",
                              );
                              handleUpdateVariable(v.id, "label", safeLabel);
                            }}
                            className="text-xs font-medium text-gray-700 w-full mb-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                            placeholder={t("variableNamePlaceholder")}
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold">
                              {t("defaultLabel")}
                            </span>
                            <input
                              type="number"
                              value={v.default}
                              onChange={(e) =>
                                handleUpdateVariable(
                                  v.id,
                                  "default",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="text-xs flex-1 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => handleRemoveVariable(v.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="text"
                              value={v.min !== undefined ? v.min : ""}
                              onChange={(e) =>
                                handleUpdateVariable(
                                  v.id,
                                  "min",
                                  e.target.value === "" ? undefined : e.target.value,
                                )
                              }
                              placeholder={t("minPlaceholder")}
                              className="text-[10px] flex-1 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 font-mono"
                            />
                            <input
                              type="text"
                              value={v.max !== undefined ? v.max : ""}
                              onChange={(e) =>
                                handleUpdateVariable(
                                  v.id,
                                  "max",
                                  e.target.value === "" ? undefined : e.target.value,
                                )
                              }
                              placeholder={t("maxPlaceholder")}
                              className="text-[10px] flex-1 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Center Workspace (3D Canvas) */}
            <div className="flex-1 relative bg-gray-50" ref={canvasContainerRef}>

              <Canvas
                ref={canvasRef}
                orthographic
                camera={{ position: [200, 200, 200] }}
                gl={{ preserveDrawingBuffer: true }}
              >
                <color attach="background" args={["#f9fafb"]} />
                <ambientLight intensity={0.5} />
                <directionalLight
                  position={[100, 200, 100]}
                  intensity={1}
                  castShadow
                />

                <React.Suspense fallback={null}>
                  <Environment preset="city" />

                  <Bounds fit={!selectedPreviewViewId} clip observe={!selectedPreviewViewId} margin={1.2}>
                    {(() => {
                      const selectedView = template.cameraViews?.find((v) => v.id === selectedPreviewViewId);
                      if (selectedView && selectedView.preset) {
                        return (
                          <PresetCameraFitter 
                            preset={selectedView.preset} 
                            focusTargetId={selectedView.focusTargetId} 
                            zoomMultiplier={selectedView.zoomMultiplier} 
                            forceRenderRefreshCount={previewRefreshCount}
                          />
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Center the assembly */}
                    <group position={[-100, 0, 50]}>
                    {template.components.map((comp) => (
                      <Slab3D
                        key={comp.id}
                        slab={comp}
                        isSelected={selectedComponentId === comp.id}
                        onSelect={handleSelectComponent}
                        selectedComponentId={selectedComponentId}
                        selectedDimensionLabelId={selectedDimensionLabelId}
                        onEdgeSelect={handleSelectEdge}
                        selectedEdge={selectedEdge}
                        variables={variablesMap}
                      />
                    ))}
                    </group>
                  </Bounds>
                </React.Suspense>

                <OrbitControls
                  makeDefault
                  minDistance={50}
                  maxDistance={500}
                />
              </Canvas>
            </div>

            {/* Right Sidebar (Properties Inspector) */}
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-sm z-10">
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" /> {t("properties")}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                {selectedEdge ? (
                  <EdgeInspector
                    selectedEdge={selectedEdge}
                    handleAddEdgeComponent={handleAddEdgeComponent}
                    handleAddDimensionLabel={handleAddDimensionLabel}
                    handleTogglePolish={handleTogglePolish}
                    isPolished={(() => {
                      const comp = findComponentDeep(template.components, selectedEdge.slabId);
                      let mapEdge: "front" | "back" | "left" | "right" | null = null;
                      if (selectedEdge.edge.includes("front")) mapEdge = "front";
                      else if (selectedEdge.edge.includes("back")) mapEdge = "back";
                      else if (selectedEdge.edge.includes("left")) mapEdge = "left";
                      else if (selectedEdge.edge.includes("right")) mapEdge = "right";
                      return comp?.polishedEdges?.includes(mapEdge as any) ?? false;
                    })()}
                  />
                ) : selectedDimLabel ? (
                  <DimensionInspector
                    selectedDimLabel={selectedDimLabel}
                    variablesMap={variablesMap}
                    handleUpdateDimensionLabel={handleUpdateDimensionLabel}
                    handleRemoveDimensionLabel={handleRemoveDimensionLabel}
                  />
                ) : selectedComponent ? (
                  <ComponentInspector
                    selectedComponent={selectedComponent}
                    handleComponentChange={handleComponentChange}
                    handleAddCutout={handleAddCutout}
                    handleRemoveCutout={handleRemoveCutout}
                    handleUpdateCutout={handleUpdateCutout}
                  />
                ) : (
                  <GlobalInspector
                    template={template}
                    setTemplate={setTemplate}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {/* end flex flex-1 overflow-hidden */}
    </div>
  );
};
