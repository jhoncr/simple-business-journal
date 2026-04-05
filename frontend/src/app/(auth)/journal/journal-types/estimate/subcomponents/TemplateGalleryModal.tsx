import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Box, Loader2 } from "lucide-react";
import { useFetchEntries } from "../../../comp/useFetch";
import Image from "next/image";
import { AssemblyTemplate } from "@backend/common/schemas/studio";
import { DBentry } from "@/lib/custom_types";

interface TemplateGalleryModalProps {
  journalId: string;
  onSelectTemplate: (templateEntry: DBentry) => void;
  disabled?: boolean;
}

export function TemplateGalleryModal({ journalId, onSelectTemplate, disabled }: TemplateGalleryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { list: templates, loading, error } = useFetchEntries(journalId, "template");

  const handleSelect = (templateEntry: DBentry) => {
    onSelectTemplate(templateEntry);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          className="w-full gap-2"
        >
          <Box size={16} /> Add from Gallery
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Template Gallery</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">
              Failed to load templates: {error}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Box className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No templates found in this journal.</p>
              <p className="text-sm mt-2">Go to the Journal to create your first template.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {templates.map((templateEntry) => {
                const template = templateEntry.details as AssemblyTemplate;
                return (
                  <div
                    key={templateEntry.id}
                    className="border rounded-lg p-4 cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors flex flex-col group"
                    onClick={() => handleSelect(templateEntry)}
                  >
                    <div className="bg-secondary/30 rounded-md h-32 w-full mb-3 flex items-center justify-center relative overflow-hidden">
                       {template.thumbnailUrl ? (
                         <Image
                           src={template.thumbnailUrl}
                           alt={template.name || templateEntry.name || "Template thumbnail"}
                           fill
                           className="object-cover"
                           sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                         />
                       ) : (
                         <Box className="h-10 w-10 text-muted-foreground/40 group-hover:text-primary/40 transition-colors z-10" />
                       )}
                    </div>
                    <h3 className="font-semibold text-sm truncate" title={template.name || templateEntry.name}>
                      {template.name || templateEntry.name || "Untitled Template"}
                    </h3>
                    <div className="flex justify-between items-center mt-auto pt-2">
                       <span className="text-xs text-muted-foreground">
                         {template.components?.length || 0} component(s)
                       </span>
                       <Button size="sm" variant="secondary" className="h-7 text-xs">
                         Select
                       </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
