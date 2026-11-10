import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { EstimateHeader } from "@/app/(auth)/journal/journal-types/estimate/subcomponents/header";
import { StoneForgeViewer } from "@/components/studio/StoneForgeViewer";
import { AssemblyTemplate, SlabComponent } from "@backend/common/schemas/studio";
import { contactInfoSchemaType } from "@backend/common/schemas/common_schemas";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RectangleViewer, RectangleData } from "@/components/RectangleViewer";
import { evaluateExpression } from "@/lib/evaluator";

const flattenComponents = (components: SlabComponent[]): SlabComponent[] => {
  return components.reduce((acc: SlabComponent[], comp) => {
    acc.push(comp);
    if (comp.children && comp.children.length > 0) {
      acc.push(...flattenComponents(comp.children));
    }
    return acc;
  }, []);
};

const formatPrintDimensions = (length: number, depth: number, thickness: number) => {
  const dims = [length, depth, thickness];
  const idx = dims.indexOf(2);
  if (idx !== -1) {
    dims.splice(idx, 1);
  } else {
    dims.pop(); // Fallback if no thickness is exactly 2
  }
  dims.sort((a, b) => a - b);
  return { length: dims[0], width: dims[1], label: `${dims[0]} x ${dims[1]}` };
};

export function getPolishedSymbolCoords(
  edge: 'front' | 'back' | 'left' | 'right',
  slab: { x: number; y: number; width: number; height: number },
  insideOffset: number = 0
) {
  switch (edge) {
    case 'back': // Top edge
      return { x: slab.x + slab.width / 2, y: slab.y + insideOffset };
    case 'front': // Bottom edge
      return { x: slab.x + slab.width / 2, y: slab.y + slab.height - insideOffset };
    case 'left':
      return { x: slab.x + insideOffset, y: slab.y + slab.height / 2 };
    case 'right':
      return { x: slab.x + slab.width - insideOffset, y: slab.y + slab.height / 2 };
  }
}

interface CameraView {
  id: string;
  name: string;
  focusTargetId?: string;
}

interface AddressInfo {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface PrintableItem {
  id: string;
  description: string;
  template: AssemblyTemplate;
  variableOverrides: Record<string, number>;
}

export interface DrawingItem {
  id: string;
  description: string;
  rectangles: RectangleData[];
}

export interface TemplatePrintLayoutProps {
  items: PrintableItem[];
  drawingItems?: DrawingItem[];
  contactInfo?: contactInfoSchemaType;
  logo?: string | null;
  customerContext?: {
    name?: string;
    address?: AddressInfo;
    phone?: string;
    email?: string;
  };
  onReadyToPrint?: () => void;
}

export const TemplatePrintLayout: React.FC<TemplatePrintLayoutProps> = ({
  items,
  drawingItems = [],
  contactInfo,
  logo,
  customerContext,
  onReadyToPrint,
}) => {
  const t = useTranslations("estimate");

  // Signature of templates and variable overrides to detect live edits / template switches
  const itemsSignature = useMemo(() => {
    return JSON.stringify(
      items.map((item) => ({
        id: item.id,
        templateId: item.template?.id,
        templateName: item.template?.name,
        views: (item.template?.cameraViews || []).map((v) => ({
          id: v.id,
          preset: v.preset,
          focusTargetId: v.focusTargetId,
          zoomMultiplier: v.zoomMultiplier,
        })),
        overrides: item.variableOverrides || {},
      }))
    );
  }, [items]);

  // Precompute all view keys across all items for sequential snapshotting
  const allViewKeys = useMemo(() => {
    const keys: string[] = [];
    items.forEach((item) => {
      const cameraViews = (item.template?.cameraViews || []) as CameraView[];
      if (cameraViews.length > 0) {
        const mainViews = cameraViews.filter((v) => !v.focusTargetId);
        const detailViews = cameraViews.filter((v) => v.focusTargetId);
        if (mainViews.length > 0) {
          keys.push(`${item.id}:default:${mainViews[0].id}`);
          mainViews.slice(1).forEach((v) => keys.push(`${item.id}:other:${v.id}`));
        }
        detailViews.forEach((v) => keys.push(`${item.id}:detail:${v.id}`));
        if (mainViews.length === 0 && detailViews.length === 0) {
          keys.push(`${item.id}:single`);
        }
      } else {
        keys.push(`${item.id}:single`);
      }
    });
    return keys;
  }, [items]);

  const [snapshots, setSnapshots] = useState<Record<string, string>>({});
  const [activeQueueIndex, setActiveQueueIndex] = useState<number>(0);

  // Reset snapshots and queue index whenever the template or variable overrides change
  const prevSignatureRef = useRef<string>(itemsSignature);
  useEffect(() => {
    if (prevSignatureRef.current !== itemsSignature) {
      prevSignatureRef.current = itemsSignature;
      setSnapshots({});
      setActiveQueueIndex(0);
      onReadyCalledRef.current = false;
    }
  }, [itemsSignature]);

  // Always pick the first unresolved view key so no view can ever be skipped or stuck on "Loading view..."
  const activeKey = useMemo(() => {
    return allViewKeys.find((k) => snapshots[k] === undefined) ?? allViewKeys[activeQueueIndex] ?? null;
  }, [allViewKeys, snapshots, activeQueueIndex]);

  const isReady =
    allViewKeys.length === 0 ||
    (activeQueueIndex >= allViewKeys.length && allViewKeys.every((k) => snapshots[k] !== undefined));
  const onReadyCalledRef = useRef(false);

  const handleSnapshot = useCallback((key: string, url: string) => {
    setSnapshots((prev) => ({ ...prev, [key]: url }));
    setActiveQueueIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if ((items.length > 0 || drawingItems.length > 0) && isReady && !onReadyCalledRef.current) {
      onReadyCalledRef.current = true;
      requestAnimationFrame(() => {
        onReadyToPrint?.();
      });
    }
  }, [items.length, drawingItems.length, isReady, onReadyToPrint]);

  // Fallback safety timeout scaled dynamically with view count so print dialog is never blocked indefinitely
  useEffect(() => {
    if ((items.length > 0 || drawingItems.length > 0) && allViewKeys.length > 0) {
      const timeoutDuration = Math.max(10000, allViewKeys.length * 3500);
      const timer = setTimeout(() => {
        if (!onReadyCalledRef.current) {
          console.warn("Print ready fallback triggered after timeout");
          onReadyCalledRef.current = true;
          onReadyToPrint?.();
        }
      }, timeoutDuration);
      return () => clearTimeout(timer);
    }
  }, [items.length, drawingItems.length, allViewKeys.length, onReadyToPrint]);

  // Inactivity watchdog timer: triggers fallback only if no view progress is made for 5000ms
  useEffect(() => {
    if ((items.length > 0 || drawingItems.length > 0) && allViewKeys.length > 0 && !isReady) {
      const watchdogTimer = setTimeout(() => {
        if (!onReadyCalledRef.current) {
          console.warn("Print ready watchdog triggered after 5000ms inactivity");
          onReadyCalledRef.current = true;
          onReadyToPrint?.();
        }
      }, 5000);
      return () => clearTimeout(watchdogTimer);
    }
  }, [items.length, drawingItems.length, allViewKeys.length, activeQueueIndex, isReady, onReadyToPrint]);

  const renderViewCard = (
    key: string,
    viewName: string,
    components: SlabComponent[],
    variables: Record<string, number>,
    fixedCameraView?: CameraView | null
  ) => {
    const snapshotUrl = snapshots[key];
    const isActive = key === activeKey;

    if (snapshotUrl !== undefined) {
      if (snapshotUrl === "") {
        return (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
            View unavailable
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={snapshotUrl}
          alt={viewName}
          className="w-full h-full object-contain"
        />
      );
    }

    if (isActive) {
      return (
        <StoneForgeViewer
          key={`${key}:${itemsSignature}`}
          components={components}
          variables={variables}
          printMode={true}
          fixedCameraView={fixedCameraView || undefined}
          onSnapshot={(url) => handleSnapshot(key, url)}
        />
      );
    }

    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
        <span className="text-[10px] text-gray-400">Loading view...</span>
      </div>
    );
  };

  if (items.length === 0 && drawingItems.length === 0) return null;

  const PageHeader = () => (
    <div className="pt-2 pb-0 mb-0 flex items-center justify-between">
      <EstimateHeader logo={logo} contactInfo={contactInfo} />
      <div className="text-right text-[11px] text-gray-600 leading-tight">
        <div className="font-bold text-gray-800">
          {customerContext?.name}
          {customerContext?.address?.street && (
            <span className="font-normal text-gray-500">
              {" · "}{customerContext.address.street}
              {customerContext.address.city && `, ${customerContext.address.city}`}
              {customerContext.address.state && ` ${customerContext.address.state}`}
              {customerContext.address.zipCode && ` ${customerContext.address.zipCode}`}
            </span>
          )}
        </div>
        {(customerContext?.phone || customerContext?.email) && (
          <div className="text-gray-400 text-[10px]">
            {customerContext.phone}
            {customerContext.phone && customerContext.email && " · "}
            {customerContext.email}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-200 text-black font-sans flex flex-col overflow-x-auto print:block print:bg-white print:overflow-visible">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            ::-webkit-scrollbar { display: none; }
            body, html { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
            @page { margin: 0.6cm; size: landscape; }
            .td-no-print { display: none !important; }
            .td-view-card { break-inside: avoid; }
            .td-dimensions { break-inside: avoid; }
            .td-item-header { break-after: avoid; }
            .td-item-page { page-break-after: always; break-after: page; }
            .td-item-page:last-child { page-break-after: auto; break-after: auto; }
            .td-drawing-page { page-break-before: always; break-before: page; min-height: 0 !important; height: auto !important; }
            .td-drawing-group { break-inside: avoid; }
            .td-print-container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          }
        `,
        }}
      />

      <div className="td-no-print print:hidden w-full max-w-6xl bg-blue-50 border-l-4 border-blue-400 p-2 my-4 mx-auto rounded text-xs text-blue-700 shadow-sm flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex items-center gap-2 h-9" title={t("quickPrint")} onClick={() => window.print()}>
          <Printer className="h-3 w-3" />
          {t("quickPrint")}
        </Button>
      </div>

      <div className="bg-white shadow-xl print:shadow-none mb-8 print:m-0 print:p-0 flex-shrink-0 mx-auto w-full max-w-6xl print:max-w-none print:w-full td-print-container">
        <div className="pt-1">
          {items.map((item, index) => {
            const template = item.template;
            const mergedVariables: Record<string, number> = {};

            template.variables?.forEach((v) => {
              if (v.label) mergedVariables[v.label] = v.default;
            });
            Object.entries(item.variableOverrides || {}).forEach(([id, val]) => {
              const variable = template.variables?.find((v) => v.id === id);
              if (variable?.label) mergedVariables[variable.label] = val;
            });

            const cameraViews = (template.cameraViews || []) as CameraView[];
            const mainViews = cameraViews.filter((v) => !v.focusTargetId);
            const detailViews = cameraViews.filter((v) => v.focusTargetId);

            const defaultView = mainViews.length > 0 ? mainViews[0] : null;
            const otherMainViews = mainViews.length > 0 ? mainViews.slice(1) : [];

            return (
              <React.Fragment key={item.id}>
                <div className="td-item-page px-4 pb-4 flex flex-col min-h-[680px] lg:min-h-[740px] print:min-h-[190mm] print:h-[190mm]">
                  <PageHeader />

                  <div className="border rounded overflow-hidden border-gray-300 flex-1 flex flex-col mt-2">
                    <div className="td-item-header bg-gray-100 px-3 py-1 border-b border-gray-300">
                      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                        {index + 1}. {item.description}
                      </h3>
                    </div>

                    {cameraViews.length > 0 ? (
                      <div className="bg-white p-0 flex flex-col gap-0 flex-1 min-h-0">
                        {defaultView && (
                          <div className="td-view-card relative w-full overflow-hidden min-h-0" style={{ flex: otherMainViews.length || detailViews.length ? 2 : 1 }}>
                            <div className="absolute top-0.5 left-0.5 z-10 bg-white/90 px-1 py-0 text-[9px] font-bold text-gray-500">
                              {defaultView.name}
                            </div>
                            <div className="absolute inset-0">
                              {renderViewCard(
                                `${item.id}:default:${defaultView.id}`,
                                defaultView.name,
                                template.components,
                                mergedVariables,
                                defaultView
                              )}
                            </div>
                          </div>
                        )}

                        {(otherMainViews.length > 0 || detailViews.length > 0) && (
                          <div className="min-h-0 w-full grid grid-cols-4 gap-1.5 p-1.5 border-t border-gray-200 items-stretch overflow-hidden" style={{ flex: 1 }}>
                            {otherMainViews.length > 0 && (
                              <div className={`relative min-w-0 ${detailViews.length > 0 ? 'col-span-3' : 'col-span-4'}`}>
                                <div className="absolute inset-0 flex flex-col gap-1.5">
                                  {otherMainViews.map((view) => (
                                    <div key={view.id} className="td-view-card relative border border-gray-200 rounded w-full overflow-hidden flex-1 bg-white min-h-0">
                                      <div className="absolute top-0.5 left-0.5 z-10 bg-white/90 px-1 py-px rounded text-[9px] font-bold text-gray-500 border border-gray-200">{view.name}</div>
                                      <div className="absolute inset-0">
                                        {renderViewCard(
                                          `${item.id}:other:${view.id}`,
                                          view.name,
                                          template.components,
                                          mergedVariables,
                                          view
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {detailViews.length > 0 && (
                              <div className={`relative min-w-0 ${otherMainViews.length > 0 ? 'col-span-1' : 'col-span-4'}`}>
                                <div className={`absolute inset-0 flex gap-1.5 items-stretch content-stretch ${otherMainViews.length > 0 ? 'flex-col' : 'flex-row flex-wrap justify-center'}`}>
                                  {detailViews.map((view) => (
                                    <div key={view.id} className="td-view-card relative border border-gray-200 rounded flex-1 min-w-[120px] overflow-hidden bg-white min-h-0">
                                      <div className="absolute top-0.5 left-0.5 z-10 bg-white/90 px-1 py-px rounded text-[9px] font-bold text-gray-500 border border-gray-200">{view.name}</div>
                                      <div className="absolute inset-0">
                                        {renderViewCard(
                                          `${item.id}:detail:${view.id}`,
                                          view.name,
                                          template.components,
                                          mergedVariables,
                                          view
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="td-view-card w-full h-[300px] relative overflow-hidden bg-white">
                        {renderViewCard(
                          `${item.id}:single`,
                          "Overview",
                          template.components,
                          mergedVariables,
                          null
                        )}
                      </div>
                    )}

                    <div className="td-dimensions bg-gray-50 px-3 py-1 border-t border-gray-200 flex items-center gap-3 flex-wrap">
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {t("quickPrintDimensions")}
                      </span>
                      {template.variables?.map((v) => {
                        const value = item.variableOverrides?.[v.id] ?? v.default;
                        return (
                          <span key={v.id} className="text-[11px] text-gray-700">
                            <span className="text-gray-400 uppercase text-[9px]">{v.label}</span> <span className="font-bold">{value}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Component Cut & Polish List */}
                {template.components && template.components.length > 0 && (() => {
                  const flattened = flattenComponents(template.components);
                  const rectangles: RectangleData[] = flattened.map((comp) => {
                    const L = evaluateExpression(comp.length, mergedVariables);
                    const D = evaluateExpression(comp.depth, mergedVariables);
                    const T = evaluateExpression(comp.thickness, mergedVariables);

                    const edges = comp.polishedEdges || [];

                    const isThicknessT = T <= L && T <= D;
                    const isThicknessD = D < L && D < T;
                    const isThicknessL = L < D && L < T;

                    let paperLength = D;
                    let paperWidth = L;
                    let crossTop = edges.includes('back');
                    let crossBottom = edges.includes('front');
                    let crossLeft = edges.includes('left');
                    let crossRight = edges.includes('right');

                    if (isThicknessD) {
                      // Case B: Backsplash. Cut dimensions are L x T
                      paperLength = T;
                      paperWidth = L;
                      crossTop = edges.includes('back') || edges.includes('front'); // Top edge of backsplash
                      crossBottom = false; // Bottom edge sits on countertop
                      crossLeft = edges.includes('left');
                      crossRight = edges.includes('right');
                    } else if (isThicknessL) {
                      // Case C: Z-aligned Waterfall. Cut dimensions are D x T
                      paperLength = T;
                      paperWidth = D;
                      crossTop = edges.includes('left') || edges.includes('right'); // Top edge of waterfall
                      crossBottom = false; // Bottom edge sits on floor
                      crossLeft = edges.includes('front');
                      crossRight = edges.includes('back');
                    }

                    return {
                      id: comp.id,
                      length: paperLength,
                      width: paperWidth,
                      hasCrossTop: crossTop,
                      hasCrossBottom: crossBottom,
                      hasCrossLeft: crossLeft,
                      hasCrossRight: crossRight,
                      label: comp.name,
                      groupId: null,
                      hasStroke: false
                    };
                  });

                  return (
                    <div className="td-item-page px-4 pb-4 flex flex-col print:block print:h-auto print:min-h-0">
                      <RectangleViewer
                        rectangles={rectangles}
                        header={
                          <div className="pb-2">
                            <PageHeader />
                            <div className="border rounded overflow-hidden border-gray-300 flex flex-col mt-2">
                              <div className="td-item-header bg-gray-100 px-3 py-1 flex items-center justify-between">
                                <p className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                                  {index + 1}. {item.description} - {t("componentCutPolishList")}
                                </p>
                                <span className="text-[11px] text-gray-700">
                                  {t("quickPrintDimensions")}
                                </span>
                              </div>
                            </div>
                          </div>
                        }
                      />
                    </div>
                  );
                })()}
              </React.Fragment>
            );
          })}

          {drawingItems.length > 0 && (
            <div className="td-drawing-page px-4 pb-4 flex flex-col print:block print:h-auto print:min-h-0">
              <RectangleViewer
                rectangles={drawingItems.flatMap((item) => item.rectangles.map((rect) => ({ ...rect, groupId: null })))}
                header={
                  <div className="pb-2">
                    <PageHeader />
                    <div className="border rounded overflow-hidden border-gray-300 flex flex-col mt-2">
                      <div className="td-item-header bg-gray-100 px-3 py-1 flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                          {t("itemCount", { count: drawingItems.length })}
                        </p>
                        <span className="text-[11px] text-gray-700">
                          {t("quickPrintDimensions")}
                        </span>
                      </div>
                    </div>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};