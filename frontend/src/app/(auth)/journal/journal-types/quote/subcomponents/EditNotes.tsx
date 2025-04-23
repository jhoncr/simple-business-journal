"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Pencil, X } from "lucide-react";

interface InlineEditTextareaProps {
  initialValue: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineEditTextarea({
  initialValue = "",
  onSave,
  placeholder = "Enter notes...",
  className = "",
  disabled = false,
}: InlineEditTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    // Focus the textarea after rendering
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleSave = () => {
    onSave(value);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      {isEditing ? (
        <div className="w-full space-y-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[100px] p-2 pr-20 w-full"
            autoFocus
          />
          <div className="absolute top-2 right-2 flex space-x-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              className="h-8 w-8 print:hidden"
              aria-label="Cancel editing"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              onClick={handleSave}
              className="h-8 w-8 print:hidden"
              aria-label="Save changes"
              variant={value ? "brutalist" : "destructive"}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="group relative min-h-[40px] w-full rounded-md border border-input bg-background p-3">
          <div className="whitespace-pre-wrap pr-12">
            {value || (
              <p className="text-muted-foreground print:hidden">
                {placeholder}
              </p>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleEdit}
            className="absolute right-2 top-2 h-8 w-8 print:hidden"
            aria-label="Edit text"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
