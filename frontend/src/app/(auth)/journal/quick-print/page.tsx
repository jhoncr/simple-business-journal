"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TemplateGalleryModal } from "../journal-types/estimate/subcomponents/TemplateGalleryModal";
import { DBentry } from "@/lib/custom_types";
import { AssemblyTemplate } from "@backend/common/schemas/studio";
import { TemplatePrintLayout, PrintableItem } from "@/components/studio/TemplatePrintLayout";
import { Button } from "@/components/ui/button";
import { Printer, Settings2 } from "lucide-react";
import { StoneForgeVariableEditor } from "@/components/studio/StoneForgeVariableEditor";
import { useTranslations } from "next-intl";
import { useJournalContext } from "@/context/JournalContext";

export default function QuickPrintPage() {
  const searchParams = useSearchParams();
  const journalId = searchParams.get("jid") || "";
  const t = useTranslations("estimate");
  const { journal } = useJournalContext();

  const [selectedTemplate, setSelectedTemplate] = useState<AssemblyTemplate | null>(null);
  const [variableOverrides, setVariableOverrides] = useState<Record<string, number>>({});

  const handleTemplateSelect = (entry: DBentry) => {
    const templateData = entry.details as AssemblyTemplate;
    setSelectedTemplate(templateData);
    setVariableOverrides({}); // Reset overrides on new template selection
  };

  const handlePrint = () => {
    window.print();
  };

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

  // Map state to the Print Layout interface
  const printableItems: PrintableItem[] = [
    {
      id: "quick-print-item-1",
      description: selectedTemplate.name || "Sandbox Design",
      template: selectedTemplate,
      variableOverrides: variableOverrides,
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-gray-100 print:h-auto print:overflow-visible print:block print:bg-white">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="print:hidden flex items-center justify-between p-4 bg-white border-b shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-lg">{selectedTemplate.name}</h1>
          <TemplateGalleryModal journalId={journalId} onSelectTemplate={handleTemplateSelect} />
        </div>
        <Button onClick={handlePrint}>
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
          />
        </div>

        {/* Live Preview / Print Target */}
        <div className="flex-1 overflow-y-auto print:overflow-visible bg-gray-200 print:bg-white print:h-auto print:block">
          <TemplatePrintLayout
            items={printableItems}
            contactInfo={journal?.details?.contactInfo}
            logo={journal?.details?.logo}
          />
        </div>
      </div>
    </div>
  );
}
