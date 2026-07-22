import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Payment } from "@backend/common/schemas/estimate_schema";
import { formattedDate } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface PaymentsProps {
  payments: Payment[];
  currencyFormat: (amount: number) => string;
  isInvoiceFlow: boolean;
  handleAddPayment: (payment: Payment) => void;
  isSaving: boolean;
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Payments = ({
  payments,
  currencyFormat,
  isInvoiceFlow,
  handleAddPayment,
  isSaving,
}: PaymentsProps) => {
  const t = useTranslations("payments");
  const [newPaymentAmount, setNewPaymentAmount] = useState<number | string>("");
  const [newPaymentDate, setNewPaymentDate] = useState<Date | undefined>(new Date());
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>("");
  const [paymentDatePopoverOpen, setPaymentDatePopoverOpen] = useState(false);

  const onAddPayment = () => {
    if (!newPaymentAmount || isNaN(Number(newPaymentAmount)) || Number(newPaymentAmount) <= 0) {
      toast.error(t("errors.invalidAmount"));
      return;
    }
    if (!newPaymentDate) {
      toast.error(t("errors.dateRequired"));
      return;
    }

    const newPayment: Payment = {
      amount: Number(newPaymentAmount),
      date: newPaymentDate,
      method: newPaymentMethod || undefined,
    };

    handleAddPayment(newPayment);
    setNewPaymentAmount("");
    setNewPaymentDate(new Date());
    setNewPaymentMethod("");
  };

  return (
    <Card className="print:border-none print:shadow-none break-before-page">
      <CardHeader className="print:p-0">
        <CardTitle className="text-lg">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="print:p-0 space-y-4">
        {payments.length > 0 ? (
          <ul className="space-y-2">
            {payments.map((payment, index) => (
              <li
                key={payment.id || `payment-${index}-${payment.date}`}
                className="flex justify-between items-center p-2 border-b last:border-b-0"
              >
                <div>
                  <p className="font-medium">{currencyFormat(payment.amount)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("method")}: {payment.method || t("na")}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formattedDate(new Date(payment.date))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noPaymentsYet")}</p>
        )}

        {isInvoiceFlow && (
          <div className="pt-4 border-t print:hidden">
            <h4 className="text-md font-semibold mb-2">{t("addPayment")}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <Label htmlFor="paymentAmount">{t("amount")}</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label htmlFor="paymentDate">{t("date")}</Label>
                <Popover
                  modal
                  open={paymentDatePopoverOpen}
                  onOpenChange={setPaymentDatePopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newPaymentDate && "text-muted-foreground",
                      )}
                      disabled={isSaving}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newPaymentDate ? (
                        format(newPaymentDate, "PPP")
                      ) : (
                        <span>{t("pickDate")}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newPaymentDate}
                      onSelect={(date) => {
                        setNewPaymentDate(date || undefined);
                        setPaymentDatePopoverOpen(false);
                      }}
                      disabled={isSaving}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="paymentMethod">{t("methodOptional")}</Label>
                <Input
                  id="paymentMethod"
                  type="text"
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  placeholder={t("placeholder")}
                  disabled={isSaving}
                />
              </div>
            </div>
            <Button
              onClick={onAddPayment}
              disabled={isSaving || !newPaymentAmount || !newPaymentDate}
              className="mt-3"
              size="sm"
            >
              {t("addPayment")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
