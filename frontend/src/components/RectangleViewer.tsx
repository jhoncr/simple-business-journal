"use client";

import React, { useMemo } from "react";

export interface RectangleData {
  id: string | number;
  length: number; // usually corresponds to vertical dimension
  width: number;  // usually corresponds to horizontal dimension
  fillColor?: string;
  strokeColor?: string;
  label?: string;
  hasCrossTop?: boolean;
  hasCrossRight?: boolean;
  hasCrossBottom?: boolean;
  hasCrossLeft?: boolean;
  hasLeftCornerCrosses?: boolean;
  hasStroke?: boolean;
  groupId?: string;
}

interface RectangleViewerProps {
  rectangles: RectangleData[];
}

function groupRectanglesIntoRows(
  rectangles: RectangleData[],
  maxRowCapacityCm: number = 400
): RectangleData[][] {
  const sortedRectangles = [...rectangles].sort((a, b) => {
    const lengthA = Math.max(a.width, a.length);
    const lengthB = Math.max(b.width, b.length);
    return lengthB - lengthA;
  });

  const rows: RectangleData[][] = [];
  const remainingSpacePerRow: number[] = [];

  for (const rect of sortedRectangles) {
    const rectLength = Math.max(rect.width, rect.length);
    let placed = false;

    for (let i = 0; i < rows.length; i++) {
      if (remainingSpacePerRow[i] >= rectLength) {
        rows[i].push(rect);
        remainingSpacePerRow[i] -= rectLength;
        placed = true;
        break;
      }
    }

    if (!placed) {
      rows.push([rect]);
      const spaceLeft = Math.max(0, maxRowCapacityCm - rectLength);
      remainingSpacePerRow.push(spaceLeft);
    }
  }

  return rows;
}

export const RectangleViewer: React.FC<RectangleViewerProps> = ({ rectangles }) => {
  if (!rectangles || rectangles.length === 0) {
    return (
      <div className="flex justify-center items-center w-full min-h-[400px] border-2 border-dashed border-border rounded-md">
        <p className="text-muted-foreground">No rectangles to display</p>
      </div>
    );
  }

  // Group by groupId to map rows; items without a groupId are grouped together.
  const groupedRectangleRows = useMemo(() => {
    if (!rectangles) return [];

    const groups: RectangleData[][] = [];
    let currentGroupId: string | null | undefined = undefined;
    let currentGroup: RectangleData[] = [];

    for (const rect of rectangles) {
      const gId = rect.groupId || null;
      if (gId === currentGroupId) {
        currentGroup.push(rect);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [rect];
        currentGroupId = gId;
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups.map((group) => groupRectanglesIntoRows(group, 400));
  }, [rectangles]);

  return (
    <div className="w-full flex flex-col items-center gap-16 py-8 overflow-hidden print:overflow-visible print:block print:p-0">
      {groupedRectangleRows.map((groupRows, index) => {
        const groupLabel = groupRows[0]?.[0]?.groupId && groupRows[0]?.[0]?.label

        return (
          <div
            key={index}
            className={`flex flex-col items-center w-full gap-8 ${index < groupedRectangleRows.length - 1 ? "border-b pb-12 border-border print:border-b-0 print:pb-0" : ""} print:block print:p-0 print:border-none print:break-inside-avoid print:mb-8`}
          >
            {groupLabel && (
              <h3 className="font-bold bg-muted/30 text-foreground text-start uppercase tracking-wide w-full print:bg-transparent print:text-black print:p-0 print:mb-2 text-sm">
                {groupLabel}
              </h3>
            )}
            <div className="flex flex-col w-full gap-12 print:gap-8 print:w-full">
              {groupRows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex flex-row items-end justify-start w-full gap-6 print:gap-4 border-b border-gray-200 pb-4 print:border-b-0 print:pb-0"
                >
                  {row.map((rect) => (
                    <DynamicRectangle key={rect.id} rect={rect} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface DynamicRectangleProps {
  rect: RectangleData;
}

const DynamicRectangle: React.FC<DynamicRectangleProps> = ({ rect }) => {
  const {
    length,
    width,
    fillColor = "lightgray",
    strokeColor = "black",
    hasCrossTop,
    hasCrossRight,
    hasCrossBottom,
    hasCrossLeft,
    hasLeftCornerCrosses,
    hasStroke = true,
    label,
    groupId
  } = rect;

  const isRotated = length > width;
  const renderWidth = isRotated ? length : width;
  const renderHeight = isRotated ? width : length;

  const longerSide = Math.max(width, length);
  // Calculate width percentage: 25% per 100cm, capped at 100%
  const calculatedWidthPercentage = Math.min((longerSide / 100) * 25, 100);

  return (
    <div
      className="flex flex-col items-end gap-1 print:flex print:p-0"
      style={{ width: `${calculatedWidthPercentage}%`, minWidth: '40px' }}
    >
      {label && label !== groupId && (
        <div className="w-[calc(100%-5rem)] ml-12 mr-8 text-left text-sm font-semibold text-foreground print:text-black whitespace-nowrap print:w-[calc(100%-4.5rem)] print:ml-10 print:mr-8">
          {label}: {renderHeight} x {renderWidth}
        </div>
      )}
      <div className="relative mt-2 mb-8 mr-8 w-[calc(100%-5rem)] ml-12 print:mt-4 print:mb-4 print:mr-8 print:w-[calc(100%-4.5rem)] print:ml-10 print:px-0 print:overflow-visible">
        <DimensionLabel
          value={renderHeight}
          positionClass="top-1/2 -left-4 -translate-x-full -translate-y-1/2"
        />
        <DimensionLabel
          value={renderWidth}
          positionClass="left-1/2 -bottom-2 -translate-x-1/2 translate-y-full"
        />

        {(isRotated ? hasCrossLeft : hasCrossTop) && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full pointer-events-none print:text-black print:bg-transparent">
            ×
          </div>
        )}
        {(isRotated ? hasCrossTop : hasCrossRight) && (
          <div className="absolute top-1/2 right-0 translate-x-4 -translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full pointer-events-none print:text-black print:bg-transparent">
            ×
          </div>
        )}
        {(isRotated ? hasCrossRight : hasCrossBottom) && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full pointer-events-none print:text-black print:bg-transparent">
            ×
          </div>
        )}
        {(isRotated ? hasCrossBottom : hasCrossLeft) && (
          <div className="absolute top-1/2 left-0 -translate-x-4 -translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full pointer-events-none print:text-black print:bg-transparent">
            ×
          </div>
        )}

        {hasLeftCornerCrosses && (
          isRotated ? (
            <>
              <div className="absolute top-[5%] left-0 -translate-x-4 -translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full pointer-events-none print:text-black print:bg-transparent">
                ×
              </div>
              <div className="absolute top-[5%] right-0 translate-x-4 -translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full pointer-events-none print:text-black print:bg-transparent">
                ×
              </div>
            </>
          ) : (
            <>
              <div className="absolute top-0 left-[5%] -translate-x-1/2 -translate-y-4 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full pointer-events-none print:text-black print:bg-transparent">
                ×
              </div>
              <div className="absolute bottom-0 left-[5%] -translate-x-1/2 translate-y-4 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full pointer-events-none print:text-black print:bg-transparent">
                ×
              </div>
            </>
          )
        )}

        <svg
          viewBox={`0 0 ${renderWidth} ${renderHeight}`}
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto transition-all duration-300 ease-in-out print:overflow-visible"
        >
          <rect
            width="100%"
            height="100%"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {hasStroke && (
            isRotated ? (
              <line
                x1="0%"
                x2="100%"
                y1={Math.max(Math.min(renderHeight, renderWidth) * 0.2, 4)}
                y2={Math.max(Math.min(renderHeight, renderWidth) * 0.2, 4)}
                stroke={strokeColor}
                strokeOpacity={0.6}
                strokeWidth="2"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <line
                x1={Math.max(Math.min(renderHeight, renderWidth) * 0.2, 4)}
                x2={Math.max(Math.min(renderHeight, renderWidth) * 0.2, 4)}
                y1="0%"
                y2="100%"
                stroke={strokeColor}
                strokeOpacity={0.6}
                strokeWidth="2"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )
          )}
        </svg>
      </div>
    </div>
  );
};

interface DimensionLabelProps {
  value: number;
  positionClass: string;
}

const DimensionLabel: React.FC<DimensionLabelProps> = ({ value, positionClass }) => (
  <div className={`absolute flex flex-col items-end justify-center text-sm text-foreground whitespace-nowrap ${positionClass} print:text-black`}>
    <span className="leading-none print:text-black">{value}</span>
    <span className="text-[10px] leading-none text-muted-foreground print:text-black">cm</span>
  </div>
);

export default RectangleViewer;
