import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssemblyTemplate, AssemblyTemplateSchema } from "@backend/common/schemas/studio";
import { functions, app } from "@/lib/auth_handler";
import { fetchEntry } from "@/lib/db_handler";
import { httpsCallable } from "firebase/functions";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

const createInitialTemplate = (
  untitledName = "Untitled Assembly",
  mainCounterName = "Main Counter",
): AssemblyTemplate => ({
  id: "temp_1",
  name: untitledName,
  variables: [],
  components: [
    {
      id: "slab_1",
      type: "slab",
      name: mainCounterName,
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
});

export const INITIAL_TEMPLATE: AssemblyTemplate = createInitialTemplate();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_POLISHED_EDGES = new Set(["front", "back", "left", "right"]);
const VALID_CUTOUT_SHAPES = new Set(["rectangular", "circular", "oval"]);

const sanitizeComponent = (comp: unknown): unknown => {
  if (!isRecord(comp)) return comp;

  const sanitized: Record<string, unknown> = { ...comp };

  // Sanitize polishedEdges
  if (Array.isArray(sanitized.polishedEdges)) {
    sanitized.polishedEdges = sanitized.polishedEdges.filter(
      (e): e is string => typeof e === "string" && VALID_POLISHED_EDGES.has(e),
    );
  } else {
    delete sanitized.polishedEdges;
  }

  // Ensure cutouts is an array
  if (!Array.isArray(sanitized.cutouts)) {
    sanitized.cutouts = [];
  } else {
    sanitized.cutouts = sanitized.cutouts.map((cutout) => {
      if (!isRecord(cutout)) return cutout;
      return {
        ...cutout,
        shape:
          typeof cutout.shape === "string" && VALID_CUTOUT_SHAPES.has(cutout.shape)
            ? cutout.shape
            : "rectangular",
      };
    });
  }

  // Ensure dimensionLabels is an array if present
  if (sanitized.dimensionLabels !== undefined) {
    if (!Array.isArray(sanitized.dimensionLabels)) {
      delete sanitized.dimensionLabels;
    } else {
      sanitized.dimensionLabels = sanitized.dimensionLabels.map((lbl) => {
        if (!isRecord(lbl)) return lbl;
        const sanitizedLbl: Record<string, unknown> = { ...lbl };
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

export const sanitizeTemplate = (templateData: unknown): Record<string, unknown> | null => {
  if (!isRecord(templateData)) return null;

  const sanitized: Record<string, unknown> = { ...templateData };

  // Ensure variables is an array
  if (!Array.isArray(sanitized.variables)) {
    sanitized.variables = [];
  }

  // Ensure cameraViews is an array if present and normalize empty focusTargetId
  if (sanitized.cameraViews !== undefined) {
    if (!Array.isArray(sanitized.cameraViews)) {
      delete sanitized.cameraViews;
    } else {
      sanitized.cameraViews = sanitized.cameraViews.map((view) => {
        if (!isRecord(view)) return view;
        const nextView: Record<string, unknown> = { ...view };
        if (nextView.focusTargetId === "") {
          delete nextView.focusTargetId;
        }
        return nextView;
      });
    }
  }

  // Ensure components is an array
  if (!Array.isArray(sanitized.components)) {
    sanitized.components = [];
  } else {
    sanitized.components = sanitized.components.map(sanitizeComponent);
  }

  return sanitized;
};

interface AddLogPayload {
  jid: string;
  entryType: "template";
  entryId?: string;
  name: string;
  details: AssemblyTemplate;
  thumbnailBase64?: string;
}

interface DuplicatePayload {
  jid: string;
  entryId: string;
  entryType: "template";
}

interface CallableIdResponse {
  id?: string;
}

export const useStoneForgeData = (journalId: string | null, entryId: string | null) => {
  const { toast } = useToast();
  const t = useTranslations("studio");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [template, setTemplate] = useState<AssemblyTemplate>(() =>
    createInitialTemplate(t("untitledAssembly"), t("mainCounter")),
  );
  const [isLoading, setIsLoading] = useState(Boolean(journalId && entryId));
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedIdRef = useRef<string | null>(null);

  const showToast = useCallback(
    (message: string) => {
      toast({
        description: message,
      });
    },
    [toast],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      if (journalId && entryId) {
        if (lastSavedIdRef.current === entryId) {
          lastSavedIdRef.current = null;
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        try {
          const entry = await fetchEntry(journalId, "template", entryId);
          if (cancelled) return;
          if (entry && entry.details) {
            const sanitizedDetails = sanitizeTemplate(entry.details);
            const candidate = sanitizedDetails
              ? { ...sanitizedDetails, id: entryId }
              : null;
            const parsed = AssemblyTemplateSchema.safeParse(candidate);
            if (!parsed.success) {
              console.error("Loaded template validation failed:", parsed.error.format());
              const errors = parsed.error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
              toast({
                title: t("validationErrorTitle"),
                description: t("validationErrorDescription", { errors }),
                variant: "destructive",
              });
            } else {
              setTemplate(parsed.data);
            }
          }
        } catch (error) {
          if (cancelled) return;
          console.error("Error fetching template:", error);
          showToast(t("failedToLoadTemplate"));
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      } else {
        setTemplate(createInitialTemplate(t("untitledAssembly"), t("mainCounter")));
        setIsLoading(false);
      }
    }

    loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [journalId, entryId, showToast, toast, t]);

  const handleSaveTemplate = async (thumbnailBase64?: string) => {
    if (!journalId) {
      toast({
        title: tCommon("error"),
        description: t("noJournalId"),
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
        const addLogFunction = httpsCallable<AddLogPayload, CallableIdResponse>(
          functions,
          "addLogFn",
        );
        const isNew = template.id === "temp_1";

        if (isNew) {
          const payload: AddLogPayload = {
            jid: journalId,
            entryType: "template",
            name: finalTemplate.name,
            details: finalTemplate,
            ...(thumbnailBase64 && { thumbnailBase64 }),
          };
          const response = await addLogFunction(payload);
          const newTemplateId = response.data?.id;
          if (newTemplateId) {
            lastSavedIdRef.current = newTemplateId;
            setTemplate((prev) => ({ ...prev, id: newTemplateId }));
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.set("eid", newTemplateId);
            router.replace(`?${nextParams.toString()}`);
          }
          showToast(t("saveSuccess"));
        } else {
          const payload: AddLogPayload = {
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
        title: tCommon("error"),
        description: t("failedToSaveTemplate"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateTemplate = async () => {
    if (!journalId || template.id === "temp_1") {
      showToast(t("cannotDuplicateUnsaved"));
      return;
    }
    setIsSaving(true);
    try {
      const duplicateFn = httpsCallable<DuplicatePayload, CallableIdResponse>(
        functions,
        "duplicateEntry",
      );
      const response = await duplicateFn({
        jid: journalId,
        entryId: template.id,
        entryType: "template",
      });

      const newId = response.data?.id;
      if (newId) {
        showToast(t("duplicateSuccessReloading"));
        window.location.href = `/journal/entry?jid=${encodeURIComponent(journalId)}&eid=${encodeURIComponent(newId)}&jtype=template`;
      }
    } catch (error) {
      console.error("Error duplicating template:", error);
      showToast(t("failedToDuplicateTemplate"));
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
