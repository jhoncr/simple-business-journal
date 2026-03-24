"use client";

import React, { useMemo, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Bounds } from "@react-three/drei";
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

const FixedCameraSetup = ({ fixedView }: { fixedView: CameraView }) => {
  const { camera, controls, size } = useThree();

  useEffect(() => {
    if (fixedView) {
      camera.position.set(fixedView.position[0], fixedView.position[1], fixedView.position[2]);
      
      let finalZoom = fixedView.zoom || 1;
      if (fixedView.cropBox) {
        const { width, height } = fixedView.cropBox;
        if (width > 0 && height > 0) {
          finalZoom = Math.min(size.width / width, size.height / height);
        }
      }
      camera.zoom = finalZoom;

      const oCam = camera as THREE.OrthographicCamera;
      if (oCam.isOrthographicCamera) {
        oCam.clearViewOffset();
      }
      
      camera.updateProjectionMatrix();

      if (controls && (controls as any).target) {
        (controls as any).target.set(fixedView.target[0], fixedView.target[1], fixedView.target[2]);
        (controls as any).update();
      }
    }
  }, [camera, controls, fixedView, size]);

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
        camera={{ position: [200, 200, 200], zoom: 2 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[printMode ? "#ffffff" : "#f9fafb"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 200, 100]} intensity={1} castShadow />

        <React.Suspense fallback={null}>
          <Environment preset="city" />
          {fixedCameraView ? (
            <>
              <FixedCameraSetup fixedView={fixedCameraView} />
              <group position={[-100, 0, 50]}>
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
                {!printMode && (
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
                )}
              </group>
            </>
          ) : (
            <Bounds fit clip observe margin={1.2}>
              <group position={[-100, 0, 50]}>
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
                {!printMode && (
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
                )}
              </group>
            </Bounds>
          )}
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
