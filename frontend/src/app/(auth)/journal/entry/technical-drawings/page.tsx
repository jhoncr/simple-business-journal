"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { fetchEntry, fetchJournal } from "@/lib/db_handler";
import { EstimateHeader } from "../../journal-types/estimate/subcomponents/header";
import { InvoiceDetails } from "../../journal-types/estimate/subcomponents/InvoiceDetails";
import { ContactInfo } from "../../journal-types/estimate/subcomponents/ContactInfo";
import { StoneForgeViewer } from "@/components/studio/StoneForgeViewer";
import { estimateDetailsStateSchema } from "@backend/common/schemas/estimate_schema";
import { format } from "date-fns";
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
          // Parse the entry details against the schema to ensure we have valid estimate details
          // DBentry implements EntryItf which has a `details` property where the specific state is stored
          const parsed = estimateDetailsStateSchema.safeParse(entryRes.details);
          if (parsed.success) {
            // Note: entryRes.createdAt is a Firestore Timestamp
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
    // Wait for data to load and a short delay for 3D canvases to render before printing
    if (!loading && estimateData) {
      const timer = setTimeout(() => {
        window.print();
      }, 1500); // Give Three.js some time to render
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

  // Filter items that have an attached template
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

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans max-w-4xl mx-auto">
      {/* Hide standard app UI using print media query or just rely on the clean route */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1cm; size: portrait; }
        }
      `,
        }}
      />

      <EstimateHeader
        logo={journalData.details?.logo}
        contactInfo={journalData.details?.contactInfo}
      />

      <div className="print:hidden bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-md shadow-sm">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Printing Tip:</strong> For best results, enable
              &quot;Headers and footers&quot; and &quot;Background
              graphics&quot; in your browser&apos;s print settings to ensure
              page numbers and styling appear correctly.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 mb-6 pb-2">
        <h2 className="text-2xl font-bold uppercase tracking-wider text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">
          Technical Drawings
        </h2>

        <InvoiceDetails
          entryId={entryId}
          createdDate={
            estimateData.createdAt ? new Date(estimateData.createdAt) : null
          }
          status={estimateData.status}
          handleStatusChange={() => {}} // Read-only
        />

        <div className="mt-4">
          <h3 className="font-semibold text-gray-700 text-sm mb-2">CLIENT</h3>
          <ContactInfo
            info={estimateData.customer}
            setInfo={() => {}} // Read-only
          />
        </div>
      </div>

      <div className="space-y-12">
        {printableItems.map((item: any, index: number) => {
          const template = item.attachedTemplate;
          if (!template) return null;

          // Merge default variables with overrides
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

          return (
            <div
              key={item.id}
              className="break-inside-avoid border rounded-lg overflow-hidden border-gray-200"
            >
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">
                  {index + 1}. {item.description || template.snapshot.name}
                </h3>
              </div>

              {cameraViews.length > 0 ? (
                <div
                  className={`grid gap-0 bg-white border-b border-gray-200 ${cameraViews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                >
                  {cameraViews.map((view: any) => (
                    <div
                      key={view.id}
                      className={`relative overflow-hidden ${cameraViews.length > 1 ? "min-h-[300px] border-r border-b border-gray-100" : "min-h-[400px]"}`}
                    >
                      <div className="absolute top-2 left-2 z-10 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                        {view.name}
                      </div>
                      <StoneForgeViewer
                        components={template.snapshot.components}
                        variables={mergedVariables}
                        printMode={true}
                        fixedCameraView={view}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full min-h-[400px] relative overflow-hidden bg-white border-b border-gray-200">
                  <StoneForgeViewer
                    components={template.snapshot.components}
                    variables={mergedVariables}
                    printMode={true}
                  />
                </div>
              )}

              <div className="bg-white px-4 py-4">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">
                  Dimensions & Variables
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {template.snapshot.variables.map((v: any) => {
                    const value =
                      template.variableOverrides?.[v.id] ?? v.default;
                    return (
                      <div key={v.id} className="text-sm">
                        <span className="text-gray-500 block text-xs uppercase tracking-wide">
                          {v.label}
                        </span>
                        <span className="font-medium">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
