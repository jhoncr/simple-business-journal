"use client";

import React from "react";
import { ChevronLeft, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";

export const TemplateDetails = ({ journalId, entryId }: { journalId: string, entryId?: string }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-4">
      <div className="flex justify-between items-center rounded-lg border p-6 bg-card">
        <div className="flex flex-col gap-2">
           <h2 className="text-2xl font-bold flex items-center gap-2">
             <Box /> Template Options
           </h2>
           <p className="text-muted-foreground">This template can be viewed and edited inside the Studio interface.</p>
        </div>
        <Button asChild variant="default">
          <Link href={`/studio?jid=${journalId}`}>Open in Studio</Link>
        </Button>
      </div>

      <div className="flex justify-start items-center mt-6">
        <Button variant="outline" asChild size="sm">
          <Link href={`/journal?jid=${journalId}&jtype=template`}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back to List
          </Link>
        </Button>
      </div>
    </div>
  );
}

export const AddNewTemplateBtn = ({ journalId }: { journalId: string }) => {
  return (
    <div>
      <Button variant="brutalist" className="mb-4" asChild>
        <Link href={`/studio?jid=${journalId}`}>
          Create Template
        </Link>
      </Button>
    </div>
  );
};
