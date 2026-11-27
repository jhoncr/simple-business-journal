"use client";

import React, { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Bounds, useBounds } from "@react-three/drei";
import * as THREE from "three";
import { SlabComponent, CameraView } from "@backend/common/schemas/studio";
import { evaluateExpression } from "@/lib/evaluator";
import { Slab3D } from "./Slab3D";
import { getEdgeGeometry } from "./DimensionLabel3D";
import { useTranslations } from "next-intl";

interface OrbitControlsTarget {
  target: THREE.Vector3;
  update: () => void;
}

function isOrbitControlsTarget(value: unknown): value is OrbitControlsTarget {
  return (
    typeof value === "object" &&
    value !== null &&
    "target" in value &&
    "update" in value &&
    typeof (value as OrbitControlsTarget).update === "function"
  );
}

export interface StoneForgeViewerProps {
  components: SlabComponent[];
  variables: Record<string, number>;
  printMode?: boolean;
  fixedCameraView?: CameraView;
  focusTargetName?: string;
  onSnapshot?: (dataUrl: string) => void;
  onSnapshotReady?: (dataUrl: string) => void;
}

const CameraController = ({
  focusTargetName,
  variables,
  components,
}: {
  focusTargetName?: string;
  variables: Record<string, number>;
  components: SlabComponent[];
}) => {
  const bounds = useBounds();
  const { scene, camera, size } = useThree();
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    // Wait a brief moment for R3F to update the 3D meshes based on the new variables
    const timeoutId = setTimeout(() => {
      let target: THREE.Object3D = scene;
      if (focusTargetName) {
        const found = scene.getObjectByName(focusTargetName);
        if (found) {
          target = found;
        }
      }
      bounds.refresh(target).fit().clip();
      const { width, height } = sizeRef.current;
      if (width > 0 && height > 0) {
        camera.userData.fittedSize = `${width}x${height}`;
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [bounds, scene, camera, size.width, size.height, focusTargetName, variables, components]);

  return null;
};

/**
 * Mathematically computes all 3D world-space points for all slabs and dimension labels
 * in the assembly, taking into account nested hierarchies, positions, rotations, and variables.
 */
function collectAssemblyPoints(
  components: SlabComponent[],
  variables: Record<string, number>,
  focusTargetId?: string,
): { points: THREE.Vector3[]; center: THREE.Vector3; maxDim: number; fullMaxDim: number } {
  const allPoints: THREE.Vector3[] = [];
  let focusPoints: THREE.Vector3[] = [];
  let focusCenter: THREE.Vector3 | null = null;

  function traverse(
    comps: SlabComponent[],
    currentMatrix: THREE.Matrix4,
  ) {
    for (const slab of comps) {
      const L = evaluateExpression(slab.length, variables);
      const D = evaluateExpression(slab.depth, variables);
      const T = evaluateExpression(slab.thickness, variables);

      const posX = evaluateExpression(slab.position[0], variables);
      const posY = evaluateExpression(slab.position[1], variables);
      const posZ = evaluateExpression(slab.position[2], variables);

      const rotX = slab.rotation ? evaluateExpression(slab.rotation[0], variables) : 0;
      const rotY = slab.rotation ? evaluateExpression(slab.rotation[1], variables) : 0;
      const rotZ = slab.rotation ? evaluateExpression(slab.rotation[2], variables) : 0;

      // Slab local matrix
      const localMatrix = new THREE.Matrix4();
      const posVec = new THREE.Vector3(posX, posY, posZ);
      const euler = new THREE.Euler(rotX, rotY, rotZ);
      const quat = new THREE.Quaternion().setFromEuler(euler);
      localMatrix.compose(posVec, quat, new THREE.Vector3(1, 1, 1));

      // World matrix for this slab
      const worldMatrix = new THREE.Matrix4().multiplyMatrices(currentMatrix, localMatrix);

      // In Slab3D:
      // Slab geometry extends X: [0, L], Y: [0, D], Z: [0, T]
      // then rotated by [-Math.PI/2, 0, 0] around origin:
      // So in slab coordinates: X: [0, L], Y: [0, T], Z: [-D, 0]
      const slabLocalCorners = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(L, 0, 0),
        new THREE.Vector3(L, T, 0),
        new THREE.Vector3(0, T, 0),
        new THREE.Vector3(0, 0, -D),
        new THREE.Vector3(L, 0, -D),
        new THREE.Vector3(L, T, -D),
        new THREE.Vector3(0, T, -D),
      ];

      const currentSlabPoints: THREE.Vector3[] = [];
      for (const pt of slabLocalCorners) {
        const worldPt = pt.clone().applyMatrix4(worldMatrix);
        allPoints.push(worldPt);
        currentSlabPoints.push(worldPt);
      }

      // Check if this slab is the focus target
      const isTargetSlab = focusTargetId === slab.id;

      // Dimension labels on this slab
      if (slab.dimensionLabels) {
        for (const lbl of slab.dimensionLabels) {
          const geom = getEdgeGeometry(lbl, L, D, T, variables);
          const pad = 20;
          const rawPts = [
            new THREE.Vector3(...geom.lineStart),
            new THREE.Vector3(...geom.lineEnd),
            new THREE.Vector3(...geom.extensionA[0]),
            new THREE.Vector3(...geom.extensionA[1]),
            new THREE.Vector3(...geom.extensionB[0]),
            new THREE.Vector3(...geom.extensionB[1]),
            // Padding around midpoint for HTML text badge in all 3D axis directions
            new THREE.Vector3(geom.midpoint[0] - pad, geom.midpoint[1], geom.midpoint[2]),
            new THREE.Vector3(geom.midpoint[0] + pad, geom.midpoint[1], geom.midpoint[2]),
            new THREE.Vector3(geom.midpoint[0], geom.midpoint[1] - pad, geom.midpoint[2]),
            new THREE.Vector3(geom.midpoint[0], geom.midpoint[1] + pad, geom.midpoint[2]),
            new THREE.Vector3(geom.midpoint[0], geom.midpoint[1], geom.midpoint[2] - pad),
            new THREE.Vector3(geom.midpoint[0], geom.midpoint[1], geom.midpoint[2] + pad),
          ];

          const thisLabelWorldPts: THREE.Vector3[] = [];
          for (const pt of rawPts) {
            const worldPt = pt.clone().applyMatrix4(worldMatrix);
            allPoints.push(worldPt);
            currentSlabPoints.push(worldPt);
            thisLabelWorldPts.push(worldPt);
          }

          if (focusTargetId === lbl.id) {
            // Target is this specific dimension label: tightly frame the dimension line, arrows, and measured edge
            focusPoints = thisLabelWorldPts;
            focusCenter = new THREE.Vector3(...geom.midpoint).applyMatrix4(worldMatrix);
          }
        }
      }

      if (isTargetSlab) {
        // Target is this specific slab: frame this slab and its dimension labels
        focusPoints = currentSlabPoints;
        const sBox = new THREE.Box3();
        currentSlabPoints.forEach((p) => sBox.expandByPoint(p));
        focusCenter = sBox.getCenter(new THREE.Vector3());
      }

      // Recurse children
      if (slab.children && slab.children.length > 0) {
        traverse(slab.children, worldMatrix);
      }
    }
  }

  traverse(components, new THREE.Matrix4());

  let targetPoints = allPoints;
  if (focusTargetId && focusPoints.length > 0) {
    targetPoints = focusPoints;
  }

  if (targetPoints.length === 0) {
    targetPoints = [
      new THREE.Vector3(-50, -50, -50),
      new THREE.Vector3(50, 50, 50),
    ];
  }

  const worldBox = new THREE.Box3();
  for (const pt of targetPoints) {
    worldBox.expandByPoint(pt);
  }

  const fullBox = new THREE.Box3();
  for (const pt of allPoints.length > 0 ? allPoints : targetPoints) {
    fullBox.expandByPoint(pt);
  }

  const center = focusCenter || worldBox.getCenter(new THREE.Vector3());
  const boxSize = worldBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z, 100);
  const fullBoxSize = fullBox.getSize(new THREE.Vector3());
  const fullMaxDim = Math.max(fullBoxSize.x, fullBoxSize.y, fullBoxSize.z, maxDim);

  return { points: targetPoints, center, maxDim, fullMaxDim };
}

export const PresetCameraFitter = ({
  preset,
  focusTargetId,
  zoomMultiplier = 1,
  forceRenderRefreshCount = 0,
  variables = {},
  components = [],
}: {
  preset: string;
  focusTargetId?: string;
  zoomMultiplier?: number;
  forceRenderRefreshCount?: number;
  variables?: Record<string, number>;
  components?: SlabComponent[];
}) => {
  const { camera, controls, size } = useThree();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    let isMounted = true;

    const attemptFit = () => {
      if (!isMounted) return;
      const currentSize = sizeRef.current;
      if (!currentSize.width || !currentSize.height) {
        timeoutRef.current = setTimeout(attemptFit, 50);
        return;
      }

      if (!components || components.length === 0) return;

      const { points, center, fullMaxDim } = collectAssemblyPoints(components, variables, focusTargetId);

      // 1. Initial camera positioning based on preset orientation.
      // Use full assembly maxDim so detail views never clip inside foreground slabs.
      const camDistance = Math.max(fullMaxDim * 4, 200);

      let camDir = new THREE.Vector3(1, 1, 1).normalize();
      let camUp = new THREE.Vector3(0, 1, 0);

      if (preset === "top") {
        camDir = new THREE.Vector3(0, 1, 0);
        camUp = new THREE.Vector3(0, 0, -1);
      } else if (preset === "bottom") {
        camDir = new THREE.Vector3(0, -1, 0);
        camUp = new THREE.Vector3(0, 0, 1);
      } else if (preset === "front") {
        camDir = new THREE.Vector3(0, 0, 1);
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "back") {
        camDir = new THREE.Vector3(0, 0, -1);
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "right") {
        camDir = new THREE.Vector3(1, 0, 0);
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "left") {
        camDir = new THREE.Vector3(-1, 0, 0);
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "isometric" || preset === "iso-tfr") {
        camDir = new THREE.Vector3(1, 1, 1).normalize();
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "iso-tfl") {
        camDir = new THREE.Vector3(-1, 1, 1).normalize();
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "iso-tbr") {
        camDir = new THREE.Vector3(1, 1, -1).normalize();
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "iso-tbl") {
        camDir = new THREE.Vector3(-1, 1, -1).normalize();
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "iso-bfr") {
        camDir = new THREE.Vector3(1, -1, 1).normalize();
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "iso-bfl") {
        camDir = new THREE.Vector3(-1, -1, 1).normalize();
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "iso-bbr") {
        camDir = new THREE.Vector3(1, -1, -1).normalize();
        camUp = new THREE.Vector3(0, 1, 0);
      } else if (preset === "iso-bbl") {
        camDir = new THREE.Vector3(-1, -1, -1).normalize();
        camUp = new THREE.Vector3(0, 1, 0);
      }

      camera.up.copy(camUp);
      camera.position.copy(center).addScaledVector(camDir, camDistance);
      camera.lookAt(center);
      camera.updateMatrixWorld(true);

      // 2. Project points into camera space
      let minCamX = Infinity;
      let maxCamX = -Infinity;
      let minCamY = Infinity;
      let maxCamY = -Infinity;

      for (const pt of points) {
        const camPt = pt.clone().applyMatrix4(camera.matrixWorldInverse);
        if (camPt.x < minCamX) minCamX = camPt.x;
        if (camPt.x > maxCamX) maxCamX = camPt.x;
        if (camPt.y < minCamY) minCamY = camPt.y;
        if (camPt.y > maxCamY) maxCamY = camPt.y;
      }

      if (!isFinite(minCamX) || !isFinite(maxCamX)) {
        minCamX = -50; maxCamX = 50; minCamY = -50; maxCamY = 50;
      }

      // 3. 2D Center offset in camera space
      const centerCamX = (minCamX + maxCamX) / 2;
      const centerCamY = (minCamY + maxCamY) / 2;

      // Extract camera basis in world space: right = col 0, up = col 1
      const rightVec = new THREE.Vector3();
      const upVec = new THREE.Vector3();
      camera.matrixWorld.extractBasis(rightVec, upVec, new THREE.Vector3());

      const worldOffset = new THREE.Vector3()
        .addScaledVector(rightVec, centerCamX)
        .addScaledVector(upVec, centerCamY);

      const finalCenter = center.clone().add(worldOffset);

      camera.position.copy(finalCenter).addScaledVector(camDir, camDistance);
      camera.lookAt(finalCenter);
      camera.updateMatrixWorld(true);

      if (isOrbitControlsTarget(controls)) {
        controls.target.copy(finalCenter);
        controls.update();
      }

      // 4. Compute exact 2D bounding dimensions
      let boundingWidth = maxCamX - minCamX;
      let boundingHeight = maxCamY - minCamY;

      boundingWidth = Math.max(boundingWidth, 5);
      boundingHeight = Math.max(boundingHeight, 5);

      // Detail views frame the focused dimension with context (1.60), while overview views have clean margin (1.50)
      const margin = focusTargetId ? 1.60 : 1.50;
      const safeMultiplier = zoomMultiplier && zoomMultiplier > 0 ? zoomMultiplier : 1;

      const orthoCam = camera as THREE.OrthographicCamera;
      if (orthoCam.isOrthographicCamera) {
        // Ensure orthographic frustum matches current canvas size even before R3F internal resize effect settles
        orthoCam.left = -currentSize.width / 2;
        orthoCam.right = currentSize.width / 2;
        orthoCam.top = currentSize.height / 2;
        orthoCam.bottom = -currentSize.height / 2;

        const frustumWidth = currentSize.width;
        const frustumHeight = currentSize.height;

        const zoomX = frustumWidth / boundingWidth;
        const zoomY = frustumHeight / boundingHeight;
        const maxFitZoom = Math.min(zoomX, zoomY);
        const baseFitZoom = maxFitZoom / margin;

        // For overview views (!focusTargetId), cap zoom so legacy zoomMultiplier (e.g. 2) never clips the assembly or dimension labels
        const desiredZoom = baseFitZoom * safeMultiplier;
        orthoCam.zoom = !focusTargetId
          ? Math.min(desiredZoom, maxFitZoom / 1.15)
          : desiredZoom;
        orthoCam.near = 0.1;
        orthoCam.far = camDistance * 10;
        orthoCam.updateProjectionMatrix();
      } else if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspCam = camera as THREE.PerspectiveCamera;
        const fovRad = THREE.MathUtils.degToRad(perspCam.fov);
        const visibleHeight = 2 * Math.tan(fovRad / 2) * camDistance;
        const visibleWidth = visibleHeight * (currentSize.width / (currentSize.height || 1));

        const zoomX = visibleWidth / boundingWidth;
        const zoomY = visibleHeight / boundingHeight;
        const maxFitZoom = Math.min(zoomX, zoomY);
        const baseFitZoom = maxFitZoom / margin;

        const desiredZoom = baseFitZoom * safeMultiplier;
        perspCam.zoom = !focusTargetId
          ? Math.min(desiredZoom, maxFitZoom / 1.15)
          : desiredZoom;
        perspCam.near = 0.1;
        perspCam.far = camDistance * 10;
        perspCam.updateProjectionMatrix();
      }
      camera.userData.fittedSize = `${currentSize.width}x${currentSize.height}`;
    };

    attemptFit();

    return () => {
      isMounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    preset,
    focusTargetId,
    zoomMultiplier,
    variables,
    components,
    camera,
    controls,
    forceRenderRefreshCount,
    size.width,
    size.height,
  ]);

  return null;
};

/**
 * Component running inside R3F <Canvas> that forces immediate WebGL context disposal
 * when unmounting in print mode, releasing hardware context back to browser pool.
 */
function WebGLContextDisposer({ printMode }: { printMode?: boolean }) {
  const { gl } = useThree();

  useEffect(() => {
    return () => {
      if (printMode) {
        try {
          // Native Three.js forceContextLoss invokes WEBGL_lose_context extension
          gl.forceContextLoss?.();
        } catch {
          // fallback
        }
        try {
          const ext = gl.getContext()?.getExtension("WEBGL_lose_context");
          ext?.loseContext();
        } catch {
          // fallback
        }
        try {
          gl.dispose?.();
        } catch {
          // fallback
        }
      }
    };
  }, [gl, printMode]);

  return null;
}

interface WorldDimensionLabel {
  id: string;
  text: string;
  worldMidpoint: THREE.Vector3;
}

/**
 * Collects all 3D dimension labels across the component hierarchy with their world-space midpoints
 * and evaluated text strings so they can be composited onto 2D print snapshots.
 */
function collectDimensionLabelsWorld(
  components: SlabComponent[],
  variables: Record<string, number>,
): WorldDimensionLabel[] {
  const result: WorldDimensionLabel[] = [];

  function traverse(comps: SlabComponent[], currentMatrix: THREE.Matrix4) {
    for (const slab of comps) {
      const L = evaluateExpression(slab.length, variables);
      const D = evaluateExpression(slab.depth, variables);
      const T = evaluateExpression(slab.thickness, variables);

      const posX = evaluateExpression(slab.position[0], variables);
      const posY = evaluateExpression(slab.position[1], variables);
      const posZ = evaluateExpression(slab.position[2], variables);

      const rotX = slab.rotation ? evaluateExpression(slab.rotation[0], variables) : 0;
      const rotY = slab.rotation ? evaluateExpression(slab.rotation[1], variables) : 0;
      const rotZ = slab.rotation ? evaluateExpression(slab.rotation[2], variables) : 0;

      const localMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(posX, posY, posZ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ)),
        new THREE.Vector3(1, 1, 1),
      );
      const worldMatrix = new THREE.Matrix4().multiplyMatrices(currentMatrix, localMatrix);

      if (slab.dimensionLabels) {
        for (const lbl of slab.dimensionLabels) {
          const geom = getEdgeGeometry(lbl, L, D, T, variables);
          const worldMidpoint = new THREE.Vector3(...geom.midpoint).applyMatrix4(worldMatrix);
          const val = evaluateExpression(lbl.text, variables);
          const text = Number.isInteger(val) ? val.toString() : val.toFixed(1);
          result.push({ id: lbl.id, text, worldMidpoint });
        }
      }

      if (slab.children && slab.children.length > 0) {
        traverse(slab.children, worldMatrix);
      }
    }
  }

  traverse(components, new THREE.Matrix4());
  return result;
}

interface PlacedLabelBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function boxesOverlap(a: PlacedLabelBox, b: PlacedLabelBox, gap: number): boolean {
  return !(
    a.right + gap <= b.left ||
    a.left >= b.right + gap ||
    a.bottom + gap <= b.top ||
    a.top >= b.bottom + gap
  );
}

/**
 * Composites the rendered WebGL canvas with crisp 2D dimension label badges
 * matching DimensionLabel3D's HTML overlay appearance, nudging overlapping badges apart.
 */
function compositeSnapshotWithLabels(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  size: { width: number; height: number },
  components: SlabComponent[],
  variables: Record<string, number>,
): string {
  const srcCanvas = gl.domElement;
  if (typeof document === "undefined" || !srcCanvas.width || !srcCanvas.height) {
    return "";
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = srcCanvas.width;
  outCanvas.height = srcCanvas.height;
  const ctx = outCanvas.getContext("2d");
  if (!ctx) {
    return srcCanvas.toDataURL("image/png");
  }

  // Fill white background and draw WebGL canvas
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
  ctx.drawImage(srcCanvas, 0, 0);

  const labels = collectDimensionLabelsWorld(components, variables);
  if (labels.length === 0) {
    return outCanvas.toDataURL("image/png");
  }

  const dpr = size.width > 0 ? outCanvas.width / size.width : 1;
  const fontSize = Math.max(10, Math.round(11 * dpr));
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  camera.updateMatrixWorld(true);

  const placedBoxes: PlacedLabelBox[] = [];
  const gap = 3 * dpr;

  for (const lbl of labels) {
    const ndc = lbl.worldMidpoint.clone().project(camera);
    // Skip labels outside the visible camera frustum
    if (ndc.x < -1.02 || ndc.x > 1.02 || ndc.y < -1.02 || ndc.y > 1.02 || ndc.z < -1 || ndc.z > 1) {
      continue;
    }

    const rawX = (ndc.x * 0.5 + 0.5) * outCanvas.width;
    const rawY = (-ndc.y * 0.5 + 0.5) * outCanvas.height;

    const textWidth = ctx.measureText(lbl.text).width;
    const padX = 6 * dpr;
    const badgeWidth = textWidth + padX * 2;
    const badgeHeight = 16 * dpr;
    const radius = 3.5 * dpr;
    const edgePad = 3 * dpr;

    const minCx = badgeWidth / 2 + edgePad;
    const maxCx = Math.max(minCx, outCanvas.width - badgeWidth / 2 - edgePad);
    const minCy = badgeHeight / 2 + edgePad;
    const maxCy = Math.max(minCy, outCanvas.height - badgeHeight / 2 - edgePad);

    const cx = Math.max(minCx, Math.min(maxCx, rawX));
    const baseCy = Math.max(minCy, Math.min(maxCy, rawY));

    const makeBox = (yCenter: number): PlacedLabelBox => ({
      left: cx - badgeWidth / 2,
      right: cx + badgeWidth / 2,
      top: yCenter - badgeHeight / 2,
      bottom: yCenter + badgeHeight / 2,
    });

    let chosenCy = baseCy;
    let candidateBox = makeBox(chosenCy);

    if (placedBoxes.some((b) => boxesOverlap(candidateBox, b, gap))) {
      const step = badgeHeight + gap;
      for (let attempt = 1; attempt <= 6; attempt++) {
        const offsets = [-attempt * step, attempt * step];
        let foundFree = false;
        for (const dy of offsets) {
          const nextCy = Math.max(minCy, Math.min(maxCy, baseCy + dy));
          const nextBox = makeBox(nextCy);
          if (!placedBoxes.some((b) => boxesOverlap(nextBox, b, gap))) {
            chosenCy = nextCy;
            candidateBox = nextBox;
            foundFree = true;
            break;
          }
        }
        if (foundFree) break;
      }
    }

    placedBoxes.push(candidateBox);

    const bx = cx - badgeWidth / 2;
    const by = chosenCy - badgeHeight / 2;

    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(bx, by, badgeWidth, badgeHeight, radius);
    } else {
      ctx.rect(bx, by, badgeWidth, badgeHeight);
    }
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1 * dpr);
    ctx.strokeStyle = "#d1d5db";
    ctx.stroke();

    ctx.fillStyle = "#1e1b4b";
    ctx.fillText(lbl.text, cx, chosenCy + 0.5 * dpr);
    ctx.restore();
  }

  return outCanvas.toDataURL("image/png");
}

/**
 * Component running inside R3F <Canvas> that captures a clean frame
 * after camera fitting has positioned the camera and R3F renders.
 */
function SnapshotCapture({
  onSnapshot,
  components,
  variables,
  hasPresetCamera,
  viewKey,
}: {
  onSnapshot: (dataUrl: string) => void;
  components: SlabComponent[];
  variables: Record<string, number>;
  hasPresetCamera: boolean;
  viewKey: string;
}) {
  const { gl, scene, camera, size } = useThree();
  const capturedRef = useRef(false);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;
  const componentsRef = useRef(components);
  componentsRef.current = components;
  const variablesRef = useRef(variables);
  variablesRef.current = variables;

  useEffect(() => {
    capturedRef.current = false;
    let isMounted = true;
    let frameCount = 0;
    let animId: number;

    const doCapture = () => {
      try {
        const srcCanvas = gl.domElement;
        if (!srcCanvas || srcCanvas.width <= 0 || srcCanvas.height <= 0) {
          capturedRef.current = true;
          onSnapshotRef.current("");
          return;
        }
        const orthoCam = camera as THREE.OrthographicCamera;
        if (orthoCam.isOrthographicCamera && size.width > 0 && size.height > 0) {
          orthoCam.left = -size.width / 2;
          orthoCam.right = size.width / 2;
          orthoCam.top = size.height / 2;
          orthoCam.bottom = -size.height / 2;
          orthoCam.updateProjectionMatrix();
        }
        camera.updateMatrixWorld(true);
        gl.render(scene, camera);
        const dataUrl = compositeSnapshotWithLabels(
          gl,
          camera,
          size,
          componentsRef.current,
          variablesRef.current,
        );
        capturedRef.current = true;
        onSnapshotRef.current(dataUrl);
      } catch (err) {
        console.error("Snapshot capture failed:", err);
        capturedRef.current = true;
        onSnapshotRef.current("");
      }
    };

    const checkAndCapture = () => {
      if (!isMounted || capturedRef.current) return;

      if (!size.width || !size.height) {
        animId = requestAnimationFrame(checkAndCapture);
        return;
      }

      if (camera.userData.fittedSize !== `${size.width}x${size.height}`) {
        animId = requestAnimationFrame(checkAndCapture);
        return;
      }

      frameCount++;
      // Wait at least 3 animation frames for camera positioning and scene settle
      if (frameCount < 3) {
        animId = requestAnimationFrame(checkAndCapture);
        return;
      }

      doCapture();
    };

    // 80ms baseline timeout to allow layout and camera positioning effect to execute
    const timer = setTimeout(() => {
      animId = requestAnimationFrame(checkAndCapture);
    }, 80);

    // 2.5s safety timeout to ensure queue never hangs
    const safetyTimer = setTimeout(() => {
      if (isMounted && !capturedRef.current) {
        doCapture();
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearTimeout(safetyTimer);
      cancelAnimationFrame(animId);
    };
  }, [gl, scene, camera, size, hasPresetCamera, viewKey]);

  return null;
}

export const StoneForgeViewer = ({
  components,
  variables,
  printMode = false,
  fixedCameraView,
  focusTargetName,
  onSnapshot,
  onSnapshotReady,
}: StoneForgeViewerProps) => {
  const t = useTranslations("studio");
  const handleSnapshotCallback = onSnapshotReady || onSnapshot;
  const hasPresetCamera = Boolean(fixedCameraView && fixedCameraView.preset);
  const hasFocusTarget = Boolean(focusTargetName || fixedCameraView?.focusTargetId);
  const viewKey = `${fixedCameraView?.id ?? "single"}:${fixedCameraView?.preset ?? ""}:${fixedCameraView?.focusTargetId ?? focusTargetName ?? ""}`;

  // If no components exist, fire snapshot callback immediately so queue does not stall
  useEffect(() => {
    if ((!components || components.length === 0) && handleSnapshotCallback) {
      handleSnapshotCallback("");
    }
  }, [components, handleSnapshotCallback]);

  if (!components || components.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-50 text-gray-400 text-sm">
        {t("noComponentsToDisplay")}
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full relative ${printMode ? "bg-white" : "bg-gray-50"}`}
    >
      <Canvas
        orthographic
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        dpr={printMode ? 2 : [1, 2]}
      >
        <WebGLContextDisposer printMode={printMode} />
        <ambientLight intensity={1.6} />
        <directionalLight position={[100, 200, 150]} intensity={1.2} />
        <directionalLight position={[-100, 100, -100]} intensity={0.6} />

        {!printMode && (
          <React.Suspense fallback={null}>
            <Environment preset="city" />
          </React.Suspense>
        )}

        <Bounds
          fit={!hasFocusTarget && !hasPresetCamera}
          observe={!hasFocusTarget && !hasPresetCamera}
          margin={1.35}
          maxDuration={printMode ? 0 : 1}
        >
          {!hasPresetCamera && (
            <CameraController focusTargetName={focusTargetName} variables={variables} components={components} />
          )}
          {fixedCameraView && fixedCameraView.preset && (
            <PresetCameraFitter
              preset={fixedCameraView.preset}
              focusTargetId={fixedCameraView.focusTargetId}
              zoomMultiplier={fixedCameraView.zoomMultiplier}
              variables={variables}
              components={components}
            />
          )}
          {components.map((comp) => (
            <Slab3D
              key={comp.id}
              slab={comp}
              isSelected={false}
              onSelect={() => { }}
              selectedComponentId={null}
              onEdgeSelect={() => { }}
              selectedEdge={null}
              selectedDimensionLabelId={null}
              variables={variables}
              interactive={false}
              printMode={printMode}
            />
          ))}
        </Bounds>

        {printMode && handleSnapshotCallback && (
          <SnapshotCapture
            onSnapshot={handleSnapshotCallback}
            components={components}
            variables={variables}
            hasPresetCamera={hasPresetCamera}
            viewKey={viewKey}
          />
        )}

        {!printMode && (
          <OrbitControls
            makeDefault
            enableZoom={false} // Prevents mouse-wheel from zooming the camera
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 1.75}
            enabled={!printMode}
          />
        )}
      </Canvas>
    </div>
  );
};
