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
 * Evaluates a 3-component expression tuple into a THREE.Vector3.
 */
const evaluateVector = (
  pos: [Expression, Expression, Expression],
  vars: Record<string, number>
): THREE.Vector3 => new THREE.Vector3(
  evaluateExpression(pos[0], vars),
  evaluateExpression(pos[1], vars),
  evaluateExpression(pos[2], vars)
);

/**
 * Computes the midpoint position and extension line endpoints for a dimension label
 * based on which edge of the parent slab it is attached to.
 */
const getEdgeGeometry = (
  label: DimensionLabel,
  L: number,
  D: number,
  T: number,
  variables: Record<string, number>,
): { midpoint: [number, number, number]; lineStart: [number, number, number]; lineEnd: [number, number, number]; extensionA: [number, number, number][]; extensionB: [number, number, number][] } => {
  const { edge, offset = 15, startPos, endPos, offsetDirection } = label;

  if (edge === 'custom' && startPos && endPos) {
    // Evaluate expressions to get absolute positions relative to the component
    const startVector = evaluateVector(startPos as [Expression, Expression, Expression], variables);
    const endVector = evaluateVector(endPos as [Expression, Expression, Expression], variables);

    const lineDir = new THREE.Vector3().subVectors(endVector, startVector);
    const length = lineDir.length();

    if (length > 0) {
      lineDir.normalize();

      let offsetVec = new THREE.Vector3();

      if (offsetDirection) {
        offsetVec = evaluateVector(offsetDirection as [Expression, Expression, Expression], variables)
          .normalize()
          .multiplyScalar(offset);
      } else {
        // Default offset calculation
        // Try to cross with Y axis. If line is vertical, cross with X axis.
        const up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(lineDir.dot(up)) > 0.99) {
          up.set(1, 0, 0);
        }

        offsetVec.crossVectors(lineDir, up).normalize().multiplyScalar(offset);

        // For horizontal planes, we want the offset to go outward/upward.
        if (lineDir.y === 0 && offsetVec.y === 0) {
          offsetVec.set(0, offset, 0);
        }
      }

      const lineStartVector = new THREE.Vector3().addVectors(startVector, offsetVec);
      const lineEndVector = new THREE.Vector3().addVectors(endVector, offsetVec);
      const midVector = new THREE.Vector3().addVectors(lineStartVector, lineEndVector).multiplyScalar(0.5);

      // Extending slightly beyond the dimension line
      const extDir = offsetVec.clone().normalize();
      const extAmount = 3;

      return {
        midpoint: [midVector.x, midVector.y, midVector.z],
        lineStart: [lineStartVector.x, lineStartVector.y, lineStartVector.z],
        lineEnd: [lineEndVector.x, lineEndVector.y, lineEndVector.z],
        extensionA: [
          [startVector.x, startVector.y, startVector.z],
          [lineStartVector.x + extDir.x * extAmount, lineStartVector.y + extDir.y * extAmount, lineStartVector.z + extDir.z * extAmount]
        ],
        extensionB: [
          [endVector.x, endVector.y, endVector.z],
          [lineEndVector.x + extDir.x * extAmount, lineEndVector.y + extDir.y * extAmount, lineEndVector.z + extDir.z * extAmount]
        ]
      };
    }

    // When start and end points are the same, return an empty geometry to avoid fall-through.
    // Drei's Line component requires at least 2 points to avoid negative typed array lengths.
    return {
      midpoint: [0, 0, 0],
      lineStart: [0, 0, 0],
      lineEnd: [0, 0, 0],
      extensionA: [[0, 0, 0], [0, 0, 0]],
      extensionB: [[0, 0, 0], [0, 0, 0]],
    };
  }

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
    return getEdgeGeometry(label, parentLength, parentDepth, parentThickness, variables);
  }, [label, parentLength, parentDepth, parentThickness, variables]);

  const lineColor = isSelected ? '#f59e0b' : '#6366f1';
  const textColor = isSelected ? '#78350f' : '#1e1b4b';
  const bgColor = isSelected ? '#fef3c7' : 'white';
  const mainLineWidth = isSelected ? 3 : 1.5;
  const extLineWidth = isSelected ? 2 : 1;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(label.id); }}>
      {/* Main dimension line */}
      <Line
        points={[geometry.lineStart, geometry.lineEnd]}
        color={lineColor}
        lineWidth={mainLineWidth}
      />

      {/* Arrow heads (small triangles at each end) */}
      <Line
        points={[geometry.lineStart, geometry.lineEnd]}
        color={lineColor}
        lineWidth={mainLineWidth}
      />

      {/* Extension lines */}
      <Line points={geometry.extensionA} color={lineColor} lineWidth={extLineWidth} />
      <Line points={geometry.extensionB} color={lineColor} lineWidth={extLineWidth} />

      {/* Text label - always faces camera */}
      <Billboard position={geometry.midpoint} follow={true} lockX={false} lockY={false} lockZ={false}>
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[evaluatedText.length * 3.2 + 6, 7]} />
          <meshBasicMaterial color={bgColor} transparent opacity={isSelected ? 1 : 0.9} depthTest={false} />
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
