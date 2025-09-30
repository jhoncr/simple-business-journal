"use client";

import { useState, useId, useMemo } from "react"; // Import useMemo
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/InputUnit";
import { currencyToSymbol } from "@/lib/utils";
import { ListPlus, Plus } from "lucide-react";
import {
  estimateDetailsState,
  estimateDetailsStateSchema,
} from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { ROLES_THAT_ADD } from "@/../../backend/functions/src/common/const"; // Import ROLES_THAT_ADD
import { ROLES } from "@/../../backend/functions/src/common/schemas/common_schemas"; // Import ROLES for type

export type Adjustment = estimateDetailsState["adjustments"][number];

interface AdjustmentFormProps {
  onSubmit: (adj: Adjustment) => void;
  onTaxSubmit?: (value: number) => void;
  currency?: string;
  taxPercentage?: number;
  userRole?: (typeof ROLES)[number]; // Updated userRole prop type
}

// Define adjustment types for better type safety
const ADJUSTMENT_TYPE_VALUES = [
  "addFixed",
  "addPercent",
  "discountFixed",
  "discountPercent",
  "taxPercent",
] as const;

// Type selector component
function AdjustmentTypeSelector({
  value,
  onChange,
  id,
  getTypeLabel,
}: {
  value: Adjustment["type"];
  onChange: (value: Adjustment["type"]) => void;
  id: string;
  getTypeLabel: (type: string) => string;
}) {
  return (
    <RadioGroup
      className="grid grid-cols-2 gap-2"
      value={value}
      onValueChange={(value) => onChange(value as Adjustment["type"])}
    >
      {ADJUSTMENT_TYPE_VALUES.map((type) => (
        <div
          key={`${id}-${type}`}
          className="border-input hover:bg-accent/50 has-data-[state=checked]:border-ring has-data-[state=checked]:bg-accent relative flex flex-col items-start rounded-md border p-3 shadow-xs outline-none transition-colors"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem
              id={`${id}-${type}`}
              value={type}
              className="after:absolute after:inset-0"
            />
            <Label htmlFor={`${id}-${type}`}>{getTypeLabel(type)}</Label>
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}

export function AdjustmentForm({
  onSubmit,
  onTaxSubmit,
  currency,
  taxPercentage,
  userRole = "viewer", // Default to viewer if undefined
}: AdjustmentFormProps) {
  const t = useTranslations("adjustmentForm");
  const tCommon = useTranslations("common");

  // Consolidated form state
  const [formState, setFormState] = useState<{
    type: Adjustment["type"];
    value: string;
    description: string;
  }>({
    type: "addFixed",
    value: "",
    description: "",
  });

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [dialogOpen, setDialogOpen] = useState(false);
  const id = useId();

  // --- Add permission check ---
  const canModify = useMemo(() => ROLES_THAT_ADD.has(userRole), [userRole]);
  // --- End permission check ---

  // Helper function to get translated adjustment type labels
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "addFixed":
        return t("feeFlat");
      case "addPercent":
        return t("feePercent");
      case "discountFixed":
        return t("discountFlat");
      case "discountPercent":
        return t("discountPercent");
      case "taxPercent":
        return t("taxPercent");
      default:
        return type;
    }
  };

  // Form update helpers
  const updateField = <K extends keyof typeof formState>(
    key: K,
    value: (typeof formState)[K],
  ) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setFormState({
      type: "addFixed",
      value: "",
      description: "",
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const numericValue = Number.parseFloat(formState.value);
    if (isNaN(numericValue)) return;

    if (formState.type === "taxPercent") {
      onTaxSubmit?.(numericValue);
    } else {
      onSubmit({
        type: formState.type,
        value: numericValue,
        description: formState.description,
      });
    }

    resetForm();
    if (isMobile) setDialogOpen(false);
  };

  const isPercentType = formState.type.includes("Percent");
  const isTaxType = formState.type === "taxPercent";

  const formContent = (
    <form
      id="estimate-adjustments-form"
      onSubmit={handleSubmit}
      className="space-y-4 print:hidden"
      // No direct disable on form, disable inputs instead
    >
      {!isMobile && (
        <legend className="text-foreground text-sm leading-none font-medium mb-3">
          {t("addAdjustment")}
        </legend>
      )}
      <div
        className={cn(
          "gap-4",
          isMobile ? "space-y-4" : "grid grid-cols-[1fr_1fr]", // Changed from grid-cols-[2fr_2fr_auto] to 2 columns
        )}
      >
        <div>
          <fieldset className="space-y-4" disabled={!canModify}>
            {" "}
            {/* Disable fieldset */}
            <AdjustmentTypeSelector
              id={id}
              value={formState.type}
              onChange={(value) => updateField("type", value)}
              getTypeLabel={getTypeLabel}
            />
          </fieldset>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjustmentDescription" className="sr-only">
            {t("description")} {!isTaxType && t("optional")}
          </Label>
          <Input
            id="adjustmentDescription"
            value={formState.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder={
              isTaxType ? t("taxPercent") : t("descriptionOptional")
            }
            disabled={isTaxType || !canModify} // Disable input
            className="transition-all"
          />

          <div>
            <Label htmlFor="adjustmentValue-id" className="sr-only">
              {t("value")}
            </Label>
            <NumericInput
              id="adjustmentValue-id"
              className="peer text-center"
              prefix={isPercentType ? "" : currencyToSymbol(currency || "")}
              suffix={isPercentType ? "%" : ""}
              value={formState.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const inputValue = e.target.value;
                if (inputValue === "" || !isNaN(parseFloat(inputValue))) {
                  updateField("value", inputValue);
                }
              }}
              disabled={!canModify} // Disable input
            />
          </div>
        </div>
      </div>

      {/* Add button moved to a new row */}
      {!isMobile && (
        <div className="flex justify-end mt-4">
          <Button
            type="submit"
            className="w-1/3"
            variant="brutalist"
            disabled={!formState.value || !canModify} // Disable button
          >
            <Plus className="mr-1" />
            {t("add")}
          </Button>
        </div>
      )}
    </form>
  );

  if (isMobile) {
    return (
      <div className="mobile-form print:hidden">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="brutalist"
              className="w-full"
              disabled={!canModify} // Disable trigger
            >
              <ListPlus className="mr-2" />
              {t("addAdjustment")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{t("addAdjustment")}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-2">{formContent}</div>
            <DialogFooter className="pt-4 flex-shrink-0 gap-2">
              <DialogClose asChild>
                <Button variant="outline">{tCommon("cancel")}</Button>
              </DialogClose>
              <Button
                type="submit"
                form="estimate-adjustments-form"
                variant="brutalist"
                disabled={!formState.value || !canModify} // Disable button
              >
                <Plus className="mr-1" /> {t("add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return <div className="print:hidden">{formContent}</div>;
}
