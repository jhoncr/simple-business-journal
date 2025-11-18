"use client";
import { useState, useEffect, forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  helperText?: string;
  prefix?: string;
  suffix?: string;
  /** Maximum number of decimal places allowed (default: 2) */
  decimalPlaces?: number;
  /** Allow negative numbers (default: false) */
  allowNegative?: boolean;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Error message to display */
  error?: string;
  /** Custom onChange handler that receives the formatted value */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback when value is out of bounds */
  onValidationError?: (error: string) => void;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      label,
      helperText,
      value: propValue,
      onChange: propOnChange,
      prefix,
      suffix,
      decimalPlaces = 2,
      allowNegative = false,
      min,
      max,
      error,
      onValidationError,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [displayValue, setDisplayValue] = useState("");
    const [localError, setLocalError] = useState<string>("");

    // Sync with external value changes
    useEffect(() => {
      if (propValue !== undefined && propValue !== null) {
        const stringValue = String(propValue);
        // Only update if different to avoid cursor jump
        if (stringValue !== displayValue) {
          setDisplayValue(stringValue);
        }
      } else if (
        propValue === "" ||
        propValue === null ||
        propValue === undefined
      ) {
        setDisplayValue("");
      }
    }, [propValue]); // Removed displayValue from deps to prevent loops

    const validateValue = useCallback(
      (value: string): string | null => {
        if (value === "" || value === "-") return null;

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return null;

        if (min !== undefined && numValue < min) {
          return `Value must be at least ${min}`;
        }
        if (max !== undefined && numValue > max) {
          return `Value must be at most ${max}`;
        }

        return null;
      },
      [min, max],
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty input
      if (inputValue === "") {
        setDisplayValue("");
        setLocalError("");
        if (propOnChange) {
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value: "" },
          } as React.ChangeEvent<HTMLInputElement>;
          propOnChange(syntheticEvent);
        }
        return;
      }

      // Handle negative sign
      if (allowNegative && inputValue === "-") {
        setDisplayValue("-");
        return;
      }

      // Build regex pattern based on settings
      const negativePattern = allowNegative ? "-?" : "";
      const decimalPattern =
        decimalPlaces > 0 ? `\\.?[0-9]{0,${decimalPlaces}}` : "";
      const regex = new RegExp(`^${negativePattern}[0-9]*${decimalPattern}$`);

      // Validate format
      if (!regex.test(inputValue)) {
        return; // Reject invalid input
      }

      // Check if it's a valid number
      if (inputValue !== "-" && isNaN(Number(inputValue))) {
        return;
      }

      // Format the value
      let formattedValue = inputValue;

      // Only format if not actively typing a decimal
      if (!inputValue.endsWith(".") && inputValue !== "-") {
        if (inputValue.includes(".")) {
          // For decimal numbers
          const [intPart, decPart] = inputValue.split(".");
          const sign = allowNegative && intPart.startsWith("-") ? "-" : "";
          const absIntPart = intPart.replace("-", "");
          const cleanIntPart =
            absIntPart === "" ? "0" : absIntPart.replace(/^0+/, "") || "0";
          formattedValue = `${sign}${cleanIntPart}.${decPart}`;
        } else if (inputValue !== "-") {
          // For whole numbers
          const sign = allowNegative && inputValue.startsWith("-") ? "-" : "";
          const absValue = inputValue.replace("-", "");
          formattedValue = sign + (absValue.replace(/^0+/, "") || "0");
        }
      }

      // Validate range
      const validationError = validateValue(formattedValue);
      setLocalError(validationError || "");
      if (validationError && onValidationError) {
        onValidationError(validationError);
      }

      // Update the display value
      setDisplayValue(formattedValue);

      // Call the parent onChange handler
      if (propOnChange) {
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: formattedValue },
        } as React.ChangeEvent<HTMLInputElement>;
        propOnChange(syntheticEvent);
      }
    };

    const hasError = !!(error || localError);
    const errorMessage = error || localError;

    return (
      <div className="space-y-2">
        {label && (
          <Label
            htmlFor={props.id}
            className={hasError ? "text-destructive" : ""}
          >
            {label}
          </Label>
        )}
        <div className="relative">
          {prefix && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <span
                className={cn(
                  "text-sm",
                  hasError ? "text-destructive" : "text-muted-foreground",
                  disabled && "opacity-50",
                )}
              >
                {prefix}
              </span>
            </div>
          )}
          {suffix && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <span
                className={cn(
                  "text-sm",
                  hasError ? "text-destructive" : "text-muted-foreground",
                  disabled && "opacity-50",
                )}
              >
                {suffix}
              </span>
            </div>
          )}
          <Input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            className={cn(
              prefix && "pl-8",
              suffix && "pr-8",
              hasError && "border-destructive focus-visible:ring-destructive",
              className,
            )}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              errorMessage
                ? `${props.id}-error`
                : helperText
                ? `${props.id}-helper`
                : undefined
            }
            {...props}
          />
        </div>
        {errorMessage && (
          <p
            id={`${props.id}-error`}
            className="text-sm font-medium text-destructive"
          >
            {errorMessage}
          </p>
        )}
        {helperText && !errorMessage && (
          <p
            id={`${props.id}-helper`}
            className="text-sm text-muted-foreground"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

NumericInput.displayName = "NumericInput";
