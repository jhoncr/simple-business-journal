"use client";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumericInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  prefix?: string;
  suffix?: string;
}

export function NumericInput({
  label,
  helperText,
  value: propValue,
  onChange: propOnChange,
  prefix,
  suffix,
  ...props
}: NumericInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  // Handle external value changes
  useEffect(() => {
    if (propValue !== undefined) {
      setDisplayValue(String(propValue));
    }
  }, [propValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow empty input
    if (inputValue === "") {
      setDisplayValue("");
      if (propOnChange) {
        e.target.value = "";
        propOnChange(e);
      }
      return;
    }

    // Check for non-numeric input after handling empty case
    if (isNaN(Number(inputValue))) {
      return;
    }

    // Allow valid numeric inputs with up to 2 decimal places
    const regex = /^[0-9]*\.?[0-9]{0,2}$/;
    if (!regex.test(inputValue)) {
      return;
    }

    // Format the value properly
    let formattedValue = inputValue;
    if (inputValue.includes(".")) {
      // For decimal numbers
      const [intPart, decPart] = inputValue.split(".");
      const cleanIntPart =
        intPart === "" ? "0" : intPart.replace(/^0+/, "") || "0";
      formattedValue = `${cleanIntPart}.${decPart}`;
    } else {
      // For whole numbers
      formattedValue = inputValue.replace(/^0+/, "") || "0";
    }

    // Update the display value
    setDisplayValue(formattedValue);

    // Call the parent onChange handler with the updated value
    if (propOnChange) {
      e.target.value = formattedValue;
      propOnChange(e);
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={props.id}>{label}</Label>}
      <div className="relative">
        {prefix && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="text-gray-500">{prefix}</span>
          </div>
        )}
        {suffix && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-gray-500">{suffix}</span>
          </div>
        )}
        <Input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-7" : ""}`}
          {...props}
        />
      </div>
      {helperText && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
