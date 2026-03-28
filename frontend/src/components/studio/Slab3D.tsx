'use client';

import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { SlabComponent } from '@backend/common/schemas/studio';
import { evaluateExpression } from '../../lib/evaluator';
import { DimensionLabel3D } from './DimensionLabel3D';

interface Slab3DProps {
  slab: SlabComponent;
  isSelected: boolean;
  onSelect: (id: string) => void;
  selectedComponentId: string | null;
  onEdgeSelect: (id: string, edge: string) => void;
  selectedEdge: { slabId: string, edge: string } | null;
  variables: Record<string, number>;
  selectedDimensionLabelId?: string | null;
}

const EdgeHitbox = ({ position, args, edgeName, slabId, onEdgeSelect, isSelected }: any) => {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { setHovered(false); }}
      onClick={(e) => { e.stopPropagation(); onEdgeSelect(slabId, edgeName); }}
    >
      <boxGeometry args={args} />
      <meshBasicMaterial color={isSelected ? "#f59e0b" : "#3b82f6"} transparent opacity={hovered || isSelected ? 0.5 : 0} depthWrite={false} />
    </mesh>
  );
};

export const Slab3D: React.FC<Slab3DProps> = ({ slab, isSelected, onSelect, selectedComponentId, onEdgeSelect, selectedEdge, variables, selectedDimensionLabelId }) => {
  const L = evaluateExpression(slab.length, variables);
  const D = evaluateExpression(slab.depth, variables);
  const T = evaluateExpression(slab.thickness, variables);

  const posX = evaluateExpression(slab.position[0], variables);
  const posY = evaluateExpression(slab.position[1], variables);
  const posZ = evaluateExpression(slab.position[2], variables);

  const rotX = slab.rotation ? evaluateExpression(slab.rotation[0], variables) : 0;
  const rotY = slab.rotation ? evaluateExpression(slab.rotation[1], variables) : 0;
  const rotZ = slab.rotation ? evaluateExpression(slab.rotation[2], variables) : 0;

  // Generate the 2D shape for the slab
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    
    // Base rectangle
    s.moveTo(0, 0);
    s.lineTo(L, 0);
    s.lineTo(L, D);
    s.lineTo(0, D);
    s.lineTo(0, 0);

    // Add holes for cutouts
    slab.cutouts.forEach((cutout) => {
      const hole = new THREE.Path();
      const cw = evaluateExpression(cutout.width, variables);
      const cd = evaluateExpression(cutout.depth, variables);
      const cx = evaluateExpression(cutout.centerX, variables);
      const cy = evaluateExpression(cutout.centerY, variables);

      if (cutout.shape === 'rectangular') {
        const hw = cw / 2;
        const hd = cd / 2;
        hole.moveTo(cx - hw, cy - hd);
        hole.lineTo(cx + hw, cy - hd);
        hole.lineTo(cx + hw, cy + hd);
        hole.lineTo(cx - hw, cy + hd);
        hole.lineTo(cx - hw, cy - hd);
      } else if (cutout.shape === 'circular') {
        hole.absarc(cx, cy, cw / 2, 0, Math.PI * 2, false);
      } else if (cutout.shape === 'oval') {
        hole.absellipse(cx, cy, cw / 2, cd / 2, 0, Math.PI * 2, false, 0);
      }
      s.holes.push(hole);
    });

    return s;
  }, [L, D, slab.cutouts, variables]);

  const extrudeSettings = useMemo(() => ({
    depth: T,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.1,
    bevelThickness: 0.1,
  }), [T]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({ 
      color: isSelected ? '#a5b4fc' : '#e5e7eb',
      roughness: 0.4,
      metalness: 0.1,
    });
  }, [isSelected]);

  const edgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({ 
      color: isSelected ? '#4f46e5' : '#9ca3af',
      linewidth: 1 
    });
  }, [isSelected]);

  const hitT = 4; // Hitbox thickness

  return (
    <group 
      position={[posX, posY, posZ]} 
      rotation={[rotX, rotY, rotZ]} 
      name={slab.id}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(slab.id);
      }}
    >
      {/* Main Slab */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh material={material}>
          <extrudeGeometry args={[shape, extrudeSettings]} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new THREE.ExtrudeGeometry(shape, extrudeSettings)]} />
          <primitive object={edgeMaterial} attach="material" />
        </lineSegments>
      </group>

      {/* Edge Hitboxes */}
      {/* Top Edges */}
      <EdgeHitbox
        position={[L / 2, T, 0]}
        args={[L, hitT, hitT]}
        edgeName="top-front"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-front'}
      />
      <EdgeHitbox
        position={[L / 2, T, -D]}
        args={[L, hitT, hitT]}
        edgeName="top-back"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-back'}
      />
      <EdgeHitbox
        position={[0, T, -D / 2]}
        args={[hitT, hitT, D]}
        edgeName="top-left"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-left'}
      />
      <EdgeHitbox
        position={[L, T, -D / 2]}
        args={[hitT, hitT, D]}
        edgeName="top-right"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-right'}
      />

      {/* Bottom Edges */}
      <EdgeHitbox
        position={[L / 2, 0, 0]}
        args={[L, hitT, hitT]}
        edgeName="bottom-front"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'bottom-front'}
      />
      <EdgeHitbox
        position={[L / 2, 0, -D]}
        args={[L, hitT, hitT]}
        edgeName="bottom-back"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'bottom-back'}
      />
      <EdgeHitbox
        position={[0, 0, -D / 2]}
        args={[hitT, hitT, D]}
        edgeName="bottom-left"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'bottom-left'}
      />
      <EdgeHitbox
        position={[L, 0, -D / 2]}
        args={[hitT, hitT, D]}
        edgeName="bottom-right"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'bottom-right'}
      />

      {/* Vertical Edges */}
      <EdgeHitbox
        position={[0, T / 2, 0]}
        args={[hitT, T, hitT]}
        edgeName="front-left"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'front-left'}
      />
      <EdgeHitbox
        position={[L, T / 2, 0]}
        args={[hitT, T, hitT]}
        edgeName="front-right"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'front-right'}
      />
      <EdgeHitbox
        position={[0, T / 2, -D]}
        args={[hitT, T, hitT]}
        edgeName="back-left"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'back-left'}
      />
      <EdgeHitbox
        position={[L, T / 2, -D]}
        args={[hitT, T, hitT]}
        edgeName="back-right"
        slabId={slab.id}
        onEdgeSelect={onEdgeSelect}
        isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'back-right'}
      />

      {/* Dimension Labels */}
      {slab.dimensionLabels?.map(label => (
        <DimensionLabel3D
          key={label.id}
          label={label}
          parentLength={L}
          parentDepth={D}
          parentThickness={T}
          variables={variables}
          isSelected={selectedDimensionLabelId === label.id}
          onSelect={onSelect}
        />
      ))}

      {/* Children */}
      {slab.children?.map(child => (
        <Slab3D 
          key={child.id} 
          slab={child} 
          isSelected={selectedComponentId === child.id}
          onSelect={onSelect}
          selectedComponentId={selectedComponentId}
          onEdgeSelect={onEdgeSelect}
          selectedEdge={selectedEdge}
          variables={variables}
          selectedDimensionLabelId={selectedDimensionLabelId}
        />
      ))}
    </group>
  );
};