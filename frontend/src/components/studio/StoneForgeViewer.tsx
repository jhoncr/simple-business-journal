"use client";

import React, { useMemo, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Bounds, useBounds } from "@react-three/drei";
import * as THREE from "three";
import { SlabComponent, CameraView } from "@backend/common/schemas/studio";
import { evaluateExpression } from "../../lib/evaluator";
import { Slab3D } from "./Slab3D";

interface StoneForgeViewerProps {
  components: SlabComponent[];
  variables: Record<string, number>;
  printMode?: boolean;
  fixedCameraView?: CameraView;
}

export const PresetCameraFitter = ({ preset, focusTargetId, zoomMultiplier = 1, forceRenderRefreshCount = 0 }: { preset: string, focusTargetId?: string, zoomMultiplier?: number, forceRenderRefreshCount?: number }) => {
  const bounds = useBounds();
  const { scene, camera, controls, size } = useThree();

  useEffect(() => {
    let attempts = 0;

    const attemptFit = () => {
      let targetObject = scene;

      // If we have a specific target, recursively try to fetch it to ensure R3F has mounted the graph
      if (focusTargetId) {
        const found = scene.getObjectByName(focusTargetId);
        if (found) {
          targetObject = found as any;
        } else {
          attempts++;
          if (attempts < 20) {
            setTimeout(attemptFit, 300);
            return;
          }
          console.warn(`[PresetCameraFitter] Could not find focusTargetId: ${focusTargetId}`);
        }
      }

      bounds.refresh(targetObject).clip().fit();

      const size = bounds.getSize();
      const center = size.center;

      // Default upward axis
      camera.up.set(0, 1, 0);

      // We explicitly override 'up' vector for direct-overhead shots to prevent Gimbal Lock
      if (preset === 'top') {
        camera.position.set(center.x, center.y + 100, center.z);
        camera.up.set(0, 0, -1);
      } else if (preset === 'bottom') {
        camera.position.set(center.x, center.y - 100, center.z);
        camera.up.set(0, 0, 1);
      } else if (preset === 'front') {
        camera.position.set(center.x, center.y, center.z + 100);
      } else if (preset === 'back') {
        camera.position.set(center.x, center.y, center.z - 100);
      } else if (preset === 'right') {
        camera.position.set(center.x + 100, center.y, center.z);
      } else if (preset === 'left') {
        camera.position.set(center.x - 100, center.y, center.z);
      } else if (preset === 'isometric' || preset === 'iso-tfr') {
        camera.position.set(center.x + 100, center.y + 100, center.z + 100);
      } else if (preset === 'iso-tfl') {
        camera.position.set(center.x - 100, center.y + 100, center.z + 100);
      } else if (preset === 'iso-tbr') {
        camera.position.set(center.x + 100, center.y + 100, center.z - 100);
      } else if (preset === 'iso-tbl') {
        camera.position.set(center.x - 100, center.y + 100, center.z - 100);
      } else if (preset === 'iso-bfr') {
        camera.position.set(center.x + 100, center.y - 100, center.z + 100);
      } else if (preset === 'iso-bfl') {
        camera.position.set(center.x - 100, center.y - 100, center.z + 100);
      } else if (preset === 'iso-bbr') {
        camera.position.set(center.x + 100, center.y - 100, center.z - 100);
      } else if (preset === 'iso-bbl') {
        camera.position.set(center.x - 100, center.y - 100, center.z - 100);
      }

      camera.lookAt(center);
      if (controls) {
        (controls as any).target.copy(center);
        (controls as any).update();
      }

      bounds.refresh(targetObject).clip().fit();
      
      let finalZoomMult = zoomMultiplier;
      if (preset.startsWith('iso') && !focusTargetId) {
        finalZoomMult *= 1.35; // Compensate for oversized isometric bounding spheres
      }

      if (finalZoomMult !== 1) {
        camera.zoom *= finalZoomMult;
        camera.updateProjectionMatrix();
      }
    };

    attemptFit();
  }, [preset, focusTargetId, zoomMultiplier, bounds, scene, camera, controls, forceRenderRefreshCount, size.width, size.height]);

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
}: StoneForgeViewerProps) => {
  const minY = useMemo(() => {
    return calculateMinY(components, variables);
  }, [components, variables]);

  if (!components || components.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-50 text-gray-400 text-sm">
        No components to display.
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full relative ${printMode ? "bg-white" : "bg-gray-50"}`}
    >
      <Canvas
        orthographic
      // camera={{ position: [200, 200, 200], zoom: 2 }}
      // gl={{ preserveDrawingBuffer: true }}
      >
        {/* <color attach="background" args={[printMode ? "#ffffff" : "#f9fafb"]} /> */}
        {/* <ambientLight intensity={0.5} /> */}
        {/* <directionalLight position={[100, 200, 100]} intensity={1} castShadow /> */}

        <React.Suspense fallback={null}>
          <Environment preset="warehouse" />
          <Bounds clip observe>
            {fixedCameraView && fixedCameraView.preset && (
              <PresetCameraFitter
                preset={fixedCameraView.preset}
                focusTargetId={fixedCameraView.focusTargetId}
                zoomMultiplier={fixedCameraView.zoomMultiplier}
              />
            )}
            {/* <group position={[-100, 0, 50]}> */}
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
            {/* {!printMode && (
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
              )} */}
            {/* </group> */}
          </Bounds>
        </React.Suspense>

        <OrbitControls
          makeDefault
          minDistance={10}
          maxDistance={1000}
          enabled={!printMode}
        />
      </Canvas>
    </div>
  );
};
