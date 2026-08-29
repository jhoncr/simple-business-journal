"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Bounds, useBounds, Center } from "@react-three/drei";
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

export const PresetCameraFitter = ({
  preset,
  focusTargetId,
  zoomMultiplier = 1,
  forceRenderRefreshCount = 0,
}: {
  preset: string;
  focusTargetId?: string;
  zoomMultiplier?: number;
  forceRenderRefreshCount?: number;
}) => {
  const { scene, camera, controls, size } = useThree();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    let attempts = 0;

    const attemptFit = () => {
      if (!isMounted) return;
      let targetObject: THREE.Object3D | null = scene;

      // If we have a specific target, recursively try to fetch it to ensure R3F has mounted the graph
      if (focusTargetId) {
        const found = scene.getObjectByName(focusTargetId);
        if (found) {
          targetObject = found;
        } else {
          attempts++;
          if (attempts < 20) {
            timeoutRef.current = setTimeout(attemptFit, 150);
            return;
          }
          console.warn(`[PresetCameraFitter] Could not find focusTargetId: ${focusTargetId}`);
          targetObject = scene;
        }
      }

      if (!targetObject) return;

      // Ensure transforms are updated
      targetObject.updateWorldMatrix(true, true);
      const box = new THREE.Box3();
      box.setFromObject(targetObject);

      if (box.isEmpty()) {
        const defaultDim = 100;
        box.setFromCenterAndSize(
          new THREE.Vector3(),
          new THREE.Vector3(defaultDim, defaultDim, defaultDim),
        );
      }

      const center = box.getCenter(new THREE.Vector3());
      const boxSize = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z) || 100;
      const camDistance = Math.max(maxDim * 4, 200);

      // Default upward axis
      camera.up.set(0, 1, 0);

      // Explicitly set camera orientation based on preset
      if (preset === "top") {
        camera.position.set(center.x, center.y + camDistance, center.z);
        camera.up.set(0, 0, -1);
      } else if (preset === "bottom") {
        camera.position.set(center.x, center.y - camDistance, center.z);
        camera.up.set(0, 0, 1);
      } else if (preset === "front") {
        camera.position.set(center.x, center.y, center.z + camDistance);
      } else if (preset === "back") {
        camera.position.set(center.x, center.y, center.z - camDistance);
      } else if (preset === "right") {
        camera.position.set(center.x + camDistance, center.y, center.z);
      } else if (preset === "left") {
        camera.position.set(center.x - camDistance, center.y, center.z);
      } else if (preset === "isometric" || preset === "iso-tfr") {
        camera.position.set(center.x + camDistance, center.y + camDistance, center.z + camDistance);
      } else if (preset === "iso-tfl") {
        camera.position.set(center.x - camDistance, center.y + camDistance, center.z + camDistance);
      } else if (preset === "iso-tbr") {
        camera.position.set(center.x + camDistance, center.y + camDistance, center.z - camDistance);
      } else if (preset === "iso-tbl") {
        camera.position.set(center.x - camDistance, center.y + camDistance, center.z - camDistance);
      } else if (preset === "iso-bfr") {
        camera.position.set(center.x + camDistance, center.y - camDistance, center.z + camDistance);
      } else if (preset === "iso-bfl") {
        camera.position.set(center.x - camDistance, center.y - camDistance, center.z + camDistance);
      } else if (preset === "iso-bbr") {
        camera.position.set(center.x + camDistance, center.y - camDistance, center.z - camDistance);
      } else if (preset === "iso-bbl") {
        camera.position.set(center.x - camDistance, center.y - camDistance, center.z - camDistance);
      }

      camera.lookAt(center);
      camera.updateMatrixWorld(true);

      if (controls) {
        (controls as any).target.copy(center);
        (controls as any).update();
      }

      // Compute exact orthographic projection fit zoom from box corners projected into camera space
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ];

      let maxAbsX = 0;
      let maxAbsY = 0;
      for (const corner of corners) {
        corner.applyMatrix4(camera.matrixWorldInverse);
        maxAbsX = Math.max(maxAbsX, Math.abs(corner.x));
        maxAbsY = Math.max(maxAbsY, Math.abs(corner.y));
      }

      const boundingWidth = maxAbsX * 2;
      const boundingHeight = maxAbsY * 2;

      const orthoCam = camera as THREE.OrthographicCamera;
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

      const margin = 1.15;
      const zoomX = boundingWidth > 0 ? frustumWidth / boundingWidth : 1;
      const zoomY = boundingHeight > 0 ? frustumHeight / boundingHeight : 1;
      const baseFitZoom = Math.min(zoomX, zoomY) / margin;

      let finalZoomMult = zoomMultiplier;
      if (preset.startsWith("iso") && !focusTargetId) {
        finalZoomMult *= 1.25;
      }

      orthoCam.zoom = baseFitZoom * finalZoomMult;
      orthoCam.near = 0.1;
      orthoCam.far = camDistance * 10;
      orthoCam.updateProjectionMatrix();
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
    scene,
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
          <Bounds fit={!hasFocusTarget && !fixedCameraView} observe={!hasFocusTarget && !fixedCameraView} margin={1.05}>
            {!fixedCameraView && (
              <CameraController focusTargetName={focusTargetName} variables={variables} components={components} />
            )}
            {fixedCameraView && fixedCameraView.preset && (
              <PresetCameraFitter
                preset={fixedCameraView.preset}
                focusTargetId={fixedCameraView.focusTargetId}
                zoomMultiplier={fixedCameraView.zoomMultiplier}
              />
            )}
            <Center>
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
            </Center>
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
