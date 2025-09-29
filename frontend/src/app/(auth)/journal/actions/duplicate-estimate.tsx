// frontend/src/app/(auth)/journal/actions/duplicate-estimate.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import * as z from "zod";
import { httpsCallable } from "firebase/functions";
import { Copy } from "lucide-react";
import { functions } from "@/lib/auth_handler";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

// Backend function call
const duplicateEstimateFn = httpsCallable(functions, "duplicateEstimate", {
  limitedUseAppCheckTokens: true,
});

// Zod schema for validation
const duplicateEstimateSchema = z.object({
  journalId: z.string().min(1),
  entryId: z.string().min(1),
});

type DuplicatePayload = z.infer<typeof duplicateEstimateSchema>;

interface DuplicateEstimateBtnProps {
  journalId: string;
  entryId: string;
  entryName?: string;
  onDuplicated: (newEntryId: string) => void;
}

export function DuplicateEstimateBtn({
  journalId,
  entryId,
  entryName = "",
  onDuplicated,
}: DuplicateEstimateBtnProps) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const t = useTranslations("journal");

  const onDuplicate = async () => {
    console.log(`Duplicating estimate ${entryId} in journal ${journalId}`);
    setPending(true);

    const payload: DuplicatePayload = {
      journalId,
      entryId,
    };

    // Validate payload client-side
    const validation = duplicateEstimateSchema.safeParse(payload);
    if (!validation.success) {
      console.error("Invalid duplicate payload:", validation.error.format());
      toast({
        title: t("error"),
        description: t("invalidData"),
        variant: "destructive",
      });
      setPending(false);
      return;
    }

    try {
      console.log(
        "Calling duplicateEstimateFn with payload:",
        validation.data,
      );
      const result = await duplicateEstimateFn(validation.data);

      // Extract the new entry ID from the result
      const resultData = result.data as { id?: string; message?: string };
      const newEntryId = resultData.id;

      if (!newEntryId) {
        throw new Error("No entry ID returned from duplicate function");
      }

      toast({
        title: t("estimateDuplicated") || "Estimate Duplicated",
        description:
          t("estimateDuplicatedSuccess", { entryName }) ||
          `Estimate "${entryName}" created successfully`,
      });

      onDuplicated(newEntryId);
    } catch (error: any) {
      console.error("Error during duplication:", error);
      toast({
        title: t("duplicationFailed") || "Duplication Failed",
        description:
          error.message ||
          t("couldNotDuplicate") ||
          "Could not duplicate estimate",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant="ghost"
      className="p-0 h-auto font-normal w-full justify-start"
      onClick={onDuplicate}
      disabled={pending}
    >
      <Copy className="h-4 w-4 inline mr-2" />
      {pending
        ? t("duplicating") || "Duplicating..."
        : t("duplicateEstimate") || "Duplicate Estimate"}
    </Button>
  );
}
