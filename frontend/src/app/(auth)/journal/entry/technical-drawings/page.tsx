"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { fetchEntry, fetchJournal } from "@/lib/db_handler";
import { LineItem, estimateDetailsStateSchema } from "@backend/common/schemas/estimate_schema";
import { TemplatePrintLayout, PrintableItem, DrawingItem } from "@/components/studio/TemplatePrintLayout";
import { RectangleData } from "@/components/RectangleViewer";

/**
 * Converts dimension values from meters (stored in Firestore line items)
 * to centimeters (required by RectangleViewer technical drawings).
 */
export function metersToCentimeters(meters?: number | null): number {
  if (meters == null || isNaN(meters)) return 0;
  return Math.round(meters * 100);
}

export default function TechnicalDrawingsPrintLayout() {
  const t = useTranslations("technicalDrawings");
  const searchParams = useSearchParams();
  const journalId = searchParams.get("jid");
  const entryId = searchParams.get("eid");

  const [loading, setLoading] = useState(true);
  const [estimateData, setEstimateData] = useState<any>(null);
  const [journalData, setJournalData] = useState<any>(null);
  const hasPrintedRef = useRef(false);

  const handleReadyToPrint = useCallback(() => {
    if (hasPrintedRef.current) return;
    hasPrintedRef.current = true;
    if (typeof window !== "undefined" && typeof window.print === "function") {
      requestAnimationFrame(() => {
        window.print();
      });
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!journalId || !entryId) {
        setLoading(false);
        return;
      }

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

  if (loading) {
    return (
      <div className="p-10 text-center">{t("loading")}</div>
    );
  }

  if (!estimateData || !journalData) {
    return (
      <div className="p-10 text-center text-red-600">{t("failedToLoad")}</div>
    );
  }

  // Section 1: 3D template items
  const printableItems: PrintableItem[] = (estimateData.confirmedItems || [])
    .filter((item: LineItem) => item.attachedTemplate != null)
    .map((item: LineItem) => ({
      id: item.id,
      description: item.description || item.attachedTemplate!.snapshot.name,
      template: item.attachedTemplate!.snapshot,
      variableOverrides: item.attachedTemplate!.variableOverrides || {},
    }));

  // Section 2: Window Sill / Tile Edge drawing items
  const drawingItems: DrawingItem[] = (estimateData.confirmedItems || [])
    .filter((item: LineItem) =>
      item.itemCategory === "window-sill" || item.itemCategory === "tile-edge"
    )
    .map((item: LineItem) => {
      const width = metersToCentimeters(item.dimensions?.width);
      const length = metersToCentimeters(item.dimensions?.length);
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
        {t("noDrawingsFound")}
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
      onReadyToPrint={handleReadyToPrint}
    />
  );
}

