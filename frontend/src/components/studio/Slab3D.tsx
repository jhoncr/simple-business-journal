'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { SlabComponent } from '@backend/common/schemas/studio';
import { evaluateExpression } from '@/lib/evaluator';
import { DimensionLabel3D } from './DimensionLabel3D';

interface Slab3DProps {
  slab: SlabComponent;
  isSelected: boolean;
  onSelect: (id: string) => void;
  selectedComponentId: string | null;
  onEdgeSelect: (id: string, edge: string) => void;
  selectedEdge: { slabId: string; edge: string } | null;
  variables: Record<string, number>;
  selectedDimensionLabelId?: string | null;
  interactive?: boolean;
  printMode?: boolean;
}

interface EdgeHitboxProps {
  position: [number, number, number];
  args: [number, number, number];
  edgeName: string;
  slabId: string;
  onEdgeSelect: (slabId: string, edgeName: string) => void;
  isSelected: boolean;
}

const EdgeHitbox = ({ position, args, edgeName, slabId, onEdgeSelect, isSelected }: EdgeHitboxProps) => {
  const [hovered, setHovered] = useState(false);
  const [w, h, d] = args;

  const geometry = useMemo(() => new THREE.BoxGeometry(w, h, d), [w, h, d]);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#3b82f6',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    material.color.set(isSelected ? '#f59e0b' : '#3b82f6');
    material.opacity = hovered || isSelected ? 0.5 : 0;
  }, [material, isSelected, hovered]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh
      position={position}
      geometry={geometry}
      material={material}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => { setHovered(false); }}
      onClick={(e) => { e.stopPropagation(); onEdgeSelect(slabId, edgeName); }}
    />
  );
};

export const Slab3D: React.FC<Slab3DProps> = ({
  slab,
  isSelected,
  onSelect,
  selectedComponentId,
  onEdgeSelect,
  selectedEdge,
  variables,
  selectedDimensionLabelId,
  interactive = true,
  printMode = false,
}) => {
  const L = evaluateExpression(slab.length, variables);
  const D = evaluateExpression(slab.depth, variables);
  const T = evaluateExpression(slab.thickness, variables);

  const hasValidDims =
    Number.isFinite(L) &&
    Number.isFinite(D) &&
    Number.isFinite(T) &&
    L > 0 &&
    D > 0 &&
    T > 0;

  const posX = evaluateExpression(slab.position[0], variables);
  const posY = evaluateExpression(slab.position[1], variables);
  const posZ = evaluateExpression(slab.position[2], variables);

  const rotX = slab.rotation ? evaluateExpression(slab.rotation[0], variables) : 0;
  const rotY = slab.rotation ? evaluateExpression(slab.rotation[1], variables) : 0;
  const rotZ = slab.rotation ? evaluateExpression(slab.rotation[2], variables) : 0;

  // Generate the 2D shape for the slab
  const shape = useMemo(() => {
    if (!hasValidDims) return null;

    const s = new THREE.Shape();

    // Base rectangle
    s.moveTo(0, 0);
    s.lineTo(L, 0);
    s.lineTo(L, D);
    s.lineTo(0, D);
    s.lineTo(0, 0);

    // Add holes for cutouts
    slab.cutouts.forEach((cutout) => {
      const cw = evaluateExpression(cutout.width, variables);
      const cd = evaluateExpression(cutout.depth, variables);
      if (!Number.isFinite(cw) || !Number.isFinite(cd) || cw <= 0 || cd <= 0) {
        return;
      }

      const cx = evaluateExpression(cutout.centerX, variables);
      const cy = evaluateExpression(cutout.centerY, variables);
      const hole = new THREE.Path();

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
  }, [hasValidDims, L, D, slab.cutouts, variables]);

  const extrudeSettings = useMemo(() => {
    const safeBevel = hasValidDims ? Math.min(0.1, Math.min(T, L, D) * 0.2) : 0;
    return {
      depth: hasValidDims ? T : 0,
      bevelEnabled: safeBevel > 0.001,
      bevelSegments: 2,
      steps: 1,
      bevelSize: safeBevel,
      bevelThickness: safeBevel,
    };
  }, [hasValidDims, L, D, T]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#e5e7eb',
      roughness: 0.4,
      metalness: 0.1,
    });
  }, []);

  const edgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#9ca3af',
      linewidth: 1,
    });
  }, []);

  useEffect(() => {
    material.color.set(isSelected ? '#a5b4fc' : '#e5e7eb');
    edgeMaterial.color.set(isSelected ? '#4f46e5' : '#9ca3af');
  }, [isSelected, material, edgeMaterial]);

  const extrudeGeometry = useMemo(() => {
    if (!shape) return null;
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [shape, extrudeSettings]);

  const edgesGeometry = useMemo(() => {
    if (!extrudeGeometry) return null;
    return new THREE.EdgesGeometry(extrudeGeometry);
  }, [extrudeGeometry]);

  const isThicknessT = T <= L && T <= D;
  const isThicknessD = !isThicknessT && D <= L && D < T;
  const isThicknessL = !isThicknessT && !isThicknessD;

  const hasPolishedFrontOrBack = Boolean(
    slab.polishedEdges?.includes('front') || slab.polishedEdges?.includes('back'),
  );
  const hasPolishedLeftOrRight = Boolean(
    slab.polishedEdges?.includes('left') || slab.polishedEdges?.includes('right'),
  );
  const hasAnyPolished = hasPolishedFrontOrBack || hasPolishedLeftOrRight;

  const polishedMaterial = useMemo(() => {
    if (!hasAnyPolished) return null;
    return new THREE.MeshBasicMaterial({ color: '#f59e0b' });
  }, [hasAnyPolished]);

  const polishedGeometryX = useMemo(() => {
    if (!hasValidDims || !hasPolishedFrontOrBack) return null;
    if (isThicknessL) {
      return new THREE.BoxGeometry(0.3, T, 0.3);
    }
    return new THREE.BoxGeometry(L, 0.3, 0.3);
  }, [hasValidDims, hasPolishedFrontOrBack, L, T, isThicknessL]);

  const polishedGeometryZ = useMemo(() => {
    if (!hasValidDims || !hasPolishedLeftOrRight) return null;
    if (isThicknessD) {
      return new THREE.BoxGeometry(0.3, T, 0.3);
    }
    return new THREE.BoxGeometry(0.3, 0.3, D);
  }, [hasValidDims, hasPolishedLeftOrRight, D, T, isThicknessD]);

  useEffect(() => {
    return () => {
      extrudeGeometry?.dispose();
    };
  }, [extrudeGeometry]);

  useEffect(() => {
    return () => {
      edgesGeometry?.dispose();
    };
  }, [edgesGeometry]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    return () => {
      edgeMaterial.dispose();
    };
  }, [edgeMaterial]);

  useEffect(() => {
    return () => {
      polishedMaterial?.dispose();
    };
  }, [polishedMaterial]);

  useEffect(() => {
    return () => {
      polishedGeometryX?.dispose();
    };
  }, [polishedGeometryX]);

  useEffect(() => {
    return () => {
      polishedGeometryZ?.dispose();
    };
  }, [polishedGeometryZ]);

  if (!hasValidDims || !extrudeGeometry || !edgesGeometry) {
    return null;
  }

  const showHitboxes = interactive && !printMode;

  return (
    <group
      position={[posX, posY, posZ]}
      rotation={[rotX, rotY, rotZ]}
      name={slab.id}
      onClick={
        interactive && !printMode
          ? (e) => {
              e.stopPropagation();
              onSelect(slab.id);
            }
          : undefined
      }
    >
      {/* Main Slab */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={extrudeGeometry} material={material} />
        <lineSegments geometry={edgesGeometry} material={edgeMaterial} />
      </group>

      {/* Edge Hitboxes (designer interactive mode only) */}
      {showHitboxes && (() => {
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
                edgeName="front-left"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'front-left'}
              />
              <EdgeHitbox
                position={[L + hitSize / 2, T / 2, -D / 2]}
                args={[hitSize, T, hitboxDepthZ]}
                edgeName="front-right"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'front-right'}
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
                edgeName="front-left"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'front-left'}
              />
              <EdgeHitbox
                position={[L / 2, T / 2, -D - hitSize / 2]}
                args={[hitboxWidthX, T, hitSize]}
                edgeName="back-left"
                slabId={slab.id}
                onEdgeSelect={onEdgeSelect}
                isSelected={selectedEdge?.slabId === slab.id && selectedEdge?.edge === 'back-left'}
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
      {polishedMaterial && polishedGeometryX && slab.polishedEdges?.includes('front') && (
        <mesh position={isThicknessL ? [L / 2, T / 2, 0] : [L / 2, T, 0]} geometry={polishedGeometryX} material={polishedMaterial} />
      )}
      {polishedMaterial && polishedGeometryX && slab.polishedEdges?.includes('back') && (
        <mesh position={isThicknessL ? [L / 2, T / 2, -D] : [L / 2, T, -D]} geometry={polishedGeometryX} material={polishedMaterial} />
      )}
      {polishedMaterial && polishedGeometryZ && slab.polishedEdges?.includes('left') && (
        <mesh position={isThicknessD ? [0, T / 2, -D / 2] : [0, T, -D / 2]} geometry={polishedGeometryZ} material={polishedMaterial} />
      )}
      {polishedMaterial && polishedGeometryZ && slab.polishedEdges?.includes('right') && (
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
          printMode={printMode}
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
          interactive={interactive}
          printMode={printMode}
        />
      ))}
    </group>
  );
};