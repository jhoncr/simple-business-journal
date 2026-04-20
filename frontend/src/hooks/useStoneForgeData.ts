import { useState, useEffect } from "react";
import { AssemblyTemplate } from "@backend/common/schemas/studio";
import { functions, app } from "@/lib/auth_handler";
import { fetchEntry } from "@/lib/db_handler";
import { httpsCallable } from "firebase/functions";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

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

export const useStoneForgeData = (journalId: string | null, entryId: string | null) => {
  const [template, setTemplate] = useState<AssemblyTemplate>(INITIAL_TEMPLATE);
  const [isLoading, setIsLoading] = useState(!!entryId);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    async function loadTemplate() {
      if (journalId && entryId) {
        try {
          const entry = await fetchEntry(journalId, "template", entryId);
          if (entry && entry.details) {
            setTemplate({
              ...(entry.details as any),
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
  }, [journalId, entryId]);

  const handleSaveTemplate = async (thumbnailBase64?: string) => {
    if (!journalId) {
      showToast("Cannot save: No journal ID provided in URL");
      return;
    }
    setIsSaving(true);
    try {
      const finalTemplate = { ...template };
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
          showToast("Template saved successfully!");
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
          showToast("Template updated successfully!");
        }
      }
    } catch (error) {
      console.error("Error saving template:", error);
      showToast("Failed to save template. Please try again.");
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
    toastMessage,
    showToast,
    handleSaveTemplate,
    handleDuplicateTemplate,
  };
};
