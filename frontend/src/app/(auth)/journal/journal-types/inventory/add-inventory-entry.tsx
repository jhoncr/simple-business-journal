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
import { toast } from "@/components/ui/sonner";
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
      toast.error("Cannot add item. Business currency is not set.");
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

      toast.success(`Inventory item "${payload.name}" added.`);

      form.reset(defaultValues);
      setIsOpen(false);
    } catch (error: any) {
      console.error("Error adding inventory entry:", error);
      toast.error(
        `Error Adding Item: ${
          error.message || "Failed to add inventory item."
        }`,
      );
    } finally {
      setPending(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);
    // Reset form when dialog is closed
    if (!nextOpen) {
      form.reset(defaultValues);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="mr-2">
          <PackagePlus className="h-4 w-4" />
          <span className="sr-only">Add Inventory Item</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Add Inventory Item</DialogTitle>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Item name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="details.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Item description"
                      {...field}
                      //   variant="outline"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="details.unitPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Price</FormLabel>
                  <FormControl>
                    <NumericInput
                      placeholder="0.00"
                      {...field}
                      //   variant="outline"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="details.dimensions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dimensions</FormLabel>
                  <FormControl>
                    <RadioGroup
                      {...field}
                      onValueChange={(value) => {
                        const selectedOption = dimensionOptions.find(
                          (option) => option.id === value,
                        );
                        if (selectedOption) {
                          form.setValue(
                            "details.dimensions",
                            selectedOption.value,
                          );
                        }
                      }}
                    >
                      <div className="flex gap-2">
                        {dimensionOptions.map((option) => (
                          <FormItem
                            key={option.id}
                            className="flex-1 rounded-md border"
                          >
                            <FormControl>
                              <RadioGroupItem value={option.id} />
                            </FormControl>
                            <div className="flex-1 p-2 text-center">
                              {option.label}
                            </div>
                          </FormItem>
                        ))}
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="details.labor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Labor</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Labor cost"
                      {...field}
                      //   variant="outline"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Currency selection is now handled by the parent component (journal context) */}

            <DialogFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={pending}
                variant="primary"
              >
                {pending && (
                  <svg
                    aria-hidden="true"
                    className="mr-2 h-5 w-5 animate-spin fill-current text-white"
                    viewBox="0 0 100 101"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M50.5 0C22.387 0 0 22.387 0 50.5S22.387 101 50.5 101 101 78.613 101 50.5 78.613 0 50.5 0zm0 90.909c-22.173 0-40.409-18.236-40.409-40.409S28.327 10.091 50.5 10.091 90.909 28.327 90.909 50.5 72.673 90.909 50.5 90.909z"
                      opacity="0.4"
                    />
                    <path d="M93.967 28.084a1.75 1.75 0 0 0-2.45-.318A42.662 42.662 0 0 1 50.5 15.909C28.327 15.909 10.091 34.136 10.091 50.5S28.327 85.091 50.5 85.091c11.64 0 22.2-4.54 30.084-11.967a1.75 1.75 0 0 0 .318-2.45l-7.5-7.5a1.75 1.75 0 0 0-2.45.318A32.662 32.662 0 0 1 50.5 78.409c-15.873 0-28.909-13.036-28.909-28.909S34.627 20.591 50.5 20.591c7.64 0 14.7 2.93 20.086 8.086a1.75 1.75 0 0 0 2.45-.318l7.5-7.5z" />
                  </svg>
                )}
                {pending ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
