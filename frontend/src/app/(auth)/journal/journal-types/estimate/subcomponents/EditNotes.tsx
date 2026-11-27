"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface InlineEditTextareaProps {
  initialValue: string;
  onSave: (value: string) => Promise<boolean | void> | void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  canEdit?: boolean;
}

export function InlineEditTextarea({
  initialValue = "",
  onSave,
  placeholder,
  className = "",
  disabled = false,
  canEdit = true,
}: InlineEditTextareaProps) {
  const t = useTranslations("common");
  const effectivePlaceholder = placeholder ?? t("enterNotes");
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local value when initialValue changes externally (e.g. conflict reload)
  useEffect(() => {
    setValue(initialValue);
    if (!canEdit) {
      setIsEditing(false);
    }
  }, [initialValue, canEdit]);

  const handleEdit = () => {
    if (!canEdit || disabled) return;
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleSave = async () => {
    if (!canEdit || disabled || isSavingLocal) return;
    setIsSavingLocal(true);
    try {
      const result = await onSave(value);
      if (result !== false) {
        setIsEditing(false);
      }
    } finally {
      setIsSavingLocal(false);
    }
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
            placeholder={effectivePlaceholder}
            className="min-h-[100px] p-2 pr-20 w-full"
            disabled={disabled || isSavingLocal}
            autoFocus
          />
          <div className="absolute top-2 right-2 flex space-x-4">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              disabled={disabled || isSavingLocal}
              className="h-8 w-8 print:hidden"
              aria-label={t("cancelEditing")}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={handleSave}
              disabled={disabled || isSavingLocal}
              className="h-8 w-8 print:hidden"
              aria-label={t("saveChanges")}
              variant={value ? "brutalist" : "destructive"}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="group relative min-h-[40px] w-full rounded-md border border-input bg-background p-3">
          <div className={`whitespace-pre-wrap ${canEdit ? "pr-12" : ""}`}>
            {value || (
              <p className="text-muted-foreground print:hidden">
                {effectivePlaceholder}
              </p>
            )}
          </div>
          {canEdit && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleEdit}
              disabled={disabled}
              className="absolute right-2 top-2 h-8 w-8 print:hidden"
              aria-label={t("editText")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
