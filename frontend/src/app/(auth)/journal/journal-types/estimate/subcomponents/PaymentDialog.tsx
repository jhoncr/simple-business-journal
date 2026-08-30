"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn, currencyToSymbol, formatCurrency } from "@/lib/utils";
import { Payment } from "@backend/common/schemas/estimate_schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentToEdit?: Payment | null;
  balanceDue: number;
  currency: string;
  onSave: (payment: Payment) => Promise<boolean | void> | void;
  isSaving: boolean;
}

const STANDARD_METHODS = [
  "cash",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "check",
  "pix",
  "zelle",
  "other",
] as const;

export function PaymentDialog({
  open,
  onOpenChange,
  paymentToEdit,
  balanceDue,
  currency,
  onSave,
  isSaving,
}: PaymentDialogProps) {
  const t = useTranslations("payments");
  const { toast } = useToast();

  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [methodType, setMethodType] = useState<string>("credit_card");
  const [customMethod, setCustomMethod] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (paymentToEdit) {
        setAmount(String(paymentToEdit.amount || ""));
        setDate(
          paymentToEdit.date ? new Date(paymentToEdit.date) : new Date(),
        );
        const existingMethod = (paymentToEdit.method || "").toLowerCase();
        if (
          STANDARD_METHODS.includes(
            existingMethod as (typeof STANDARD_METHODS)[number],
          )
        ) {
          setMethodType(existingMethod);
          setCustomMethod("");
        } else if (existingMethod) {
          setMethodType("other");
          setCustomMethod(paymentToEdit.method || "");
        } else {
          setMethodType("credit_card");
          setCustomMethod("");
        }
        setTransactionId(paymentToEdit.transactionId || "");
        setNotes(paymentToEdit.notes || "");
      } else {
        // Adding new payment
        setAmount(balanceDue > 0 ? String(balanceDue) : "");
        setDate(new Date());
        setMethodType("credit_card");
        setCustomMethod("");
        setTransactionId("");
        setNotes("");
      }
    }
  }, [open, paymentToEdit, balanceDue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        description: t("errors.invalidAmount"),
        variant: "destructive",
      });
      return;
    }

    if (!date) {
      toast({
        description: t("errors.dateRequired"),
        variant: "destructive",
      });
      return;
    }

    let finalMethod: string | undefined = undefined;
    if (methodType === "other") {
      finalMethod = customMethod.trim() || undefined;
    } else if (methodType) {
      finalMethod = methodType;
    }

    const paymentData: Payment = {
      ...(paymentToEdit ? paymentToEdit : {}),
      amount: parsedAmount,
      date: date,
      method: finalMethod || null,
      transactionId: transactionId.trim() || null,
      notes: notes.trim() || null,
    };

    const res = await onSave(paymentData);
    if (res !== false) {
      onOpenChange(false);
    }
  };

  const handleFillFullBalance = () => {
    if (balanceDue > 0) {
      setAmount(String(balanceDue));
    }
  };

  const currencySymbol = currencyToSymbol(currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {paymentToEdit ? t("editPayment") : t("recordPayment")}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Amount Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="payment-amount">{t("amount")}</Label>
                {!paymentToEdit && balanceDue > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-2xs text-primary hover:text-primary/80 flex items-center gap-1"
                    onClick={handleFillFullBalance}
                  >
                    <Sparkles className="h-3 w-3" />
                    {t("fillRemainingBalance", {
                      amount: formatCurrency(balanceDue, currency),
                    })}
                  </Button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  {currencySymbol}
                </span>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 text-base font-medium"
                  disabled={isSaving}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Date Picker */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-date">{t("date")}</Label>
              <Popover
                modal
                open={datePopoverOpen}
                onOpenChange={setDatePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="payment-date"
                    variant="outline"
                    type="button"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground",
                    )}
                    disabled={isSaving}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>{t("pickDate")}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d || undefined);
                      setDatePopoverOpen(false);
                    }}
                    disabled={isSaving}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">{t("method")}</Label>
              <Select
                value={methodType}
                onValueChange={(val) => setMethodType(val)}
                disabled={isSaving}
              >
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder={t("selectMethod")} />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`methods.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Payment Method if 'other' is chosen */}
            {methodType === "other" && (
              <div className="space-y-1.5">
                <Label htmlFor="custom-payment-method">
                  {t("customMethod")}
                </Label>
                <Input
                  id="custom-payment-method"
                  type="text"
                  placeholder={t("customMethodPlaceholder")}
                  value={customMethod}
                  onChange={(e) => setCustomMethod(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            )}

            {/* Reference / Transaction ID */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-transaction-id">
                {t("transactionIdOptional")}
              </Label>
              <Input
                id="payment-transaction-id"
                type="text"
                placeholder={t("transactionIdPlaceholder")}
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                disabled={isSaving}
              />
            </div>

            {/* Notes / Memo */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-notes">{t("notesOptional")}</Label>
              <Textarea
                id="payment-notes"
                placeholder={t("notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !amount || !date}
              variant="brutalist"
            >
              {paymentToEdit ? t("saveChanges") : t("addPayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
