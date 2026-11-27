// frontend/src/app/(auth)/journal/actions/delete-entry.tsx
import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  // DialogFooter, // Removed as custom buttons are used
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as z from "zod";
import { httpsCallable } from "firebase/functions";
import { Trash } from "lucide-react";
import { functions } from "@/lib/auth_handler"; // Import configured functions
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { useTranslations } from "next-intl";
// --- Import EntryType and ENTRY_CONFIG keys ---
import {
  EntryType,
  entryTypeSchema,
} from "@backend/common/schemas/configmap"; // Import EntryType
// import { ENTRY_CONFIG } from "@backend/common/const"; // Use backend const

// --- Updated Backend Function Call ---
const deleteEntryFn = httpsCallable(functions, "deleteEntry", {
  // Renamed variable for clarity
  limitedUseAppCheckTokens: true,
});

// --- Updated Zod Schema ---
const deleteEntrySchema = z.object({
  jid: z.string().min(1), // Use journalId for clarity
  entryId: z.string().min(1),
  entryType: entryTypeSchema, // Validate against known entry types
});

type DeletePayload = z.infer<typeof deleteEntrySchema>;

interface DeleteEntryBtnProps {
  journalId: string; // Use journalId
  entryId: string;
  entryType: EntryType; // --- ADD entryType prop ---
  entryName?: string; // Optional name for confirmation message
  onDeleted: () => void;
}

export function DeleteEntryBtn({
  journalId,
  entryId,
  entryType,
  entryName,
  onDeleted,
}: DeleteEntryBtnProps) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const t = useTranslations("journal");
  const displayEntryName = entryName || t("thisItem");

  const onSubmit = async () => {
    setPending(true);

    const payload: DeletePayload = { jid: journalId, entryId, entryType };
    const validation = deleteEntrySchema.safeParse(payload);
    if (!validation.success) {
      console.error("Invalid delete payload:", validation.error.format());
      toast({
        title: t("error"),
        description: t("invalidData"),
        variant: "destructive",
      });
      setPending(false);
      return;
    }

    try {
      await deleteEntryFn(validation.data);
      setOpen(false);
      toast({
        title: t("entryDeleted"),
        description: t("entryDeletedSuccess", { entryName: displayEntryName }),
      });
      onDeleted();
    } catch (error: unknown) {
      console.error("Error during deletion call:", error);
      const message = error instanceof Error ? error.message : t("couldNotDelete");
      toast({
        title: t("deletionFailed"),
        description: message || t("couldNotDelete"),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="p-0 h-auto font-normal text-destructive hover:text-destructive/90 w-full justify-start"
        >
          <Trash className="h-4 w-4 inline mr-2" />
          {t("deleteEntry")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("confirmDeletion")}</DialogTitle>
          <DialogDescription>
            {t("confirmDeletionMessage", { entryName: displayEntryName })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-4">
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={onSubmit} disabled={pending}>
            {pending ? t("deleting") : t("deleteEntry")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
