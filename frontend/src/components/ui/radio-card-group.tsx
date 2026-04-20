import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface RadioCardOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface RadioCardGroupProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: RadioCardOption[];
  disabled?: boolean;
  className?: string;
  idPrefix?: string;
  layout?: "vertical" | "horizontal";
}

export function RadioCardGroup({
  value,
  onValueChange,
  options,
  disabled,
  className,
  idPrefix = "radio",
  layout = "horizontal",
}: RadioCardGroupProps) {
  return (
    <RadioGroup
      className={cn("grid gap-2", className)}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      {options.map((item) => {
        const itemDisabled = item.disabled || disabled;
        const isSelected = value === item.value;

        return (
          <div
            key={item.value}
            className={cn(
              "border-input relative flex flex-col items-center justify-center rounded-md border shadow-xs outline-none transition-colors",
              layout === "vertical" ? "p-2" : "p-1", // slightly smaller padding for horizontal by default based on existing code
              isSelected
                ? "border-primary border-4 bg-primary/10 shadow-md"
                : "hover:bg-accent/50",
              itemDisabled && !isSelected ? "opacity-50 bg-muted" : ""
            )}
          >
            <RadioGroupItem
              value={item.value}
              id={`${idPrefix}-${item.value}`}
              className="peer sr-only"
              disabled={itemDisabled}
            />
            <Label
              htmlFor={`${idPrefix}-${item.value}`}
              className={cn(
                "flex h-full w-full items-center justify-center gap-2 text-center text-xs",
                layout === "vertical" ? "flex-col" : "flex-row p-2",
                isSelected ? "font-semibold text-primary" : "",
                itemDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              )}
            >
              {item.icon}
              {item.label}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
