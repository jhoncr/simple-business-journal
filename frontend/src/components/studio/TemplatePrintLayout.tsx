import React from "react";
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

interface TemplatePrintLayoutProps {
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
}

export const TemplatePrintLayout: React.FC<TemplatePrintLayoutProps> = ({
  items,
  drawingItems = [],
  contactInfo,
  logo,
  customerContext,
}) => {
  const t = useTranslations("estimate");

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
            .td-drawing-page { page-break-before: always; break-before: page; }
            .td-drawing-group { break-inside: avoid; }
          }
        `,
        }}
      />

      <div className="td-no-print print:hidden w-full max-w-[285mm] bg-blue-50 border-l-4 border-blue-400 p-2 my-4 mx-auto rounded text-xs text-blue-700 shadow-sm flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex items-center gap-2 h-9" title={t("quickPrint")} onClick={() => window.print()}>
          <Printer className="h-3 w-3" />
          {t("quickPrint")}
        </Button>
      </div>

      <div className="bg-white shadow-xl print:shadow-none mb-8 print:m-0 print:p-0 flex-shrink-0 mx-auto" style={{ width: '285mm' }}>
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
                <div className="td-item-page px-4 pb-4 flex flex-col" style={{ minHeight: '196mm' }}>
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
                              <StoneForgeViewer components={template.components} variables={mergedVariables} printMode={true} fixedCameraView={defaultView} />
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
                                        <StoneForgeViewer components={template.components} variables={mergedVariables} printMode={true} fixedCameraView={view} />
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
                                        <StoneForgeViewer components={template.components} variables={mergedVariables} printMode={true} fixedCameraView={view} />
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
                        <StoneForgeViewer components={template.components} variables={mergedVariables} printMode={true} />
                      </div>
                    )}

                    <div className="td-dimensions bg-gray-50 px-3 py-1 border-t border-gray-200 flex items-center gap-3 flex-wrap">
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {t("quickPrintDimensions")}
                      </span>
                      {template.variables?.map((v: any) => {
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
                    return {
                      id: comp.id,
                      length: D,
                      width: L,
                      hasCrossTop: edges.includes('back'),
                      hasCrossRight: edges.includes('right'),
                      hasCrossBottom: edges.includes('front'),
                      hasCrossLeft: edges.includes('left'),
                      label: comp.name,
                      groupId: null,
                      hasStroke: false
                    };
                  });

                  return (
                    <div className="td-item-page px-4 pb-4 flex flex-col print:block print:h-auto print:min-h-0" style={{ minHeight: '196mm' }}>
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
            <div className="td-drawing-page px-4 pb-4 flex flex-col" style={{ minHeight: '196mm' }}>
              <RectangleViewer
                rectangles={drawingItems.flatMap((item) => item.rectangles.map((rect) => ({ ...rect, groupId: null })))}
                header={
                  <div className="pb-2">
                    <PageHeader />
                    <div className="border rounded overflow-hidden border-gray-300 flex flex-col mt-2">
                      <div className="td-item-header bg-gray-100 px-3 py-1 flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                          {drawingItems.length} item(s)
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