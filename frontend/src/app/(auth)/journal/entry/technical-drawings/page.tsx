"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchEntry, fetchJournal } from "@/lib/db_handler";
import { estimateDetailsStateSchema } from "@backend/common/schemas/estimate_schema";
import { TemplatePrintLayout, PrintableItem, DrawingItem } from "@/components/studio/TemplatePrintLayout";
import { RectangleData } from "@/components/RectangleViewer";

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

  // Section 1: 3D template items
  const printableItems: PrintableItem[] = estimateData.confirmedItems
    .filter((item: any) => item.attachedTemplate != null)
    .map((item: any) => ({
      id: item.id,
      description: item.description || item.attachedTemplate.snapshot.name,
      template: item.attachedTemplate.snapshot,
      variableOverrides: item.attachedTemplate.variableOverrides || {},
    }));

  // Section 2: Window Sill / Tile Edge drawing items
  const drawingItems: DrawingItem[] = estimateData.confirmedItems
    .filter((item: any) =>
      item.itemCategory === "window-sill" || item.itemCategory === "tile-edge"
    )
    .map((item: any) => {
      const SCALER = 100; // TODO: remote this in the future, this is a workaround to the fact that NewItemForm is in meters
      const width = Math.round((item.dimensions?.width ?? 0) * SCALER);
      const length = Math.round((item.dimensions?.length ?? 0) * SCALER);
      const isWindowSill = item.itemCategory === "window-sill";

      const rect: RectangleData = {
        id: item.id,
        width,
        length,
        label: item.description,
        hasCrossLeft: true,
        hasLeftCornerCrosses: isWindowSill,
        hasStroke: isWindowSill,
      };

      return {
        id: item.id,
        description: item.description,
        rectangles: [rect],
      };
    });

  if (printableItems.length === 0 && drawingItems.length === 0) {
    return (
      <div className="p-10 text-center">
        No items with technical drawings found in this estimate.
      </div>
    );
  }

  return (
    <TemplatePrintLayout
      items={printableItems}
      drawingItems={drawingItems}
      contactInfo={journalData.details?.contactInfo}
      logo={journalData.details?.logo}
      customerContext={estimateData.customer}
    />
  );
}
