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
    const maxDimensionCM = Math.max(
      ...rectangles.map(r => Math.max(r.length, r.width))
    );

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

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center gap-12 py-8 overflow-hidden">
      <div className="flex flex-wrap gap-12 items-end justify-center w-full">
        {rectangles.map((rect) => (
          <DynamicRectangle key={rect.id} rect={rect} scale={scale} />
        ))}
      </div>
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
    hasLeftCornerCrosses
  } = rect;
  
  const displayWidth = width * scale;
  const displayHeight = length * scale;

  return (
    <div className="flex flex-col items-start gap-3">
      {label && (
        <div className="text-sm font-medium text-foreground text-center">
          <div className="font-bold mb-1 rounded-sm bg-muted/50 px-2 py-0.5">{label}</div>
        </div>
      )}
      <div className="relative mt-2 mb-8 mr-2 ml-10">
        <DimensionLabel 
          value={length} 
          positionClass="top-1/2 -left-3 -translate-x-full -translate-y-1/2" 
        />
        <DimensionLabel 
          value={width} 
          positionClass="left-1/2 -bottom-3 -translate-x-1/2 translate-y-full" 
        />

        {/* Optional Cross Markers */}
        {hasCrossTop && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background rounded-full pointer-events-none">
            ×
          </div>
        )}
        {hasCrossRight && (
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background rounded-full pointer-events-none">
            ×
          </div>
        )}
        {hasCrossBottom && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background rounded-full pointer-events-none">
            ×
          </div>
        )}
        {hasCrossLeft && (
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background rounded-full pointer-events-none">
            ×
          </div>
        )}

        {/* Left Corner Cross Markers - Displayed together */}
        {hasLeftCornerCrosses && (
          <>
            <div className="absolute top-0 left-[5%] -translate-x-1/2 -translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background rounded-full pointer-events-none">
              ×
            </div>
            <div className="absolute bottom-0 left-[5%] -translate-x-1/2 translate-y-1/2 text-sm text-foreground font-bold leading-none z-10 w-4 h-4 flex items-center justify-center bg-background rounded-full pointer-events-none">
              ×
            </div>
          </>
        )}

        <svg 
          width={displayWidth} 
          height={displayHeight} 
          xmlns="http://www.w3.org/2000/svg"
          className="transition-all duration-300 ease-in-out"
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
        <line 
          x1="10%"
          x2="10%"
          y1="0%"
          y2="100%"
          stroke={strokeColor}
          strokeOpacity={0.6}
          strokeWidth="2"
          strokeDasharray="4 4" 
        />
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
  <div className={`absolute flex flex-col items-end justify-center text-sm text-foreground whitespace-nowrap ${positionClass}`}>
    <span className="leading-none">{value}</span>
    <span className="text-[10px] leading-none text-muted-foreground">cm</span>
  </div>
);

export default RectangleViewer;
