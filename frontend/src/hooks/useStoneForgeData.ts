import { useState, useEffect } from "react";
import { AssemblyTemplate, AssemblyTemplateSchema } from "@backend/common/schemas/studio";
import { functions, app } from "@/lib/auth_handler";
import { fetchEntry } from "@/lib/db_handler";
import { httpsCallable } from "firebase/functions";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

export const INITIAL_TEMPLATE: AssemblyTemplate = {
  id: "temp_1",
  name: "Untitled Assembly",
  variables: [],
  components: [
    {
      id: "slab_1",
      type: "slab",
      name: "Main Counter",
      length: 228.0,
      depth: 60.0,
      thickness: 2.0,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      cutouts: [
        {
          id: "cut_1",
          shape: "rectangular",
          width: 40.0,
          depth: 30.0,
          centerX: 49.0,
          centerY: 30.0,
        },
      ],
      children: [],
    },
  ],
};

const sanitizeComponent = (comp: any): any => {
  if (!comp || typeof comp !== "object") return comp;

  const sanitized = { ...comp };

  // Sanitize polishedEdges
  if (Array.isArray(sanitized.polishedEdges)) {
    sanitized.polishedEdges = sanitized.polishedEdges.filter(
      (e: any) => e === "front" || e === "back" || e === "left" || e === "right"
    );
  } else {
    delete sanitized.polishedEdges;
  }

  // Ensure cutouts is an array
  if (!Array.isArray(sanitized.cutouts)) {
    sanitized.cutouts = [];
  } else {
    sanitized.cutouts = sanitized.cutouts.map((cutout: any) => ({
      ...cutout,
      shape: ["rectangular", "circular", "oval"].includes(cutout.shape)
        ? cutout.shape
        : "rectangular",
    }));
  }

  // Ensure dimensionLabels is an array if present
  if (sanitized.dimensionLabels !== undefined) {
    if (!Array.isArray(sanitized.dimensionLabels)) {
      delete sanitized.dimensionLabels;
    } else {
      sanitized.dimensionLabels = sanitized.dimensionLabels.map((lbl: any) => {
        const sanitizedLbl = { ...lbl };
        if (sanitizedLbl.type !== "dimension_label") {
          sanitizedLbl.type = "dimension_label";
        }
        return sanitizedLbl;
      });
    }
  }

  // Recursively sanitize children
  if (Array.isArray(sanitized.children)) {
    sanitized.children = sanitized.children.map(sanitizeComponent);
  } else {
    sanitized.children = [];
  }

  return sanitized;
};

const sanitizeTemplate = (templateData: any): any => {
  if (!templateData || typeof templateData !== "object") return templateData;

  const sanitized = { ...templateData };

  // Ensure variables is an array
  if (!Array.isArray(sanitized.variables)) {
    sanitized.variables = [];
  }

  // Ensure cameraViews is an array if present
  if (sanitized.cameraViews !== undefined && !Array.isArray(sanitized.cameraViews)) {
    delete sanitized.cameraViews;
  }

  // Ensure components is an array
  if (!Array.isArray(sanitized.components)) {
    sanitized.components = [];
  } else {
    sanitized.components = sanitized.components.map(sanitizeComponent);
  }

  return sanitized;
};

export const useStoneForgeData = (journalId: string | null, entryId: string | null) => {
  const [template, setTemplate] = useState<AssemblyTemplate>(INITIAL_TEMPLATE);
  const [isLoading, setIsLoading] = useState(!!entryId);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const t = useTranslations("studio");

  const showToast = (message: string) => {
    toast({
      description: message,
    });
  };

  useEffect(() => {
    async function loadTemplate() {
      if (journalId && entryId) {
        try {
          const entry = await fetchEntry(journalId, "template", entryId);
          if (entry && entry.details) {
            const sanitizedDetails = sanitizeTemplate(entry.details);
            setTemplate({
              ...sanitizedDetails,
              id: entryId,
            });
          }
        } catch (error) {
          console.error("Error fetching template:", error);
          showToast("Failed to load existing template.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalId, entryId]);

  const handleSaveTemplate = async (thumbnailBase64?: string) => {
    if (!journalId) {
      toast({
        title: "Error",
        description: "Cannot save: No journal ID provided in URL",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const finalTemplate = { ...template };

      // Validate the template model client-side before sending to Cloud Function
      const validation = AssemblyTemplateSchema.safeParse(finalTemplate);
      if (!validation.success) {
        console.error("Template validation failed:", validation.error.format());

        // Construct a structured, readable error message
        const errors = validation.error.errors
          .map((err) => {
            const path = err.path.join(".");
            return `${path}: ${err.message}`;
          })
          .join("\n");

        toast({
          title: t("validationErrorTitle"),
          description: t("validationErrorDescription", { errors }),
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      const auth = getAuth(app);
      if (!auth.currentUser) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }

      if (auth.currentUser) {
        const addLogFunction = httpsCallable(functions, "addLogFn");
        const isNew = template.id === "temp_1";

        if (isNew) {
          const payload = {
            jid: journalId,
            entryType: "template",
            name: finalTemplate.name,
            details: finalTemplate,
            ...(thumbnailBase64 && { thumbnailBase64 }),
          };
          const response = await addLogFunction(payload);
          const newTemplateId = (response.data as any).id;
          setTemplate((prev) => ({ ...prev, id: newTemplateId }));
          showToast(t("saveSuccess"));
        } else {
          const payload = {
            jid: journalId,
            entryType: "template",
            entryId: finalTemplate.id,
            name: finalTemplate.name,
            details: finalTemplate,
            ...(thumbnailBase64 && { thumbnailBase64 }),
          };
          await addLogFunction(payload);
          showToast(t("updateSuccess"));
        }
      }
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateTemplate = async () => {
    if (!journalId || template.id === "temp_1") {
      showToast("Cannot duplicate: Save the template first or provide a journal ID");
      return;
    }
    setIsSaving(true);
    try {
      const duplicateFn = httpsCallable(functions, "duplicateEntry");
      const response = await duplicateFn({
        jid: journalId,
        entryId: template.id,
        entryType: "template",
      });

      const newId = (response.data as any).id;
      if (newId) {
        showToast("Template duplicated! Reloading with new design...");
        window.location.href = `/journal/entry?jid=${journalId}&eid=${newId}&jtype=template`;
      }
    } catch (error) {
      console.error("Error duplicating template:", error);
      showToast("Failed to duplicate template.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    template,
    setTemplate,
    isLoading,
    isSaving,
    showToast,
    handleSaveTemplate,
    handleDuplicateTemplate,
  };
};
