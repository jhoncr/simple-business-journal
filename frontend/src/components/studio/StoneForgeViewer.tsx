'use client';

import React, { useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { SlabComponent } from "@backend/common/schemas/studio";
import { evaluateExpression } from '../../lib/evaluator';
import { Slab3D } from './Slab3D';

interface StoneForgeViewerProps {
  components: SlabComponent[];
  variables: Record<string, number>;
  printMode?: boolean;
}

const CameraFramer = () => {
  const { camera, scene } = useThree();

  useEffect(() => {
    // Wait a brief moment to ensure all meshes are created
    const timeout = setTimeout(() => {
      const boundingBox = new THREE.Box3().setFromObject(scene);
      if (boundingBox.isEmpty()) return;

      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);

      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5; // Add a little padding so it's not right on the edge

      // Position the camera slightly elevated and angled
      camera.position.set(center.x, center.y + (maxDim * 0.5), center.z + cameraZ);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
    }, 100);

    return () => clearTimeout(timeout);
  }, [camera, scene]);

  return null;
};

const calculateMinY = (components: SlabComponent[], variables: Record<string, number>, currentY = 0): number => {
  let minY = currentY;
  for (const comp of components) {
    const posY = evaluateExpression(comp.position[1], variables);
    const compMinY = currentY + posY;
    if (compMinY < minY) minY = compMinY;

    if (comp.children && comp.children.length > 0) {
      const childrenMinY = calculateMinY(comp.children, variables, currentY + posY);
      if (childrenMinY < minY) minY = childrenMinY;
    }
  }
  return minY;
};

export const StoneForgeViewer = ({ components, variables, printMode = false }: StoneForgeViewerProps) => {
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
    <div className={`w-full h-full relative ${printMode ? 'bg-white' : 'bg-gray-50'}`}>
      <Canvas camera={{ position: [150, 150, 200], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={[printMode ? '#ffffff' : '#f9fafb']} />
        {printMode && <CameraFramer />}
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 200, 100]} intensity={1} castShadow />

        <React.Suspense fallback={null}>
          <Environment preset="city" />
          <group position={[-100, 0, 50]}>
            {components.map(comp => (
              <Slab3D
                key={comp.id}
                slab={comp}
                isSelected={false}
                onSelect={() => {}}
                selectedComponentId={null}
                onEdgeSelect={() => {}}
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
        </React.Suspense>

        <OrbitControls makeDefault minDistance={10} maxDistance={1000} enabled={!printMode} />
      </Canvas>
    </div>
  );
};
