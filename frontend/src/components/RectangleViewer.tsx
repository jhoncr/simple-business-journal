"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";

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
  groupId?: string | null;
}

interface RectangleViewerProps {
  rectangles: RectangleData[];
  header?: React.ReactNode;
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

export const RectangleViewer: React.FC<RectangleViewerProps> = ({ rectangles, header }) => {
  const t = useTranslations("draw");
  if (!rectangles || rectangles.length === 0) {
    return (
      <table className="w-full">
        {header && (
          <thead className="table-header-group">
            <tr>
              <th className="font-normal text-left bg-white p-0">
                {header}
              </th>
            </tr>
          </thead>
        )}
        <tbody>
          <tr>
            <td className="p-0">
              <div className="flex justify-center items-center w-full min-h-[400px] border-2 border-dashed border-border rounded-md mt-4">
                <p className="text-muted-foreground">{t("noRectanglesToDisplay")}</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  const groupedRectangleRows = useMemo(() => {
    const groups: RectangleData[][] = [];
    let currentGroupId: string | null | undefined = undefined;
    let currentGroup: RectangleData[] = [];

    for (const rect of rectangles) {
      const gId = rect.groupId || null;
      if (gId === currentGroupId) {
        currentGroup.push(rect);
      } else {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [rect];
        currentGroupId = gId;
      }
    }

    if (currentGroup.length > 0) groups.push(currentGroup);

    return groups.map((group) => groupRectanglesIntoRows(group, 400));
  }, [rectangles]);

  return (
    <table className="w-full border-collapse print:border-none">
      {header && (
        <thead className="table-header-group">
          <tr>
            <th className="font-normal text-left bg-white print:bg-white p-0 align-bottom">
              {header}
            </th>
          </tr>
        </thead>
      )}
      <tbody>
        {groupedRectangleRows.map((groupRows, index) => {
          const groupLabel = groupRows[0]?.[0]?.groupId && groupRows[0]?.[0]?.label;

          return (
            <React.Fragment key={index}>
              {groupLabel && (
                <tr className="print:break-inside-avoid">
                  <td className="p-0">
                    <h3 className="font-bold bg-muted/30 text-foreground text-start uppercase tracking-wide w-full print:bg-transparent print:text-black print:p-0 print:mb-2 text-sm mt-8">
                      {groupLabel}
                    </h3>
                  </td>
                </tr>
              )}
              {groupRows.map((row, rowIndex) => (
                <tr
                  key={`${index}-${rowIndex}`}
                  className="print:break-inside-avoid"
                >
                  <td className="p-0 align-bottom">
                    <div className={`flex flex-row items-end justify-start w-full gap-6 print:gap-4 pt-6 pb-6 print:py-4 ${rowIndex < groupRows.length - 1 ? 'border-b border-gray-200 print:border-b-0' : ''}`}>
                      {row.map((rect) => (
                        <DynamicRectangle key={rect.id} rect={rect} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

// --- Sub-components ---

const CrossMark: React.FC<{ className: string }> = ({ className }) => (
  <div
    className={`absolute text-xs text-black font-bold leading-none z-10 w-3 h-3 flex items-center justify-center bg-white/80 rounded-full pointer-events-none ${className}`}
    style={{
      boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.8)",
    }}
  >
    <span className="relative -top-[1px] leading-none">x</span>
  </div>
);


const DimensionLabel: React.FC<{ value: number; positionClass: string }> = ({ value, positionClass }) => (
  <div className={`absolute flex flex-col items-end justify-center text-sm text-foreground whitespace-nowrap ${positionClass} print:text-black`}>
    <span className="leading-none print:text-black">{value}</span>
    <span className="text-[10px] leading-none text-muted-foreground print:text-black">cm</span>
  </div>
);

export const DynamicRectangle: React.FC<{ rect: RectangleData }> = ({ rect }) => {
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
  const calculatedWidthPercentage = Math.min((longerSide / 100) * 25, 100);

  const showTopCross = isRotated ? hasCrossLeft : hasCrossTop;
  const showRightCross = isRotated ? hasCrossTop : hasCrossRight;
  const showBottomCross = isRotated ? hasCrossRight : hasCrossBottom;
  const showLeftCross = isRotated ? hasCrossBottom : hasCrossLeft;

  return (
    <div
      className="flex flex-col items-end gap-1 print:flex print:p-0"
      style={{ width: `${calculatedWidthPercentage}%`, minWidth: "160px" }}
    >
      {label && label !== groupId && (
        <div className="w-full text-left text-xs font-semibold text-foreground print:text-black whitespace-normal break-keep leading-snug print:w-full">
          {label}: {renderHeight} x {renderWidth}
        </div>
      )}

      <div className="relative mt-2 mb-8 mr-8 w-[calc(100%-6rem)] ml-16 print:mt-4 print:mb-4 print:mr-8 print:w-[calc(100%-5rem)] print:ml-12 print:px-0 print:overflow-visible">
        <DimensionLabel value={renderHeight} positionClass="top-1/2 -left-4 -translate-x-full -translate-y-1/2" />
        <DimensionLabel value={renderWidth} positionClass="left-1/2 -bottom-2 -translate-x-1/2 translate-y-full" />

        {showTopCross && <CrossMark className="top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
        {showRightCross && <CrossMark className="top-1/2 right-0 translate-x-1/2 -translate-y-1/2" />}
        {showBottomCross && <CrossMark className="bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" />}
        {showLeftCross && <CrossMark className="top-1/2 left-0 -translate-x-1/2 -translate-y-1/2" />}

        {hasLeftCornerCrosses &&
          (isRotated ? (
            <>
              <CrossMark className="top-[5%] left-0 -translate-x-1/2 -translate-y-1/2" />
              <CrossMark className="top-[5%] right-0 translate-x-1/2 -translate-y-1/2" />
            </>
          ) : (
            <>
              <CrossMark className="top-0 left-[5%] -translate-x-1/2 -translate-y-1/2" />
              <CrossMark className="bottom-0 left-[5%] -translate-x-1/2 translate-y-1/2" />
            </>
          ))}

        <svg viewBox={`0 0 ${renderWidth} ${renderHeight}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto transition-all duration-300 ease-in-out overflow-visible">
          <rect width="100%" height="100%" fill={fillColor} stroke={strokeColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {hasStroke && (
            <line
              x1={isRotated ? "0%" : Math.max(Math.min(renderHeight, renderWidth) * 0.2, 4)}
              x2={isRotated ? "100%" : Math.max(Math.min(renderHeight, renderWidth) * 0.2, 4)}
              y1={isRotated ? Math.max(Math.min(renderHeight, renderWidth) * 0.2, 4) : "0%"}
              y2={isRotated ? Math.max(Math.min(renderHeight, renderWidth) * 0.2, 4) : "100%"}
              stroke={strokeColor}
              strokeOpacity={0.6}
              strokeWidth="2"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
    </div>
  );
};

export default RectangleViewer;