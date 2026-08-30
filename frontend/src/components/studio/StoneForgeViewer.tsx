"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Bounds, useBounds } from "@react-three/drei";
import * as THREE from "three";
import { SlabComponent, CameraView } from "@backend/common/schemas/studio";
import { evaluateExpression } from "../../lib/evaluator";
import { Slab3D } from "./Slab3D";
import { useTranslations } from "next-intl";

interface StoneForgeViewerProps {
  components: SlabComponent[];
  variables: Record<string, number>;
  printMode?: boolean;
  fixedCameraView?: CameraView;
  focusTargetName?: string;
}

const CameraController = ({ focusTargetName, variables, components }: { focusTargetName?: string, variables: any, components: any }) => {
  const bounds = useBounds();
  const { scene } = useThree();

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
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [bounds, scene, focusTargetName, variables, components]);

  return null;
};

import { getEdgeGeometry } from "./DimensionLabel3D";

/**
 * Mathematically computes all 3D world-space points for all slabs and dimension labels
 * in the assembly, taking into account nested hierarchies, positions, rotations, and variables.
 */
function collectAssemblyPoints(
  components: SlabComponent[],
  variables: Record<string, number>,
  focusTargetId?: string,
): { points: THREE.Vector3[]; center: THREE.Vector3; maxDim: number } {
  const allPoints: THREE.Vector3[] = [];
  let focusPoints: THREE.Vector3[] = [];
  let focusCenter: THREE.Vector3 | null = null;

  function traverse(
    comps: SlabComponent[],
    currentMatrix: THREE.Matrix4,
    parentSlabPoints?: THREE.Vector3[],
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
          const rawPts = [
            new THREE.Vector3(...geom.lineStart),
            new THREE.Vector3(...geom.lineEnd),
            new THREE.Vector3(...geom.extensionA[0]),
            new THREE.Vector3(...geom.extensionA[1]),
            new THREE.Vector3(...geom.extensionB[0]),
            new THREE.Vector3(...geom.extensionB[1]),
            // Padding around midpoint for HTML text badge (in all directions)
            new THREE.Vector3(geom.midpoint[0] - 25, geom.midpoint[1] - 25, geom.midpoint[2] - 25),
            new THREE.Vector3(geom.midpoint[0] + 25, geom.midpoint[1] + 25, geom.midpoint[2] + 25),
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
        traverse(slab.children, worldMatrix, currentSlabPoints);
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

  const center = focusCenter || worldBox.getCenter(new THREE.Vector3());
  const boxSize = worldBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z, 100);

  return { points: targetPoints, center, maxDim };
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;

    const attemptFit = () => {
      if (!isMounted) return;
      if (!size.width || !size.height) {
        timeoutRef.current = setTimeout(attemptFit, 50);
        return;
      }

      if (!components || components.length === 0) return;

      const { points, center, maxDim } = collectAssemblyPoints(components, variables, focusTargetId);

      // 1. Initial camera positioning based on preset orientation
      const camDistance = Math.max(maxDim * 4, 200);

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

      if (controls) {
        (controls as any).target.copy(finalCenter);
        (controls as any).update();
      }

      // 4. Compute exact 2D bounding dimensions
      let boundingWidth = maxCamX - minCamX;
      let boundingHeight = maxCamY - minCamY;

      boundingWidth = Math.max(boundingWidth, 5);
      boundingHeight = Math.max(boundingHeight, 5);

      // Detail views tightly frame the focused dimension (1.30), while overview views have clean margin (1.65)
      const margin = focusTargetId ? 1.30 : 1.65;
      const safeMultiplier = zoomMultiplier && zoomMultiplier > 0 ? zoomMultiplier : 1;

      const orthoCam = camera as THREE.OrthographicCamera;
      if (orthoCam.isOrthographicCamera) {
        const frustumWidth =
          orthoCam.right !== undefined &&
          orthoCam.left !== undefined &&
          orthoCam.right !== orthoCam.left
            ? orthoCam.right - orthoCam.left
            : size.width;
        const frustumHeight =
          orthoCam.top !== undefined &&
          orthoCam.bottom !== undefined &&
          orthoCam.top !== orthoCam.bottom
            ? orthoCam.top - orthoCam.bottom
            : size.height;

        const zoomX = frustumWidth / boundingWidth;
        const zoomY = frustumHeight / boundingHeight;
        const baseFitZoom = Math.min(zoomX, zoomY) / margin;

        orthoCam.zoom = baseFitZoom * safeMultiplier;
        orthoCam.near = 0.1;
        orthoCam.far = camDistance * 10;
        orthoCam.updateProjectionMatrix();
      } else if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspCam = camera as THREE.PerspectiveCamera;
        const fovRad = THREE.MathUtils.degToRad(perspCam.fov);
        const visibleHeight = 2 * Math.tan(fovRad / 2) * camDistance;
        const visibleWidth = visibleHeight * (size.width / (size.height || 1));

        const zoomX = visibleWidth / boundingWidth;
        const zoomY = visibleHeight / boundingHeight;
        const baseFitZoom = Math.min(zoomX, zoomY) / margin;

        perspCam.zoom = baseFitZoom * safeMultiplier;
        perspCam.near = 0.1;
        perspCam.far = camDistance * 10;
        perspCam.updateProjectionMatrix();
      }
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

const calculateMinY = (
  components: SlabComponent[],
  variables: Record<string, number>,
  currentY = 0,
): number => {
  let minY = currentY;
  for (const comp of components) {
    const posY = evaluateExpression(comp.position[1], variables);
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

export const StoneForgeViewer = ({
  components,
  variables,
  printMode = false,
  fixedCameraView,
  focusTargetName,
}: StoneForgeViewerProps) => {
  const t = useTranslations("studio");
  const minY = useMemo(() => {
    return calculateMinY(components, variables);
  }, [components, variables]);

  const hasFocusTarget = Boolean(focusTargetName || fixedCameraView?.focusTargetId);

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
        dpr={printMode ? [2, 4] : [1, 2]}
      >
        <React.Suspense fallback={null}>
          <Environment preset="city" />
          <Bounds fit={!hasFocusTarget && !fixedCameraView} observe={!hasFocusTarget && !fixedCameraView} margin={1.35}>
            {!fixedCameraView && (
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
              />
            ))}
          </Bounds>
        </React.Suspense>

        <OrbitControls
          makeDefault
          enableZoom={false} // Prevents mouse-wheel from zooming the camera
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 1.75}
          enabled={!printMode}
        />
      </Canvas>
    </div>
  );
};
