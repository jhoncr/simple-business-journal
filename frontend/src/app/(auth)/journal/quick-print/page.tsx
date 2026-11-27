"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { TemplateGalleryModal } from "../journal-types/estimate/subcomponents/TemplateGalleryModal";
import { DBentry } from "@/lib/custom_types";
import { AssemblyTemplate, AssemblyTemplateSchema } from "@backend/common/schemas/studio";
import { TemplatePrintLayout, PrintableItem } from "@/components/studio/TemplatePrintLayout";
import { Button } from "@/components/ui/button";
import { Printer, Settings2 } from "lucide-react";
import { StoneForgeVariableEditor } from "@/components/studio/StoneForgeVariableEditor";
import { useTranslations } from "next-intl";
import { useJournalContext } from "@/context/JournalContext";
import { useToast } from "@/hooks/use-toast";
import { sanitizeTemplate } from "@/hooks/useStoneForgeData";

export default function QuickPrintPage() {
  const searchParams = useSearchParams();
  const journalId = searchParams.get("jid") || "";
  const t = useTranslations("estimate");
  const tStudio = useTranslations("studio");
  const { journal } = useJournalContext();
  const { toast } = useToast();

  const [selectedTemplate, setSelectedTemplate] = useState<AssemblyTemplate | null>(null);
  const [variableOverrides, setVariableOverrides] = useState<Record<string, number>>({});
  const [debouncedOverrides, setDebouncedOverrides] = useState<Record<string, number>>({});
  const [isPrintReady, setIsPrintReady] = useState<boolean>(false);

  // Debounce variable edits (300ms) to avoid thrashing WebGL contexts on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOverrides(variableOverrides);
    }, 300);
    return () => clearTimeout(timer);
  }, [variableOverrides]);

  const handleTemplateSelect = (entry: DBentry) => {
    const sanitized = sanitizeTemplate(entry.details);
    const candidate = sanitized
      ? { ...sanitized, id: sanitized.id || entry.id }
      : null;
    const parsed = AssemblyTemplateSchema.safeParse(candidate);
    if (!parsed.success) {
      console.error("Quick print template validation failed:", parsed.error.format());
      const errors = parsed.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
      toast({
        title: tStudio("validationErrorTitle"),
        description: tStudio("validationErrorDescription", { errors }),
        variant: "destructive",
      });
      return;
    }

    setSelectedTemplate(parsed.data);
    setVariableOverrides({}); // Reset overrides on new template selection
    setDebouncedOverrides({});
    setIsPrintReady(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const printableItems: PrintableItem[] = useMemo(() => {
    if (!selectedTemplate) return [];
    return [
      {
        id: "quick-print-item-1",
        description: selectedTemplate.name || tStudio("sandboxDesign"),
        template: selectedTemplate,
        variableOverrides: debouncedOverrides,
      },
    ];
  }, [selectedTemplate, debouncedOverrides, tStudio]);

  if (!selectedTemplate) {
    return (
      <div className="max-w-2xl mx-auto p-10 mt-10 text-center border border-dashed rounded-lg bg-background">
        <h2 className="text-2xl font-bold mb-4">{t("quickPrintSandbox")}</h2>
        <p className="text-muted-foreground mb-6">
          {t("quickPrintSandboxDescription")}
        </p>
        <div className="w-64 mx-auto">
          <TemplateGalleryModal journalId={journalId} onSelectTemplate={handleTemplateSelect} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-gray-100 print:h-auto print:overflow-visible print:block print:bg-white">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="print:hidden flex items-center justify-between p-4 bg-white border-b shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-lg">{selectedTemplate.name}</h1>
          <TemplateGalleryModal journalId={journalId} onSelectTemplate={handleTemplateSelect} />
        </div>
        <Button onClick={handlePrint} disabled={!isPrintReady}>
          <Printer className="w-4 h-4 mr-2" />
          {t("printDrawing")}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden print:overflow-visible print:h-auto print:block">
        {/* Sidebar Configuration (Hidden when printing) */}
        <div className="print:hidden w-80 bg-white border-r p-4 overflow-y-auto flex-shrink-0">
          <div className="flex items-center gap-2 mb-4 text-muted-foreground font-semibold uppercase text-sm">
            <Settings2 className="w-4 h-4" /> {t("quickPrintDimensions")}
          </div>
          <StoneForgeVariableEditor
            template={selectedTemplate}
            overrides={variableOverrides}
            onVariableChange={(id, val) => setVariableOverrides(prev => ({ ...prev, [id]: val }))}
            showFooterHint={false}
          />
        </div>

        {/* Live Preview / Print Target */}
        <div className="flex-1 overflow-y-auto print:overflow-visible bg-gray-200 print:bg-white print:h-auto print:block">
          <TemplatePrintLayout
            items={printableItems}
            contactInfo={journal?.details?.contactInfo}
            logo={journal?.details?.logo}
            hidePrintBanner={true}
            onReadyStateChange={setIsPrintReady}
          />
        </div>
      </div>
    </div>
  );
}
