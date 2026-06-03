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

  const extrudeGeometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [shape, extrudeSettings]);

  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(extrudeGeometry);
  }, [extrudeGeometry]);

  const polishedMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({ color: "#f59e0b" });
  }, []);

  const isThicknessT = T <= L && T <= D;
  const isThicknessD = D < L && D < T;
  const isThicknessL = L < D && L < T;

  const polishedGeometryX = useMemo(() => {
    if (isThicknessL) {
      return new THREE.BoxGeometry(0.3, T, 0.3);
    }
    return new THREE.BoxGeometry(L, 0.3, 0.3);
  }, [L, T, isThicknessL]);

  const polishedGeometryZ = useMemo(() => {
    if (isThicknessD) {
      return new THREE.BoxGeometry(0.3, T, 0.3);
    }
    return new THREE.BoxGeometry(0.3, 0.3, D);
  }, [D, T, isThicknessD]);

  React.useEffect(() => {
    return () => {
      extrudeGeometry.dispose();
    };
  }, [extrudeGeometry]);

  React.useEffect(() => {
    return () => {
      edgesGeometry.dispose();
    };
  }, [edgesGeometry]);

  React.useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  React.useEffect(() => {
    return () => {
      edgeMaterial.dispose();
    };
  }, [edgeMaterial]);

  React.useEffect(() => {
    return () => {
      polishedMaterial.dispose();
    };
  }, [polishedMaterial]);

  React.useEffect(() => {
    return () => {
      polishedGeometryX.dispose();
    };
  }, [polishedGeometryX]);

  React.useEffect(() => {
    return () => {
      polishedGeometryZ.dispose();
    };
  }, [polishedGeometryZ]);

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
        <mesh geometry={extrudeGeometry} material={material} />
        <lineSegments geometry={edgesGeometry} material={edgeMaterial} />
      </group>

      {/* Edge Hitboxes */}
      {(() => {
        const marginX = Math.min(4, L / 4);
        const marginZ = Math.min(4, D / 4);
        const hitSize = 3; // Compact, easy-to-click size

        if (isThicknessD) {
          // Case B: D is the 2cm thickness (X-aligned vertical backsplash)
          const hitD = Math.max(0.5, D / 2);
          const hitboxWidth = Math.max(1, L - 2 * marginX);
          const hitboxDepthZ = Math.max(1, D);
          return (
            <>
              <EdgeHitbox
                position={[L / 2, T + hitSize / 2, -D / 4]}
                args={[hitboxWidth, hitSize, hitD]}
                edgeName="top-front"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-front'}
              />
              <EdgeHitbox
                position={[L / 2, T + hitSize / 2, -D + D / 4]}
                args={[hitboxWidth, hitSize, hitD]}
                edgeName="top-back"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-back'}
              />
              <EdgeHitbox
                position={[-hitSize / 2, T / 2, -D / 2]}
                args={[hitSize, T, hitboxDepthZ]}
                edgeName="top-left"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-left'}
              />
              <EdgeHitbox
                position={[L + hitSize / 2, T / 2, -D / 2]}
                args={[hitSize, T, hitboxDepthZ]}
                edgeName="top-right"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-right'}
              />
            </>
          );
        } else if (isThicknessL) {
          // Case C: L is the 2cm thickness (Z-aligned vertical waterfall)
          const hitL = Math.max(0.5, L / 2);
          const hitboxDepth = Math.max(1, D - 2 * marginZ);
          const hitboxWidthX = Math.max(1, L);
          return (
            <>
              <EdgeHitbox
                position={[L / 4, T + hitSize / 2, -D / 2]}
                args={[hitL, hitSize, hitboxDepth]}
                edgeName="top-left"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-left'}
              />
              <EdgeHitbox
                position={[L - L / 4, T + hitSize / 2, -D / 2]}
                args={[hitL, hitSize, hitboxDepth]}
                edgeName="top-right"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-right'}
              />
              <EdgeHitbox
                position={[L / 2, T / 2, hitSize / 2]}
                args={[hitboxWidthX, T, hitSize]}
                edgeName="top-front"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-front'}
              />
              <EdgeHitbox
                position={[L / 2, T / 2, -D - hitSize / 2]}
                args={[hitboxWidthX, T, hitSize]}
                edgeName="top-back"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-back'}
              />
            </>
          );
        } else {
          // Case A: Horizontal slab (T is thickness)
          const hitboxWidth = Math.max(1, L - 2 * marginX);
          const hitboxDepth = Math.max(1, D - 2 * marginZ);
          return (
            <>
              <EdgeHitbox
                position={[L / 2, T + 0.5, 0.5]}
                args={[hitboxWidth, hitSize, hitSize]}
                edgeName="top-front"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-front'}
              />
              <EdgeHitbox
                position={[L / 2, T + 0.5, -D - 0.5]}
                args={[hitboxWidth, hitSize, hitSize]}
                edgeName="top-back"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-back'}
              />
              <EdgeHitbox
                position={[-0.5, T + 0.5, -D / 2]}
                args={[hitSize, hitSize, hitboxDepth]}
                edgeName="top-left"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-left'}
              />
              <EdgeHitbox
                position={[L + 0.5, T + 0.5, -D / 2]}
                args={[hitSize, hitSize, hitboxDepth]}
                edgeName="top-right"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'top-right'}
              />
            </>
          );
        }
      })()}

      {/* Polished Edge Visual Highlights */}
      {slab.polishedEdges?.includes('front') && (
        <mesh position={isThicknessL ? [L / 2, T / 2, 0] : [L / 2, T, 0]} geometry={polishedGeometryX} material={polishedMaterial} />
      )}
      {slab.polishedEdges?.includes('back') && (
        <mesh position={isThicknessL ? [L / 2, T / 2, -D] : [L / 2, T, -D]} geometry={polishedGeometryX} material={polishedMaterial} />
      )}
      {slab.polishedEdges?.includes('left') && (
        <mesh position={isThicknessD ? [0, T / 2, -D / 2] : [0, T, -D / 2]} geometry={polishedGeometryZ} material={polishedMaterial} />
      )}
      {slab.polishedEdges?.includes('right') && (
        <mesh position={isThicknessD ? [L, T / 2, -D / 2] : [L, T, -D / 2]} geometry={polishedGeometryZ} material={polishedMaterial} />
      )}

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