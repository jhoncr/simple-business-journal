"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";

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

export const RectangleViewer: React.FC<RectangleViewerProps> = ({ rectangles }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initial width
    setContainerWidth(containerRef.current.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!rectangles || rectangles.length === 0 || containerWidth === 0) return 1;
    
    // Find the max dimension among all rectangles to ensure all fit proportionately
    const maxDimensionCM = rectangles.reduce((max, r) => {
      const currentMax = Math.max(r.length, r.width);
      return currentMax > max ? currentMax : max;
    }, 0);

    // Dynamic padding: use ~80% of container width to be visually appealing
    // We limit max base representation to 600px unless screen is small
    const availablePixels = Math.min(containerWidth * 0.8, 600);
    
    return maxDimensionCM > 0 ? availablePixels / maxDimensionCM : 1;
  }, [rectangles, containerWidth]);

  if (!rectangles || rectangles.length === 0) {
    return (
      <div className="flex justify-center items-center w-full min-h-[400px] border-2 border-dashed border-border rounded-md">
        <p className="text-muted-foreground">No rectangles to display</p>
      </div>
    );
  }

  // Group by groupId to map rows if applicable; ungrouped ones go into their own arrays.
  const groupedRectangles = useMemo(() => {
    if (!rectangles) return [];
    
    // Maintain insertion order by detecting group changes. Wait, better to just map by unique IDs
    // but the input is already ordered. We can group adjacent items together by groupId.
    const groups: RectangleData[][] = [];
    let currentGroupId: string | null = null;
    let currentGroup: RectangleData[] = [];

    for (const rect of rectangles) {
      if (rect.groupId && rect.groupId === currentGroupId) {
        currentGroup.push(rect);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [rect];
        currentGroupId = rect.groupId || null;
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Sort each group so rectangles pack better horizontally
    return groups.map((group) => {
      return group.sort((a, b) => {
        // Compare by the short side ascending (narrow rectangles first)
        const aShortSide = Math.min(a.width, a.length);
        const bShortSide = Math.min(b.width, b.length);

        if (aShortSide !== bShortSide) {
          return aShortSide - bShortSide;
        }

        // Compare by the long side descending (long rectangles first for the same width)
        const aLongSide = Math.max(a.width, a.length);
        const bLongSide = Math.max(b.width, b.length);
        
        return bLongSide - aLongSide;
      });
    });
  }, [rectangles]);

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center gap-16 py-8 overflow-hidden print:overflow-visible print:flex print:gap-8 print:p-0 print:[--print-scale:0.55]">
      {groupedRectangles.map((group, index) => {
        const groupLabel = group.find(r => r.label)?.label;
        
        return (
          <div 
            key={index} 
            className={`flex flex-col items-center w-full gap-8 ${index < groupedRectangles.length - 1 ? "border-b pb-12 border-border" : ""} print:flex print:flex-col print:gap-6 print:p-0 print:border-none print:break-inside-avoid print:mb-8`}
          >
            {groupLabel && (
              <h3 className="text-xl font-bold bg-muted/30 px-6 py-2 text-foreground text-start uppercase tracking-wide w-full print:bg-transparent print:text-black print:p-0 print:mb-2 text-sm">
                {groupLabel}
              </h3>
            )}
            <div className="flex flex-wrap gap-12 items-end justify-center w-full print:flex print:flex-wrap print:gap-8 print:items-end print:justify-center print:p-0">
              {group.map((rect) => (
                <div key={rect.id} className="print:m-2">
                  <DynamicRectangle rect={rect} scale={scale} />
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
  scale: number;
}

const DynamicRectangle: React.FC<DynamicRectangleProps> = ({ rect, scale }) => {
  const { 
    length, 
    width, 
    fillColor = "lightgray", 
    strokeColor = "black",
    label,
    hasCrossTop,
    hasCrossRight,
    hasCrossBottom,
    hasCrossLeft,
    hasLeftCornerCrosses,
    hasStroke = true
  } = rect;
  
  const isRotated = length > width;
  const renderWidth = isRotated ? length : width;
  const renderHeight = isRotated ? width : length;

  const displayWidth = renderWidth * scale;
  const displayHeight = renderHeight * scale;

  return (
    <div className="flex flex-col items-start gap-3 print:flex print:p-0">
      <div className="relative mt-2 mb-8 mr-2 ml-10 print:m-4 print:p-0 print:overflow-visible">
        <DimensionLabel 
          value={renderHeight} 
          positionClass="top-1/2 -left-4 -translate-x-full -translate-y-1/2" 
        />
        <DimensionLabel 
          value={renderWidth} 
          positionClass="left-1/2 -bottom-2 -translate-x-1/2 translate-y-full" 
        />

        {/* Optional Cross Markers */}
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

        {/* Left Corner Cross Markers - Displayed together */}
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
          style={{
            width: `calc(${displayWidth}px * var(--print-scale, 1))`,
            height: `calc(${displayHeight}px * var(--print-scale, 1))`
          }}
          viewBox={`0 0 ${displayWidth} ${displayHeight}`}
          xmlns="http://www.w3.org/2000/svg"
          className="transition-all duration-300 ease-in-out print:overflow-visible"
        >
        {/* Background Rectangle */}
        <rect 
          width="100%" 
          height="100%" 
          fill={fillColor} 
          stroke={strokeColor} 
          strokeWidth="2" 
        />
        
        {/* Vertical Dotted Line */}
        {hasStroke && (
          isRotated ? (
            <line 
              x1="0%"
              x2="100%"
              y1={Math.max(displayHeight * 0.1, 8)}
              y2={Math.max(displayHeight * 0.1, 8)}
              stroke={strokeColor}
              strokeOpacity={0.6}
              strokeWidth="2"
              strokeDasharray="4 4" 
            />
          ) : (
            <line 
              x1={Math.max(displayWidth * 0.1, 8)}
              x2={Math.max(displayWidth * 0.1, 8)}
              y1="0%"
              y2="100%"
              stroke={strokeColor}
              strokeOpacity={0.6}
              strokeWidth="2"
              strokeDasharray="4 4" 
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
