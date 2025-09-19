import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Payment } from "@/../../backend/functions/src/common/schemas/estimate_schema";
import { formattedDate } from "@/lib/utils";
import { toast } from 'sonner';

interface PaymentsProps {
  payments: Payment[];
  currencyFormat: (amount: number) => string;
  isInvoiceFlow: boolean;
  handleAddPayment: (payment: Payment) => void;
  isSaving: boolean;
}

export const Payments = ({ payments, currencyFormat, isInvoiceFlow, handleAddPayment, isSaving }: PaymentsProps) => {
  const [newPaymentAmount, setNewPaymentAmount] = useState<number | string>("");
  const [newPaymentDate, setNewPaymentDate] = useState<Date | undefined>(
    new Date(),
  );
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>("");
  const [paymentDatePopoverOpen, setPaymentDatePopoverOpen] = useState(false);

  const onAddPayment = () => {
    if (
      !newPaymentAmount ||
      isNaN(Number(newPaymentAmount)) ||
      Number(newPaymentAmount) <= 0
    ) {
      toast.error("Payment amount must be a positive number.");
      return;
    }
    if (!newPaymentDate) {
      toast.error("Please select a date for the payment.");
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
    <div className="break-before-page">
      <h3 className="text-lg font-semibold pt-4 mb-2">Payments</h3>
      <div className="border rounded-md p-4 space-y-4">
        {payments.length > 0 ? (
          <ul className="space-y-2">
            {payments.map((payment, index) => (
              <li
                key={payment.id || `payment-${index}-${payment.date}`}
                className="flex justify-between items-center p-2 border-b last:border-b-0"
              >
                <div>
                  <p className="font-medium">
                    {currencyFormat(payment.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Method: {payment.method || "N/A"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formattedDate(new Date(payment.date))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No payments recorded yet.
          </p>
        )}

        {isInvoiceFlow && (
          <div className="pt-4 border-t print:hidden">
            <h4 className="text-md font-semibold mb-2">Add Payment</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <Label htmlFor="paymentAmount">Amount</Label>
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
                <Label htmlFor="paymentDate">Date</Label>
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
                        <span>Pick a date</span>
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
                <Label htmlFor="paymentMethod">Method (Optional)</Label>
                <Input
                  id="paymentMethod"
                  type="text"
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  placeholder="e.g., Card, Bank Transfer"
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
              Add Payment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};