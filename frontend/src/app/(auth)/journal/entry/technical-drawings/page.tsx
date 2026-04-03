"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchEntry, fetchJournal } from "@/lib/db_handler";
import { EstimateHeader } from "../../journal-types/estimate/subcomponents/header";
import { StoneForgeViewer } from "@/components/studio/StoneForgeViewer";
import { estimateDetailsStateSchema } from "@backend/common/schemas/estimate_schema";
import { AlertCircle } from "lucide-react";

export default function TechnicalDrawingsPrintLayout() {
  const searchParams = useSearchParams();
  const journalId = searchParams.get("jid");
  const entryId = searchParams.get("eid");

  const [loading, setLoading] = useState(true);
  const [estimateData, setEstimateData] = useState<any>(null);
  const [journalData, setJournalData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      if (!journalId || !entryId) return;

      try {
        const [entryRes, journalRes] = await Promise.all([
          fetchEntry(journalId, "estimate", entryId),
          fetchJournal(journalId),
        ]);

        if (entryRes) {
          const parsed = estimateDetailsStateSchema.safeParse(entryRes.details);
          if (parsed.success) {
            setEstimateData({
              ...parsed.data,
              createdAt: entryRes.createdAt?.toDate
                ? entryRes.createdAt.toDate().toISOString()
                : new Date().toISOString(),
            });
          } else {
            console.error("Failed to parse estimate data", parsed.error);
          }
        }

        if (journalRes) {
          setJournalData(journalRes);
        }
      } catch (err) {
        console.error("Failed to fetch data for technical drawings", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [journalId, entryId]);

  useEffect(() => {
    if (!loading && estimateData) {
      const timer = setTimeout(() => {
        window.print();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, estimateData]);

  if (loading) {
    return (
      <div className="p-10 text-center">Loading technical drawings...</div>
    );
  }

  if (!estimateData || !journalData) {
    return (
      <div className="p-10 text-center text-red-600">Failed to load data.</div>
    );
  }

  const printableItems = estimateData.confirmedItems.filter(
    (item: any) => item.attachedTemplate != null,
  );

  if (printableItems.length === 0) {
    return (
      <div className="p-10 text-center">
        No items with technical drawings found in this estimate.
      </div>
    );
  }

  const customer = estimateData.customer;

  return (
    <div className="min-h-screen bg-gray-200 text-black font-sans flex flex-col items-center overflow-x-auto print:block print:bg-white print:overflow-visible">
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
          }
        `,
        }}
      />

      {/* Non-print tip */}
      <div className="td-no-print print:hidden w-full max-w-[285mm] bg-blue-50 border-l-4 border-blue-400 p-2 my-4 mx-auto rounded text-xs text-blue-700 shadow-sm">
        <AlertCircle className="h-3 w-3 inline mr-1" />
        <strong>Tip:</strong> Enable &quot;Background graphics&quot; in print settings.
      </div>

      <div className="bg-white shadow-xl print:shadow-none mb-8 print:m-0 print:p-0 flex-shrink-0" style={{ width: '285mm' }}>
        {/* Items */}
        <div className="pt-1">
          {printableItems.map((item: any, index: number) => {
            const template = item.attachedTemplate;
            if (!template) return null;

            const mergedVariables: Record<string, number> = {};
            template.snapshot.variables.forEach((v: any) => {
              if (v.label) {
                mergedVariables[v.label] = v.default;
              }
            });

            if (template.variableOverrides) {
              Object.entries(template.variableOverrides).forEach(
                ([id, value]) => {
                  const variable = template.snapshot.variables.find(
                    (v: any) => v.id === id,
                  );
                  if (variable && variable.label) {
                    mergedVariables[variable.label] = value as number;
                  }
                },
              );
            }

            const cameraViews = template.snapshot.cameraViews || [];
            // Separate main views (full scene) from detail views (focused on specific component)
            const mainViews = cameraViews.filter((v: any) => !v.focusTargetId);
            const detailViews = cameraViews.filter((v: any) => v.focusTargetId);

            const defaultView = mainViews.length > 0 ? mainViews[0] : null;
            const otherMainViews = mainViews.length > 0 ? mainViews.slice(1) : [];

            return (
              <div key={item.id} className="td-item-page px-4 pb-4 flex flex-col" style={{ minHeight: '196mm' }}>
                {/* Header repeated for each page/item */}
                <div className="pt-2 pb-0 mb-0">
                  <div className="flex items-center justify-between">
                    <EstimateHeader
                      logo={journalData.details?.logo}
                      contactInfo={journalData.details?.contactInfo}
                    />
                    {/* Inline compact client info — 2 lines max */}
                    <div className="text-right text-[11px] text-gray-600 leading-tight">
                      <div className="font-bold text-gray-800">
                        {customer?.name}
                        {customer?.address?.street && (
                          <span className="font-normal text-gray-500">
                            {" · "}{customer.address.street}
                            {customer.address.city && `, ${customer.address.city}`}
                            {customer.address.state && ` ${customer.address.state}`}
                            {customer.address.zipCode && ` ${customer.address.zipCode}`}
                          </span>
                        )}
                      </div>
                      {(customer?.phone || customer?.email) && (
                        <div className="text-gray-400 text-[10px]">
                          {customer.phone}{customer.phone && customer.email && " · "}{customer.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="border rounded overflow-hidden border-gray-300 flex-1 flex flex-col"
                >
                  {/* Item title bar */}
                  <div className="td-item-header bg-gray-100 px-3 py-1 border-b border-gray-300">
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                      {index + 1}. {item.description || template.snapshot.name}
                    </h3>
                  </div>

                  {/* Camera views */}
                  {cameraViews.length > 0 ? (
                    <div className="bg-white p-0 flex flex-col gap-0 flex-1">
                      {/* Default View — Gets the most space, full width */}
                      {defaultView && (() => {
                        const hasCropBox = defaultView.cropBox && defaultView.cropBox.width > 0 && defaultView.cropBox.height > 0;
                        return (
                          <div
                            key={defaultView.id}
                            className="td-view-card relative w-full overflow-hidden"
                            style={{
                              height: hasCropBox ? 'auto' : '300px',
                              minHeight: hasCropBox ? undefined : '220px',
                              aspectRatio: hasCropBox
                                ? `${defaultView.cropBox.width} / ${defaultView.cropBox.height}`
                                : undefined
                            }}
                          >
                            <div className="absolute top-0.5 left-0.5 z-10 bg-white/90 px-1 py-0 text-[9px] font-bold text-gray-500">
                              {defaultView.name}
                            </div>
                            <StoneForgeViewer
                              components={template.snapshot.components}
                              variables={mergedVariables}
                              printMode={true}
                              fixedCameraView={defaultView}
                            />
                          </div>
                        );
                      })()}

                      {/* Secondary Views Row — Side by side to save space and make them smaller */}
                      {(otherMainViews.length > 0 || detailViews.length > 0) && (
                        <div className="grid grid-cols-4 gap-1.5 w-full items-start">
                          {/* Other main views — smaller width, col-span-3 */}
                          {otherMainViews.length > 0 && (
                            <div className={`flex flex-col gap-1.5 min-w-0 ${detailViews.length > 0 ? 'col-span-3' : 'col-span-4'}`}>
                              {otherMainViews.map((view: any) => {
                                const hasCropBox = view.cropBox && view.cropBox.width > 0 && view.cropBox.height > 0;
                                return (
                                  <div
                                    key={view.id}
                                    className="td-view-card relative border border-gray-200 rounded w-full overflow-hidden"
                                    style={{
                                      height: hasCropBox ? 'auto' : '200px',
                                      minHeight: hasCropBox ? undefined : '140px',
                                      aspectRatio: hasCropBox
                                        ? `${view.cropBox.width} / ${view.cropBox.height}`
                                        : undefined
                                    }}
                                  >
                                    <div className="absolute top-0.5 left-0.5 z-10 bg-white/90 px-1 py-px rounded text-[9px] font-bold text-gray-500 border border-gray-200">
                                      {view.name}
                                    </div>
                                    <StoneForgeViewer
                                      components={template.snapshot.components}
                                      variables={mergedVariables}
                                      printMode={true}
                                      fixedCameraView={view}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Detail views — smallest width, col-span-1 */}
                          {detailViews.length > 0 && (
                            <div className={`flex flex-row flex-wrap gap-1.5 min-w-0 ${otherMainViews.length > 0 ? 'col-span-1' : 'col-span-4 justify-center mx-auto w-full'}`}>
                              {detailViews.map((view: any) => {
                                const hasCropBox = view.cropBox && view.cropBox.width > 0 && view.cropBox.height > 0;
                                return (
                                  <div
                                    key={view.id}
                                    className="td-view-card relative border border-gray-200 rounded flex-1 min-w-[120px] overflow-hidden"
                                    style={{
                                      height: hasCropBox ? 'auto' : '150px',
                                      minHeight: hasCropBox ? undefined : '100px',
                                      aspectRatio: hasCropBox
                                        ? `${view.cropBox.width} / ${view.cropBox.height}`
                                        : '4/3'
                                    }}
                                  >
                                    <div className="absolute top-0.5 left-0.5 z-10 bg-white/90 px-1 py-px rounded text-[9px] font-bold text-gray-500 border border-gray-200">
                                      {view.name}
                                    </div>
                                    <StoneForgeViewer
                                      components={template.snapshot.components}
                                      variables={mergedVariables}
                                      printMode={true}
                                      fixedCameraView={view}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="td-view-card w-full h-[300px] relative overflow-hidden bg-white">
                      <StoneForgeViewer
                        components={template.snapshot.components}
                        variables={mergedVariables}
                        printMode={true}
                      />
                    </div>
                  )}

                  {/* Dimensions — compact inline strip */}
                  <div className="td-dimensions bg-gray-50 px-3 py-1 border-t border-gray-200 flex items-center gap-3 flex-wrap">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Dimensions:
                    </span>
                    {template.snapshot.variables.map((v: any) => {
                      const value =
                        template.variableOverrides?.[v.id] ?? v.default;
                      return (
                        <span key={v.id} className="text-[11px] text-gray-700">
                          <span className="text-gray-400 uppercase text-[9px]">{v.label}</span>
                          {" "}
                          <span className="font-bold">{value}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
