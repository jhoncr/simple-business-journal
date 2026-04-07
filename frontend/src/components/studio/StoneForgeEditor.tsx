"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useToolbar } from "@/app/(auth)/nav_tool_handler";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Bounds } from "@react-three/drei";
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
import { functions, app } from "../../lib/auth_handler";
import { httpsCallable } from "firebase/functions";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { fetchEntry } from "../../lib/db_handler";

const findComponentDeep = (
  components: SlabComponent[],
  id: string,
): SlabComponent | null => {
  for (const c of components) {
    if (c.id === id) return c;
    if (c.children) {
      const found = findComponentDeep(c.children, id);
      if (found) return found;
    }
  }
  return null;
};

const updateComponentDeep = (
  components: SlabComponent[],
  id: string,
  updater: (c: SlabComponent) => SlabComponent,
): SlabComponent[] => {
  return components.map((c) => {
    if (c.id === id) {
      return updater(c);
    }
    if (c.children) {
      return { ...c, children: updateComponentDeep(c.children, id, updater) };
    }
    return c;
  });
};

const deleteComponentDeep = (
  components: SlabComponent[],
  id: string,
): SlabComponent[] => {
  return components
    .filter((c) => c.id !== id)
    .map((c) => {
      if (c.children) {
        return { ...c, children: deleteComponentDeep(c.children, id) };
      }
      return c;
    });
};

const calculateMinY = (
  components: SlabComponent[],
  variables: Record<string, number>,
  currentY = 0,
): number => {
  let minY = currentY;
  for (const comp of components) {
    const posY = evaluateExpression(comp.position[1], variables);
    // The lowest point of this component in its parent's space
    const compMinY = currentY + posY;
    if (compMinY < minY) minY = compMinY;

    if (comp.children && comp.children.length > 0) {
      const childrenMinY = calculateMinY(
        comp.children,
        variables,
        currentY + posY,
      );
      if (childrenMinY < minY) minY = childrenMinY;
    }
  }
  return minY;
};

const ISOMETRIC_PRESETS = [
  { id: 'iso-tfr', title: 'Top Front Right', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="14" cy="10" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-tfl', title: 'Top Front Left', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="4" cy="10" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-tbr', title: 'Top Back Right', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="20" cy="4" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-tbl', title: 'Top Back Left', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="10" cy="4" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-bfr', title: 'Bottom Front Right', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="14" cy="20" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-bfl', title: 'Bottom Front Left', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="4" cy="20" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-bbr', title: 'Bottom Back Right', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="20" cy="14" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-bbl', title: 'Bottom Back Left', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="10" cy="14" r="2.5" fill="#ef4444" stroke="none" /></svg> },
];

export const StoneForgeEditor = () => {
  const searchParams = useSearchParams();
  const journalId = searchParams.get("jid");
  const entryId = searchParams.get("eid");
  const [isLoading, setIsLoading] = useState(!!entryId);

  const [template, setTemplate] = useState<AssemblyTemplate>({
    id: "temp_1",
    name: "Untitled Assembly",
    variables: [],
    components: [
      {
        id: "slab_1",
        type: "slab",
        name: "Main Counter",
        length: 228.0,
        depth: 60.0,
        thickness: 2.0,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        cutouts: [
          {
            id: "cut_1",
            shape: "rectangular",
            width: 40.0,
            depth: 30.0,
            centerX: 49.0,
            centerY: 30.0,
          },
        ],
        children: [],
      },
    ],
  });

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

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    async function loadTemplate() {
      if (journalId && entryId) {
        try {
          const entry = await fetchEntry(journalId, "template", entryId);
          if (entry && entry.details) {
            // Document ID from Firestore is entryId
            // The template.id in state should be the Firestore doc ID
            setTemplate({
              ...(entry.details as any),
              id: entryId, // Force the doc ID to be the template ID
            });
            setSelectedComponentId(null);
          }
        } catch (error) {
          console.error("Error fetching template:", error);
          showToast("Failed to load existing template.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }
    loadTemplate();
  }, [journalId, entryId]);

  const handleSaveTemplate = async () => {
    if (!journalId) {
      showToast("Cannot save: No journal ID provided in URL");
      return;
    }
    setIsSaving(true);
    try {
      let finalTemplate = { ...template };

      // Auto-capture 3D preview thumbnail before saving
      let thumbnailBase64 = undefined;
      if (canvasRef.current) {
        try {
          thumbnailBase64 = canvasRef.current.toDataURL("image/png");
        } catch (err) {
          console.warn("Failed to capture canvas thumbnail:", err);
        }
      }

      const auth = getAuth(app);
      if (!auth.currentUser) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }

      if (auth.currentUser) {
        const addLogFunction = httpsCallable(functions, "addLogFn");

        // If template.id is 'temp_1' or similar initial placeholder, it's a NEW template
        // Otherwise, it's an existing one.
        // Note: New templates from 'duplicateEntry' will have a real Firestore ID.
        const isNew = template.id === "temp_1";

        if (isNew) {
          // It's a new template, create a new document
          const payload = {
            jid: journalId,
            entryType: "template",
            name: finalTemplate.name,
            details: finalTemplate,
            ...(thumbnailBase64 && { thumbnailBase64 }),
          };
          const response = await addLogFunction(payload);
          const newTemplateId = (response.data as any).id;

          // Update local state with the new ID
          setTemplate((prev) => ({ ...prev, id: newTemplateId }));

          showToast("Template saved successfully!");
        } else {
          // It's an existing template, update it
          const payload = {
            jid: journalId,
            entryType: "template",
            entryId: finalTemplate.id,
            name: finalTemplate.name,
            details: finalTemplate,
            ...(thumbnailBase64 && { thumbnailBase64 }),
          };
          await addLogFunction(payload);
          showToast("Template updated successfully!");
        }
      }
    } catch (error) {
      console.error("Error saving template:", error);
      showToast("Failed to save template. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateTemplate = async () => {
    if (!journalId || template.id === "temp_1") {
      showToast(
        "Cannot duplicate: Save the template first or provide a journal ID",
      );
      return;
    }

    setIsSaving(true);
    try {
      const duplicateFn = httpsCallable(functions, "duplicateEntry");
      const response = await duplicateFn({
        jid: journalId,
        entryId: template.id,
        entryType: "template",
      });

      const newId = (response.data as any).id;
      if (newId) {
        showToast("Template duplicated! Reloading with new design...");
        // Redirect to the new template
        window.location.href = `/journal/entry?jid=${journalId}&eid=${newId}&jtype=template`;
      }
    } catch (error) {
      console.error("Error duplicating template:", error);
      showToast("Failed to duplicate template.");
    } finally {
      setIsSaving(false);
    }
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

  const minY = useMemo(() => {
    return calculateMinY(template.components, variablesMap);
  }, [template.components, variablesMap]);

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
          name: `New Slab ${prev.components.length + 1}`,
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
      name: "New Component",
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
      newComp.name = `${edge} Custom`;
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
    field: "label" | "default",
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
      showToast("Maximum of 10 camera views allowed.");
      return;
    }

    setTemplate((prev) => ({
      ...prev,
      cameraViews: [
        ...existingViews,
        {
          id: `cam_${Date.now()}`,
          name: `View ${existingViews.length + 1}`,
          preset: 'iso-tfr',
          isDefault: existingViews.length === 0,
        },
      ],
    }));
    showToast("Camera View Added!");
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

  const findDimensionLabelDeep = (
    components: SlabComponent[],
    labelId: string,
  ): { slabId: string; label: DimensionLabel } | null => {
    for (const c of components) {
      const found = c.dimensionLabels?.find((l) => l.id === labelId);
      if (found) return { slabId: c.id, label: found };
      if (c.children) {
        const res = findDimensionLabelDeep(c.children, labelId);
        if (res) return res;
      }
    }
    return null;
  };

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
        name: `Custom Dimension`,
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
        name: `${edge} Dimension`,
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
          <h1 className="font-semibold text-gray-900">StoneForge 3D</h1>
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
              title="User View – variables only"
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded text-xs font-medium transition-colors ${viewMode === "user"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <Eye className="w-3.5 h-3.5" /> User
            </button>
            <button
              onClick={() => setViewMode("designer")}
              title="Designer View – full editor"
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded text-xs font-medium transition-colors ${viewMode === "designer"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" /> Designer
            </button>
          </div>

          {viewMode === "designer" && (
            <button
              onClick={handleExport}
              className="bg-white border border-gray-300 text-gray-700 py-1.5 px-3 rounded-md text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export Image
            </button>
          )}
          {viewMode === "designer" && template.id !== "temp_1" && (
            <button
              onClick={handleDuplicateTemplate}
              disabled={isSaving}
              className="bg-white border border-indigo-200 text-indigo-700 py-1.5 px-3 rounded-md text-xs font-medium hover:bg-indigo-50 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> Duplicate Design
            </button>
          )}
          <button
            onClick={handleSaveTemplate}
            disabled={isSaving}
            className="bg-indigo-600 text-white py-1.5 px-3 rounded-md text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />{" "}
            {isSaving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>,
    );
    return () => setToolBar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, template, isSaving, viewMode, setToolBar]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-sm font-medium text-gray-500">
            Loading workspace...
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
                    <Grid
                      position={[100, minY - 0.1, -50]}
                      args={[500, 500]}
                      cellSize={10}
                      cellThickness={1}
                      cellColor="#e5e7eb"
                      sectionSize={50}
                      sectionThickness={1.5}
                      sectionColor="#d1d5db"
                      fadeDistance={400}
                      fadeStrength={1}
                    />
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
                  Assembly
                </button>
                <button
                  onClick={() => setActiveLeftTab("views")}
                  className={`flex-1 text-xs font-medium py-1.5 rounded ${activeLeftTab === "views" ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  Views
                </button>
                <button
                  onClick={() => setActiveLeftTab("variables")}
                  className={`flex-1 text-xs font-medium py-1.5 rounded ${activeLeftTab === "variables" ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  Variables
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activeLeftTab === "assembly" ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> Components
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
                        <Camera className="w-3.5 h-3.5" /> Camera Views
                      </h3>
                      <button
                        onClick={handleCaptureCameraView}
                        className="text-gray-400 hover:text-indigo-600"
                        title="Capture Current View"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">
                      Save multiple 3D perspectives to display on the technical
                      drawings print layout. You can explicitly promote any view
                      to be the default view.
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
                            <span className="text-[10px] uppercase font-bold text-gray-500 w-16 shrink-0">Preset</span>
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
                              <optgroup label="Standard">
                                <option value="front">Front</option>
                                <option value="back">Back</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                              </optgroup>
                              <optgroup label="Isometric">
                                <option value="iso-tfr">Top Front Right (TFR)</option>
                                <option value="iso-tfl">Top Front Left (TFL)</option>
                                <option value="iso-tbr">Top Back Right (TBR)</option>
                                <option value="iso-tbl">Top Back Left (TBL)</option>
                                <option value="iso-bfr">Bottom Front Right (BFR)</option>
                                <option value="iso-bfl">Bottom Front Left (BFL)</option>
                                <option value="iso-bbr">Bottom Back Right (BBR)</option>
                                <option value="iso-bbl">Bottom Back Left (BBL)</option>
                                <option value="isometric" className="hidden">Isometric (Legacy)</option>
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
                            <span className="text-[10px] uppercase font-bold text-gray-500 w-16 shrink-0">Target</span>
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
                              <option value="">Entire Model</option>
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
                                Default View
                              </span>
                            ) : (
                              <button
                                onClick={() => handlePromoteToDefault(view.id)}
                                className="text-[10px] font-semibold text-gray-500 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 px-2 py-0.5 rounded w-max"
                              >
                                Set as Default
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!template.cameraViews ||
                        template.cameraViews.length === 0) && (
                          <p className="text-xs text-gray-500 text-center py-4">
                            No camera views saved.
                          </p>
                        )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        Variables
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
                          No variables defined yet.
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
                            placeholder="Variable Name (e.g. length_a)"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold">
                              Default:
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

                  <Bounds fit clip observe margin={1.2}>
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

                    <Grid
                      position={[100, -0.1, -50]}
                      args={[500, 500]}
                      cellSize={10}
                      cellThickness={1}
                      cellColor="#e5e7eb"
                      sectionSize={50}
                      sectionThickness={1.5}
                      sectionColor="#d1d5db"
                      fadeDistance={400}
                      fadeStrength={1}
                    />
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
                  <Settings className="w-3.5 h-3.5" /> Properties
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                {selectedEdge ? (
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
                ) : selectedDimLabel ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 capitalize mb-1 flex items-center gap-1.5">
                        <Ruler className="w-4 h-4 text-amber-600" /> Dimension
                        Label
                      </h4>
                      <p className="text-xs text-gray-500 mb-4">
                        Configure this dimension label.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Name
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
                        Edge
                      </label>
                      <div className="text-sm text-gray-600 bg-gray-50 px-2 py-1.5 rounded border border-gray-200 capitalize">
                        {selectedDimLabel.label.edge}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Text Expression
                      </label>
                      <input
                        type="text"
                        value={selectedDimLabel.label.text}
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
                        Evaluated:{" "}
                        <span className="font-medium">
                          {evaluateExpression(
                            selectedDimLabel.label.text,
                            variablesMap,
                          )}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Offset (distance from edge)
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
                          Custom Points
                        </h4>

                        <div className="mb-3">
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">
                            Start Pos (X, Y, Z)
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {["X", "Y", "Z"].map((axis, i) => (
                              <input
                                key={`start-${axis}`}
                                type="text"
                                value={String(
                                  selectedDimLabel.label.startPos?.[i] ?? 0,
                                )}
                                onChange={(e) => {
                                  const newPos = [
                                    ...(selectedDimLabel.label.startPos || [
                                      0, 0, 0,
                                    ]),
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
                            End Pos (X, Y, Z)
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {["X", "Y", "Z"].map((axis, i) => (
                              <input
                                key={`end-${axis}`}
                                type="text"
                                value={String(
                                  selectedDimLabel.label.endPos?.[i] ?? 0,
                                )}
                                onChange={(e) => {
                                  const newPos = [
                                    ...(selectedDimLabel.label.endPos || [
                                      0, 0, 0,
                                    ]),
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
                        <Trash2 className="w-3.5 h-3.5" /> Remove Label
                      </button>
                    </div>
                  </div>
                ) : selectedComponent ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={selectedComponent.name}
                        onChange={(e) =>
                          handleComponentChange(
                            selectedComponent.id,
                            "name",
                            e.target.value,
                          )
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
                      <h4 className="text-xs font-semibold text-gray-900 mb-3">
                        Position
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {["X", "Y", "Z"].map((axis, i) => (
                          <div key={axis}>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                              {axis}
                            </label>
                            <input
                              type="text"
                              value={String(
                                selectedComponent.position[i as 0 | 1 | 2],
                              )}
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
                              value={String(
                                selectedComponent.rotation?.[i as 0 | 1 | 2] ||
                                0,
                              )}
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
                        <p className="text-[10px] text-gray-500 mb-4">
                          No sinks added.
                        </p>
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
                                handleRemoveCutout(
                                  selectedComponent.id,
                                  cutout.id,
                                )
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
                                  {cutout.shape === "circular"
                                    ? "Diameter"
                                    : "Width"}
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
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 capitalize mb-1 flex items-center gap-1.5">
                        <Settings className="w-4 h-4 text-indigo-600" /> Global Properties
                      </h4>
                      <p className="text-xs text-gray-500 mb-4">
                        Configure the template properties.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Template Name
                      </label>
                      <input
                        type="text"
                        value={template.name}
                        onChange={(e) =>
                          setTemplate((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description (Optional)
                      </label>
                      <textarea
                        value={template.description || ""}
                        maxLength={200}
                        onChange={(e) =>
                          setTemplate((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                        placeholder="Add a brief description (up to 200 characters)..."
                      />
                      <div className="text-[10px] text-right mt-1 text-gray-400">
                        {(template.description || "").length}/200
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {/* end flex flex-1 overflow-hidden */}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-md shadow-lg text-sm z-50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};
