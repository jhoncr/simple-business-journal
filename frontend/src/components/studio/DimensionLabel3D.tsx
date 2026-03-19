'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Billboard, Text, Line } from '@react-three/drei';
import { DimensionLabel, Expression } from '@backend/common/schemas/studio';
import { evaluateExpression } from '../../lib/evaluator';

interface DimensionLabel3DProps {
  label: DimensionLabel;
  parentLength: number;
  parentDepth: number;
  parentThickness: number;
  variables: Record<string, number>;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Computes the midpoint position and extension line endpoints for a dimension label
 * based on which edge of the parent slab it is attached to.
 */
const getEdgeGeometry = (
  edge: string,
  L: number,
  D: number,
  T: number,
  offset: number,
): { midpoint: [number, number, number]; lineStart: [number, number, number]; lineEnd: [number, number, number]; extensionA: [number, number, number][]; extensionB: [number, number, number][] } => {
  // Default to top-front
  let midpoint: [number, number, number] = [L / 2, T + offset, 0];
  let lineStart: [number, number, number] = [0, T + offset, 0];
  let lineEnd: [number, number, number] = [L, T + offset, 0];
  let extensionA: [number, number, number][] = [[0, T, 0], [0, T + offset + 3, 0]];
  let extensionB: [number, number, number][] = [[L, T, 0], [L, T + offset + 3, 0]];

  const isTop = edge.includes('top') || edge === 'front' || edge === 'back' || edge === 'left' || edge === 'right';
  const isBottom = edge.includes('bottom');
  const isFront = edge.includes('front') || edge === 'front';
  const isBack = edge.includes('back') || edge === 'back';
  const isLeft = edge.includes('left') || edge === 'left';
  const isRight = edge.includes('right') || edge === 'right';

  const isXEdge = (isTop || isBottom) && (isFront || isBack);
  const isZEdge = (isTop || isBottom) && (isLeft || isRight);
  const isVertical = !isTop && !isBottom;

  if (isXEdge) {
    // Horizontal edge along X axis (front or back)
    const y = isTop ? T + offset : -offset;
    const z = isFront ? 0 : -D;
    const ey = isTop ? T : 0;
    midpoint = [L / 2, y, z];
    lineStart = [0, y, z];
    lineEnd = [L, y, z];
    extensionA = [[0, ey, z], [0, y + (isTop ? 3 : -3), z]];
    extensionB = [[L, ey, z], [L, y + (isTop ? 3 : -3), z]];
  } else if (isZEdge) {
    // Horizontal edge along Z axis (left or right)
    const y = isTop ? T + offset : -offset;
    const x = isLeft ? 0 : L;
    const ey = isTop ? T : 0;
    midpoint = [x, y, -D / 2];
    lineStart = [x, y, 0];
    lineEnd = [x, y, -D];
    extensionA = [[x, ey, 0], [x, y + (isTop ? 3 : -3), 0]];
    extensionB = [[x, ey, -D], [x, y + (isTop ? 3 : -3), -D]];
  } else if (isVertical) {
    // Vertical edge (e.g. front-left, back-right)
    const x = isLeft ? -offset : L + offset;
    const z = isFront ? 0 : -D;
    const ex = isLeft ? 0 : L;
    midpoint = [x, T / 2, z];
    lineStart = [x, 0, z];
    lineEnd = [x, T, z];
    extensionA = [[ex, 0, z], [x + (isLeft ? -3 : 3), 0, z]];
    extensionB = [[ex, T, z], [x + (isLeft ? -3 : 3), T, z]];
  }

  return { midpoint, lineStart, lineEnd, extensionA, extensionB };
};

export const DimensionLabel3D: React.FC<DimensionLabel3DProps> = ({
  label,
  parentLength,
  parentDepth,
  parentThickness,
  variables,
  isSelected,
  onSelect,
}) => {
  const evaluatedText = useMemo(() => {
    const val = evaluateExpression(label.text as Expression, variables);
    // Format: show 1 decimal place if not integer
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  }, [label.text, variables]);

  const geometry = useMemo(() => {
    return getEdgeGeometry(label.edge, parentLength, parentDepth, parentThickness, label.offset);
  }, [label.edge, parentLength, parentDepth, parentThickness, label.offset]);

  const lineColor = isSelected ? '#4f46e5' : '#6366f1';
  const textColor = isSelected ? '#312e81' : '#1e1b4b';

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(label.id); }}>
      {/* Main dimension line */}
      <Line
        points={[geometry.lineStart, geometry.lineEnd]}
        color={lineColor}
        lineWidth={1.5}
      />

      {/* Arrow heads (small triangles at each end) */}
      <Line
        points={[geometry.lineStart, geometry.lineEnd]}
        color={lineColor}
        lineWidth={1.5}
      />

      {/* Extension lines */}
      <Line points={geometry.extensionA} color={lineColor} lineWidth={1} />
      <Line points={geometry.extensionB} color={lineColor} lineWidth={1} />

      {/* Text label - always faces camera */}
      <Billboard position={geometry.midpoint} follow={true} lockX={false} lockY={false} lockZ={false}>
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[evaluatedText.length * 3.2 + 6, 7]} />
          <meshBasicMaterial color="white" transparent opacity={0.9} depthTest={false} />
        </mesh>
        <Text
          fontSize={4}
          color={textColor}
          anchorX="center"
          anchorY="middle"
          font={undefined}
          depthOffset={-1}
        >
          {evaluatedText}
        </Text>
      </Billboard>
    </group>
  );
};
