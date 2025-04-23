// frontend/src/app/(auth)/journal/journal-types/cash-flow/add-cf-entry.tsx
"use client";
import { useState, useEffect } from "react";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Send, Download, Upload, MessageSquarePlus } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/auth_handler";
import {
  cashFlowEntryDetailsSchema,
  CashFlowEntryDetailsType,
} from "@/../../backend/functions/src/common/schemas/CashflowSchema";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { NumericInput } from "@/components/InputUnit";
import { currencyToSymbol } from "@/lib/utils";
import { useJournalContext } from "@/context/JournalContext";

const addLogFn = httpsCallable(functions, "addLogFn", {
  limitedUseAppCheckTokens: true,
});

const cashFlowFormSchema = cashFlowEntryDetailsSchema;
type CashFlowFormValues = z.infer<typeof cashFlowFormSchema>;

export function AddLogEntryForm({
  journalId,
}: {
  journalId: string | undefined;
}) {
  const [pending, setPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();
  const { journal, loading, error } = useJournalContext();

  const activeCurrency =
    journal?.details && "currency" in journal.details
      ? journal.details.currency
      : undefined;

  const form = useForm<CashFlowFormValues>({
    resolver: zodResolver(cashFlowFormSchema),
    defaultValues: {
      description: "",
      date: new Date(),
      type: undefined,
      value: 0,
      currency: activeCurrency || undefined,
    },
  });

  useEffect(() => {
    if (activeCurrency) {
      form.setValue("currency", activeCurrency, { shouldValidate: true });
    }
  }, [activeCurrency, form.setValue]);

  const onSubmit = async (data: CashFlowFormValues) => {
    if (!journalId) {
      toast({
        title: "Error",
        description: "Journal ID is missing.",
        variant: "destructive",
      });
      return;
    }

    if (!data.currency) {
      toast({
        title: "Error",
        description: "Currency information is missing from the journal.",
        variant: "destructive",
      });
      return;
    }

    console.log(`Sending cashflow data:`, data);
    setPending(true);

    try {
      const payload = {
        journalId: journalId,
        entryType: "cashflow", //as EntryType,
        name: data.description.substring(0, 50) || "Cash Flow Entry",
        details: data,
      };

      console.log("Payload for addLogFn:", payload);
      const result = await addLogFn(payload);
      console.log("addLogFn result:", result);

      toast({
        title: "Entry Added",
        description: `Cash flow entry "${payload.name}" saved.`,
      });

      form.reset({
        description: "",
        date: new Date(),
        type: undefined,
        value: 0,
        currency: activeCurrency || undefined,
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error("Error adding cash flow entry:", error);
      toast({
        title: "Error Adding Entry",
        description: error.message || "Failed to save cash flow entry.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen === false) {
      form.reset({
        description: "",
        date: new Date(),
        type: undefined,
        value: 0,
        currency: activeCurrency || undefined,
      });
    }
    setIsOpen(nextOpen);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="brutalist"
          className="text-sm flex items-center"
          disabled={!journalId}
        >
          <MessageSquarePlus className="pr-2" />
          Add Entry
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Add Cash Flow Entry</DialogTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 px-4"
          >
            <div className="grid grid-cols-3 gap-4 items-end">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <NumericInput
                        prefix={currencyToSymbol(activeCurrency || "")}
                        placeholder="0.00"
                        className="peer text-center"
                        value={field.value.toString()}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = parseFloat(e.target.value);
                          field.onChange(
                            isNaN(value) || value < 0 ? 0 : value,
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-2 pt-2"
                      >
                        <div className="flex items-center space-x-2 border p-2 rounded-md has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary">
                          <RadioGroupItem value="received" id="received" />
                          <Label
                            htmlFor="received"
                            className="flex items-center cursor-pointer"
                          >
                            <Download className="w-4 h-4 mr-1" /> Received
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-2 rounded-md has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary">
                          <RadioGroupItem value="paid" id="paid" />
                          <Label
                            htmlFor="paid"
                            className="flex items-center cursor-pointer"
                          >
                            <Upload className="w-4 h-4 mr-1" /> Paid
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col pt-2">
                  <FormLabel>Date</FormLabel>
                  <div className="flex items-center justify-between">
                    <Popover
                      modal
                      open={calendarOpen}
                      onOpenChange={setCalendarOpen}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[200px] justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={(date) => {
                            field.onChange(date || new Date());
                            setCalendarOpen(false);
                          }}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="flex items-center text-sm">
                      <Separator orientation="vertical" className="mx-2 h-4" />
                      <Label
                        htmlFor="today-checkbox"
                        className="mr-2 text-muted-foreground"
                      >
                        Today
                      </Label>
                      <Checkbox
                        id="today-checkbox"
                        checked={
                          field.value?.toDateString() ===
                          new Date().toDateString()
                        }
                        onCheckedChange={(checked) => {
                          field.onChange(checked ? new Date() : null);
                        }}
                        className="ml-1"
                      />
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a short description (e.g., Office Supplies)"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="w-full pt-4 flex justify-between">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant="brutalist"
                disabled={pending || !activeCurrency}
                onClick={() => {
                  if (form.formState.isValid) {
                    console.log("Form is valid, submitting...");
                  } else {
                    console.log("Form is invalid, not submitting.");
                    console.log("Form errors:", form.formState.errors);
                  }
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Save Entry
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
