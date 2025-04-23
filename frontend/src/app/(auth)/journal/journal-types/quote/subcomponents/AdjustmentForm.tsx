"use client";

import { useState, useId, useMemo } from "react"; // Import useMemo
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/InputUnit";
import { currencyToSymbol } from "@/lib/utils";
import { ListPlus, Plus } from "lucide-react";
import {
  quoteDetailsState,
  quoteDetailsStateSchema,
} from "@/../../backend/functions/src/common/schemas/quote_schema";
import { ROLES_THAT_ADD } from "@/../../backend/functions/src/common/const"; // Import ROLES_THAT_ADD

export type Adjustment = quoteDetailsState["adjustments"][number];

interface AdjustmentFormProps {
  onSubmit: (adj: Adjustment) => void;
  onTaxSubmit?: (value: number) => void;
  currency?: string;
  taxPercentage?: number;
  userRole?: string; // Added userRole prop for permission check
}

// Define adjustment types for better type safety
const ADJUSTMENT_TYPES = [
  { value: "addFixed", label: "Fee flat ($)" },
  { value: "addPercent", label: "Fee %" },
  { value: "discountFixed", label: "Discount flat $" },
  { value: "discountPercent", label: "Discount %" },
  { value: "taxPercent", label: "Tax %" },
] as const;

// Type selector component
function AdjustmentTypeSelector({
  value,
  onChange,
  id,
}: {
  value: Adjustment["type"];
  onChange: (value: Adjustment["type"]) => void;
  id: string;
}) {
  return (
    <RadioGroup
      className="grid grid-cols-2 gap-2"
      value={value}
      onValueChange={(value) => onChange(value as Adjustment["type"])}
    >
      {ADJUSTMENT_TYPES.map((type) => (
        <div
          key={`${id}-${type.value}`}
          className="border-input hover:bg-accent/50 has-data-[state=checked]:border-ring has-data-[state=checked]:bg-accent relative flex flex-col items-start rounded-md border p-3 shadow-xs outline-none transition-colors"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem
              id={`${id}-${type.value}`}
              value={type.value}
              className="after:absolute after:inset-0"
            />
            <Label htmlFor={`${id}-${type.value}`}>{type.label}</Label>
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const id = useId();

  // --- Add permission check ---
  const canModify = useMemo(() => ROLES_THAT_ADD.has(userRole), [userRole]);
  // --- End permission check ---

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
    if (isMobile) setDrawerOpen(false);
  };

  const isPercentType = formState.type.includes("Percent");
  const isTaxType = formState.type === "taxPercent";

  const formContent = (
    <form
      id="quote-adjustments-form"
      onSubmit={handleSubmit}
      className="space-y-4"
      // No direct disable on form, disable inputs instead
    >
      {!isMobile && (
        <legend className="text-foreground text-sm leading-none font-medium mb-3">
          Add Adjustment
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
            />
          </fieldset>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjustmentDescription" className="sr-only">
            Description {!isTaxType && "(Optional)"}
          </Label>
          <Input
            id="adjustmentDescription"
            value={formState.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder={isTaxType ? "Tax %" : "Description (Optional)"}
            disabled={isTaxType || !canModify} // Disable input
            className="transition-all"
          />

          <div>
            <Label htmlFor="adjustmentValue-id" className="sr-only">
              Value
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
            Add
          </Button>
        </div>
      )}
    </form>
  );

  if (isMobile) {
    return (
      <div className="mobile-form print-hide">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="brutalist"
              className="w-full"
              disabled={!canModify} // Disable trigger
            >
              <ListPlus className="mr-2" />
              Add Adjustment
            </Button>
          </DrawerTrigger>
          <DrawerContent className="sm:max-w-[420px] px-6 pt-2">
            <DrawerHeader>
              <DrawerTitle>Add Adjustment</DrawerTitle>
            </DrawerHeader>
            {formContent}
            <DrawerFooter className="pt-2">
              <Button
                type="submit"
                form="quote-adjustments-form"
                variant="brutalist"
                disabled={!formState.value || !canModify} // Disable button
              >
                <Plus className="mr-1" /> Add
              </Button>
              <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return <div className="print-hide">{formContent}</div>;
}
