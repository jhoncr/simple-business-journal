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
const duplicateEstimateFn = httpsCallable(functions, "duplicateEntry", {
  limitedUseAppCheckTokens: true,
});

// Zod schema for validation
const duplicateEstimateSchema = z.object({
  jid: z.string().min(1),
  entryId: z.string().min(1),
  entryType: z.literal("estimate"),
});

type DuplicatePayload = z.infer<typeof duplicateEstimateSchema>;

interface DuplicateEstimateBtnProps {
  jid: string;
  entryId: string;
  entryName?: string;
  onDuplicated: (newEntryId: string) => void;
}

export function DuplicateEstimateBtn({
  jid,
  entryId,
  entryName = "",
  onDuplicated,
}: DuplicateEstimateBtnProps) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const t = useTranslations("journal");

  const onDuplicate = async () => {
    setPending(true);

    const payload: DuplicatePayload = {
      jid,
      entryId,
      entryType: "estimate",
    };

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
      const result = await duplicateEstimateFn(validation.data);

      const resultData = result.data as { id?: string; message?: string };
      const newEntryId = resultData?.id;

      if (!newEntryId) {
        throw new Error(t("couldNotDuplicate"));
      }

      toast({
        title: t("estimateDuplicated"),
        description: t("duplicateSuccess"),
      });

      onDuplicated(newEntryId);
    } catch (error: unknown) {
      console.error("Error during duplication:", error);
      const message =
        error instanceof Error ? error.message : t("couldNotDuplicate");
      toast({
        title: t("duplicationFailed"),
        description: message || t("couldNotDuplicate"),
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
      {pending ? t("duplicating") : t("duplicateEstimate")}
    </Button>
  );
}
