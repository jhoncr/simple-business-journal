// frontend/src/app/(auth)/journal/journal-types/inventory/add-inventory-entry.tsx
"use client";
import { useEffect, useState, useMemo, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { httpsCallable } from "firebase/functions";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { PackagePlus } from "lucide-react";
import { materialItemSchema } from "@/../../backend/functions/src/common/schemas/InventorySchema";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// --- Store import removed ---
// import { useJournalStore } from "@/lib/store/journalStore";
import { Label } from "@/components/ui/label";
import { functions } from "@/lib/auth_handler";
import { EntryType } from "@/../../backend/functions/src/common/schemas/configmap"; // Import EntryType
import { useJournalContext } from "@/context/JournalContext"; // Import the context hook
import { NumericInput } from "@/components/InputUnit";
import { currencyToSymbol } from "@/lib/utils";

// Backend function call (no change)
const addLogFn = httpsCallable(functions, "addLogFn", {
  limitedUseAppCheckTokens: true,
});

// Schema (no change)
const inventoryFormSchema = z
  .object({
    name: z
      .string()
      .min(3, { message: "Name must be at least 3 characters." }),
    details: materialItemSchema,
  })
  .strict();

type InventoryFormValues = z.infer<typeof inventoryFormSchema>;

const dimensionOptions = [
  { id: "unit", label: "Unit", value: { type: "unit", unitLabel: "unit" } },
  { id: "m2", label: "m²", value: { type: "area", unitLabel: "m²" } },
  { id: "ft2", label: "ft²", value: { type: "area", unitLabel: "ft²" } },
];

// --- Updated Props Interface ---
interface AddInventoryEntryFormProps {
  journalId: string; // This is the journalId
  // d: allowedCurrencySchemaType | null; // Accept currency as prop
}

// --- Main Component (Uses Props) ---
export function AddInventoryEntryForm({
  journalId, // journalId
}: // activeCurrency, // Use prop
AddInventoryEntryFormProps) {
  const [pending, setPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { journal, loading, error } = useJournalContext(); // Get journal from context
  const { toast } = useToast();
  const id = useId(); // For radio group

  // Safely access currency by checking if 'currency' property exists in details
  // Moved hook calls before conditional returns
  const activeCurrency = useMemo(() => {
    return journal?.details && "currency" in journal.details
      ? journal.details.currency
      : null;
  }, [journal]); // Depend only on journal for activeCurrency calculation

  // --- Default Values (depend on journal context) ---
  // Moved hook call before conditional returns
  const defaultValues: InventoryFormValues = useMemo(
    () => ({
      name: "",
      details: {
        description: "",
        unitPrice: 0,
        dimensions: { type: "unit" as "unit", unitLabel: "unit" as "unit" },
        labor: null,
        currency: activeCurrency || null, // Use journal context for default
      },
    }),
    [activeCurrency], // Depend on activeCurrency derived from journal
  );

  // Moved hook call before conditional returns
  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues,
  });

  // --- Sync form currency if journal context changes after mount ---
  // Moved hook call before conditional returns
  useEffect(() => {
    if (
      activeCurrency &&
      form.getValues("details.currency") !== activeCurrency
    ) {
      form.setValue("details.currency", activeCurrency);
    }
    // If prop becomes null, should we clear the form currency? Depends on desired behavior.
    // else if (!activeCurrency) {
    //   form.setValue("details.currency", null);
    // }
  }, [activeCurrency, form]);

  // Conditional returns now happen *after* all hooks have been called
  if (loading) return null; // Loading state
  if (error) {
    console.error("Error loading journal:", error);
    // Display the error message correctly, whether it's a string or an Error object
    return <div>Error loading journal: {error}</div>;
  }

  if (!journal) {
    console.error("No journal found in context.");
    return <div>No journal found.</div>;
  }

  const labor = form.watch("details.labor");

  const onSubmit = async (data: InventoryFormValues) => {
    if (!activeCurrency) {
      toast({
        title: "Missing Currency",
        description: "Cannot add item. Business currency is not set.",
        variant: "destructive",
      });
      return;
    }
    setPending(true);
    try {
      const payload = {
        journalId: journalId,
        entryType: "inventory" as EntryType,
        name: data.name,
        details: {
          ...data.details,
          currency: activeCurrency, // Ensure currency from prop is sent
        },
      };

      console.log("Sending payload to addLogFn:", payload);
      const result = await addLogFn(payload);
      console.log("addLogFn result:", result);

      toast({
        title: "Inventory Item Added",
        description: `"${data.name}" has been added to your inventory.`,
      });

      form.reset(defaultValues);
      setIsOpen(false);
    } catch (error: any) {
      console.error("Error adding inventory entry:", error);
      toast({
        title: "Error Adding Item",
        description: error.message || "Failed to add inventory item.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen === false) {
      form.reset(defaultValues);
    }
    setIsOpen(nextOpen);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="brutalist"
          className="text-sm flex items-center"
          // Disable if journalId OR activeCurrency is missing
          disabled={!journalId || !activeCurrency}
        >
          <PackagePlus className="pr-2" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add Inventory Item</DialogTitle>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* --- Name Field --- */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Premium Widget" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* --- Details: Description --- */}
            <FormField
              control={form.control}
              name="details.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Additional details..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* --- Details: Unit Price --- */}
            <FormField
              control={form.control}
              name="details.unitPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Price</FormLabel>
                  <FormControl>
                    <NumericInput
                      // Use activeCurrency prop for symbol
                      prefix={currencyToSymbol(activeCurrency || "")}
                      placeholder="0.00"
                      className="peer text-center"
                      value={field.value.toString()}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = parseFloat(e.target.value);
                        field.onChange(isNaN(value) || value < 0 ? 0 : value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* --- Details: Dimensions Type --- */}
            <FormField
              control={form.control}
              name="details.dimensions"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Dimensions</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(valueString) => {
                        try {
                          const selectedOption = dimensionOptions.find(
                            (opt) => JSON.stringify(opt.value) === valueString,
                          );
                          if (selectedOption) {
                            field.onChange(selectedOption.value);
                          }
                        } catch (e) {
                          console.error("Error parsing dimension value", e);
                        }
                      }}
                      defaultValue={JSON.stringify(field.value)}
                      className="flex flex-wrap gap-2"
                    >
                      {dimensionOptions.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center space-x-2 border p-2 rounded-md has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary/50"
                        >
                          <RadioGroupItem
                            value={JSON.stringify(option.value)}
                            id={`${id}-dim-${option.id}`} // Use generated id
                          />
                          <Label
                            htmlFor={`${id}-dim-${option.id}`} // Use generated id
                            className="font-normal cursor-pointer"
                          >
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* --- Details: Labor --- */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              {/* Labor Type Select */}
              <FormField
                control={form.control}
                name="details.labor.laborType"
                render={({ field: typeField }) => (
                  <FormItem>
                    <FormLabel>Labor Type</FormLabel>
                    <FormControl>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={labor?.laborType ?? "null"}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "null") {
                            form.setValue("details.labor", null);
                          } else {
                            form.setValue("details.labor", {
                              id: crypto.randomUUID(),
                              description: "↳ Labor",
                              laborRate:
                                form.getValues("details.labor.laborRate") || 0, // Keep existing rate if possible
                              laborType: value as any, // Cast needed
                            });
                          }
                        }}
                      >
                        <option value="null">No Labor</option>
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Rate</option>
                        <option value="quantity">Per Unit</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Labor Rate Input (Conditional) */}
              {labor && (
                <FormField
                  control={form.control}
                  name="details.labor.laborRate"
                  render={({ field: rateField }) => (
                    <FormItem>
                      <FormLabel>
                        {labor.laborType === "percentage"
                          ? "Labor %"
                          : "Labor Rate"}
                      </FormLabel>
                      <FormControl>
                        <NumericInput
                          prefix={
                            labor.laborType === "percentage"
                              ? ""
                              : currencyToSymbol(activeCurrency || "")
                          }
                          suffix={labor.laborType === "percentage" ? "%" : ""}
                          placeholder="0.00"
                          className="peer text-center"
                          value={rateField.value?.toString() ?? "0"}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const value = parseFloat(e.target.value);
                            rateField.onChange(
                              isNaN(value) || value < 0 ? 0 : value,
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  {" "}
                  Cancel{" "}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={pending || !activeCurrency}
                variant={"brutalist"}
              >
                {pending ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
// --- End of Component ---
