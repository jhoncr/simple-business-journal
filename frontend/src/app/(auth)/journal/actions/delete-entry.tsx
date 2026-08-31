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
import { getFunctions, httpsCallable } from "firebase/functions";
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
  entryType, // Get entryType from props
  entryName = "this item", // Default name
  onDeleted,
}: DeleteEntryBtnProps) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const t = useTranslations("journal");

  const onSubmit = async () => {
    console.log(
      `Deleting entry ${entryId} of type ${entryType} in journal ${journalId}`,
    );
    setPending(true);

    const payload: DeletePayload = { jid: journalId, entryId, entryType };

    // --- Validate payload client-side (optional but good practice) ---
    const validation = deleteEntrySchema.safeParse(payload);
    if (!validation.success) {
      console.error("Invalid delete payload:", validation.error.format());
      toast({
        title: t("error"),
        description: t("invalidData"),
        variant: "destructive",
      });
      setPending(false);
      return; // Don't proceed
    }

    try {
      // Close the dialog first visually
      setOpen(false);

      // Call backend function after a short delay (allows dialog to close smoothly)
      // You might adjust delay or remove if closing animation isn't critical
      setTimeout(async () => {
        try {
          console.log("Calling deleteEntryFn with payload:", validation.data);
          await deleteEntryFn(validation.data); // Send validated data

          toast({
            title: t("entryDeleted"),
            description: t("entryDeletedSuccess", { entryName }),
          });

          onDeleted(); // Call the callback provided by the parent
        } catch (error: any) {
          console.error("Error during deletion call:", error);
          toast({
            title: t("deletionFailed"),
            description: error.message || t("couldNotDelete"),
            variant: "destructive",
          });
          // Don't call onDeleted if backend failed
        } finally {
          // Ensure pending is reset even if the inner try fails
          // Set pending false here if you remove the setTimeout
        }
      }, 100); // 100ms delay - adjust or remove as needed
    } catch (error) {
      // Catch errors from validation or initial setup
      console.error("Error setting up deletion:", error);
      toast({
        title: t("error"),
        description: t("unexpectedError"),
        variant: "destructive",
      });
      setPending(false); // Ensure pending is false if outer try fails
    } finally {
      // If using setTimeout, pending should be reset inside the timeout's finally block
      // If not using setTimeout, reset it here:
      if (typeof setTimeout === "undefined") {
        // Basic check if setTimeout is available
        setPending(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* Allow customization or provide a default trigger */}
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
            {t("confirmDeletionMessage", { entryName })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-4">
          {" "}
          {/* Added pt-4 */}
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
