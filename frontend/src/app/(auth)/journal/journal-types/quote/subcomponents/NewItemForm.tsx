// frontend/src/app/(auth)/journal/journal-types/quote/subcomponents/NewItemForm.tsx
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Plus, ListPlus, Loader2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  LineItem,
  MaterialItem,
} from "@/../../backend/functions/src/common/schemas/quote_schema";
import { allowedCurrencySchemaType } from "@/../../backend/functions/src/common/schemas/common_schemas";
import { ROLES_THAT_ADD } from "@/../../backend/functions/src/common/const"; // Import ROLES_THAT_ADD
import { ROLES } from "@/../../backend/functions/src/common/schemas/common_schemas"; // Import ROLES type
import { EntryItf } from "@/../../backend/functions/src/common/common_types"; // Import type for cache
import { formatCurrency, currencyToSymbol } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useId } from "react";
import { NumericInput } from "@/components/InputUnit";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// --- Updated Props Interface ---
interface NewItemFormProps {
  onAddItem: (item: LineItem[]) => void;
  currency: allowedCurrencySchemaType; // Currency is required
  inventoryCache: Record<string, EntryItf>; // Receive inventory cache as prop
  userRole: (typeof ROLES)[number]; // Add userRole prop
}

// Helper function (no changes)
const getLaborDescription = (
  laborType: "quantity" | "fixed" | "percentage",
  laborRate: number,
  currencySymbol: string, // Added currency symbol for clarity
) => {
  const formattedRate = formatCurrency(laborRate, currencySymbol); // Use util
  switch (laborType) {
    case "percentage":
      return `↳ service fee of ${laborRate}% of line total`;
    case "fixed":
      return `↳ service fee fixed at ${formattedRate}`; // Use formatted rate
    case "quantity":
      return `↳ service fee of ${formattedRate} per unit`; // Use formatted rate
    default:
      return "";
  }
};

// Form schema (no changes)
const itemFormSchema = z
  .object({
    itemType: z.enum(["custom", "inventory"]),
    inventoryId: z.string().optional(),
    description: z.string().max(254, "Max 254 characters"),
    inventoryMaterialName: z
      .string()
      .max(254, "Max 254 characters")
      .optional(),
    quantity: z.number().min(0.01, "Quantity must be greater than 0"),
    unitPrice: z.number().min(0.01, "Unit price must be greater than 0"),
    dimensionType: z.string(),
    length: z.number().optional(),
    width: z.number().optional(),
    laborType: z.enum(["null", "percentage", "fixed", "quantity"]),
    laborRate: z.number().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.dimensionType.startsWith("area")) {
        return data.length !== undefined && data.length > 0;
      }
      return true;
    },
    { message: "Length > 0 required for area", path: ["length"] },
  )
  .refine(
    (data) => {
      if (data.dimensionType.startsWith("area")) {
        return data.width !== undefined && data.width > 0;
      }
      return true;
    },
    { message: "Width > 0 required for area", path: ["width"] },
  )
  .refine(
    (data) => {
      if (data.laborType !== "null") {
        return data.laborRate !== undefined && data.laborRate >= 0; // Allow 0 rate
      }
      return true;
    },
    { message: "Labor rate required", path: ["laborRate"] },
  )
  .refine(
    (data) => {
      if (data.itemType === "custom") {
        return data.description?.trim() !== "";
      }
      return true;
    },
    {
      message: "Description required for custom items",
      path: ["description"],
    },
  );

type ItemFormValues = z.infer<typeof itemFormSchema>;

// --- Main Component (Uses Props) ---
export function NewItemForm({
  onAddItem,
  currency,
  inventoryCache, // Use prop
  userRole, // Use prop
}: NewItemFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1340px)");
  const [isLoadingInventory, setIsLoadingInventory] = useState(false); // Keep local loading state if needed

  // Check if user has permission to add
  const canAdd = useMemo(() => ROLES_THAT_ADD.has(userRole), [userRole]);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      itemType: "custom",
      description: "",
      quantity: 1, // Default quantity to 1
      unitPrice: 0,
      inventoryMaterialName: "",
      dimensionType: "unit-unit",
      length: undefined, // Default to undefined
      width: undefined, // Default to undefined
      laborType: "null",
      laborRate: 0,
    },
  });

  // Convert inventory items using the passed `inventoryCache` and `currency` props
  const inventoryMaterials = useMemo(() => {
    if (!inventoryCache || !currency) return []; // Check currency too

    return (
      Object.entries(inventoryCache)
        // Filter by the currency prop
        .filter(([, item]) => item.details.currency === currency)
        .map(([id, item]) => ({
          id,
          description: `${item.name}`, // Use top-level name
          unitPrice: item.details.unitPrice || 0,
          dimensions: item.details.dimensions || {
            type: "unit" as const,
            unitLabel: "unit" as const,
          },
          currency: item.details.currency as allowedCurrencySchemaType,
          labor: item.details.labor || null,
        }))
    );
    // Depend on props
  }, [inventoryCache, currency]);

  // handleMaterialSelect remains largely the same, uses inventoryCache prop
  const handleMaterialSelect = (materialId: string) => {
    const itemType = materialId === "" ? "custom" : "inventory";
    form.setValue("itemType", itemType);
    form.setValue("inventoryId", materialId);
    form.resetField("description"); // Clear custom description when selecting inventory

    if (materialId === "") {
      // Reset to custom item defaults (keep quantity)
      form.setValue("unitPrice", 0);
      form.setValue("dimensionType", "unit-unit");
      form.setValue("length", undefined);
      form.setValue("width", undefined);
      form.setValue("laborType", "null");
      form.setValue("laborRate", 0);
      form.setValue("inventoryMaterialName", "");
    } else {
      // Find the selected material in the inventoryCache prop
      const inventoryItem = inventoryCache[materialId];
      if (inventoryItem) {
        form.setValue("inventoryMaterialName", inventoryItem.name || "");
        // Don't set description field for inventory items
        form.setValue("unitPrice", inventoryItem.details.unitPrice || 0);
        const dimensions = inventoryItem.details.dimensions || {
          type: "unit",
          unitLabel: "unit",
        };
        form.setValue(
          "dimensionType",
          `${dimensions.type}-${dimensions.unitLabel}`,
        );
        // Reset length/width if switching to unit type
        if (dimensions.type === "unit") {
          form.setValue("length", undefined);
          form.setValue("width", undefined);
        }

        if (inventoryItem.details.labor) {
          form.setValue("laborType", inventoryItem.details.labor.laborType);
          form.setValue("laborRate", inventoryItem.details.labor.laborRate);
        } else {
          form.setValue("laborType", "null");
          form.setValue("laborRate", 0);
        }
      }
    }
  };

  const calculateAreaQuantity = (length?: number, width?: number) => {
    if (length === undefined || width === undefined) return 0;
    console.log("Calculating area quantity:", length, width);
    return Number((length * width).toFixed(2));
  };

  const { watch } = form;
  const formValues = watch();
  const quantity = formValues.quantity || 0;
  const unitPrice = formValues.unitPrice || 0;
  const laborType = formValues.laborType;
  const laborRate = formValues.laborRate || 0;

  const materialTotal = quantity * unitPrice;

  const calculateLaborPrice = (): number => {
    if (laborType === "null" || laborRate === undefined) return 0;
    try {
      switch (laborType) {
        case "percentage":
          return Number((materialTotal * (laborRate / 100)).toFixed(2));
        case "fixed":
          return Number(laborRate.toFixed(2));
        case "quantity":
          return Number((laborRate * quantity).toFixed(2));
        default:
          return 0;
      }
    } catch (error) {
      console.error("Error calculating labor price:", error);
      return 0;
    }
  };

  const laborTotal = calculateLaborPrice();
  const grandTotal = materialTotal + laborTotal;

  const handleAddItem = async () => {
    const isValid = await form.trigger();
    console.log("Form validation result:", isValid, form.formState.errors);
    if (!isValid) return;

    const values = form.getValues();
    const [dimensionType, unitLabel] = values.dimensionType.split("-");

    // Create line item
    const lineItem: LineItem = {
      id: crypto.randomUUID(),
      parentId: "root",
      quantity: values.quantity,
      dimensions: {
        length: values.length, // Keep undefined if not set
        width: values.width, // Keep undefined if not set
      },
      // Use inventoryMaterialName if available, otherwise custom description
      description: values.description,
      material: {
        id: crypto.randomUUID(), // Or use inventoryId if needed upstream?
        description: values.inventoryMaterialName || "", //values.description, // Name for the material itself
        unitPrice: values.unitPrice,
        dimensions: {
          type: dimensionType as "area" | "unit",
          unitLabel: unitLabel as "m²" | "ft²" | "unit",
        },
        currency: currency, // Use prop
        labor: null, // Labor is handled as a separate line item now
      },
    };

    const items = [lineItem];
    console.log("Line item created:", items);

    // Add labor line item if laborType is not 'null'
    if (values.laborType !== "null" && values.laborRate !== undefined) {
      const laborQuantity =
        values.laborType === "quantity" ? values.quantity : 1;
      const laborUnitPrice = laborTotal / laborQuantity; // Calculate unit price for labor

      if (!isNaN(laborUnitPrice) && isFinite(laborUnitPrice)) {
        const laborItem: LineItem = {
          id: crypto.randomUUID(),
          parentId: lineItem.id, // Link labor to its material item
          quantity: laborQuantity,
          description: getLaborDescription(
            values.laborType as "percentage" | "fixed" | "quantity",
            values.laborRate || 0,
            currency,
          ),
          material: {
            id: crypto.randomUUID(),
            description: "Labor", // Generic description for labor material
            unitPrice: laborUnitPrice,
            currency: currency, // Use prop
            dimensions: { type: "unit", unitLabel: "unit" },
            labor: null,
          },
        };
        items.push(laborItem);
      } else {
        console.warn(
          "Calculated labor unit price is invalid, skipping labor item.",
        );
      }
    }

    onAddItem(items);
    // Reset form to initial defaults, keeping quantity=1
    form.reset({
      ...form.getValues(), // Keep current values for a moment
      itemType: "custom",
      description: "",
      quantity: 0, // Reset quantity to 0
      unitPrice: 0,
      inventoryMaterialName: "",
      dimensionType: "unit-unit",
      length: undefined,
      width: undefined,
      laborType: "null",
      laborRate: 0,
      inventoryId: "",
    });
    setIsOpen(false);
  };

  const formContent = (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault(); // Prevent default form submission
          handleAddItem();
        }}
        className="space-y-4 px-4 flex flex-col flex-grow overflow-y-auto" // Allow vertical scroll
        id="newItemForm" // Add ID for submitting from outside button
      >
        {/* Item Type Select */}
        <FormField
          control={form.control}
          name="inventoryId" // Bind to inventoryId to control selection
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Select Item</FormLabel>
              <FormControl>
                <select
                  id="materialSelect"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  onChange={(e) => {
                    handleMaterialSelect(e.target.value);
                    field.onChange(e.target.value); // Update form state for inventoryId
                  }}
                  value={field.value || ""} // Use inventoryId value
                  disabled={isLoadingInventory || !canAdd} // Disable if loading or no permission
                >
                  <option value="">-- Custom Item --</option>
                  {isLoadingInventory ? (
                    <option disabled>Loading inventory...</option>
                  ) : (
                    inventoryMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.description} -{" "}
                        {formatCurrency(material.unitPrice, currency)}
                      </option>
                    ))
                  )}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description (Only enabled for custom) */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter item description"
                  {...field}
                  disabled={!canAdd} // Disable if no permission
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Unit Price (Only enabled for custom) */}
        <FormField
          control={form.control}
          name="unitPrice"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Unit Price</FormLabel>
              <FormControl>
                <NumericInput
                  value={field.value.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    field.onChange(Number.parseFloat(value) || 0);
                  }}
                  prefix={currencyToSymbol(currency || "")}
                  placeholder="0.00"
                  className="peer text-center" // Align center
                  disabled={
                    form.getValues("itemType") === "inventory" || !canAdd
                  } // Disable if inventory or no permission
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dimension Type (Only enabled for custom) */}
        <FormField
          control={form.control}
          name="dimensionType"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Dimension Type</FormLabel>
              <FormControl>
                <RadioGroup
                  className="flex flex-wrap gap-2"
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Recalculate quantity if switching to area
                    if (value.startsWith("area")) {
                      const length = form.getValues("length");
                      const width = form.getValues("width");
                      const quantity = calculateAreaQuantity(length, width);
                      form.setValue("quantity", quantity);
                    } else {
                      // If switching back to unit, maybe reset quantity?
                      // form.setValue("quantity", 1); // Optional reset
                      form.setValue("length", undefined);
                      form.setValue("width", undefined);
                    }
                  }}
                  disabled={
                    form.getValues("itemType") === "inventory" || !canAdd
                  } // Disable if inventory or no permission
                >
                  {[
                    /* ... dimension options ... */
                    { value: "unit-unit", label: "Unit" },
                    { value: "area-m²", label: "Area (m²)" },
                    { value: "area-ft²", label: "Area (ft²)" },
                  ].map((item) => (
                    <div
                      key={item.value}
                      className="border-input hover:bg-accent/50 has-[data-state=checked]:border-primary has-[data-state=checked]:bg-secondary/50 relative flex flex-col items-start rounded-md border p-2 shadow-xs outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value={item.value}
                          id={`dim-${item.value}`}
                          className="after:absolute after:inset-0"
                          disabled={!canAdd} // Disable radio item
                        />
                        <Label
                          htmlFor={`dim-${item.value}`}
                          className={`cursor-pointer ${
                            !canAdd ? "cursor-not-allowed opacity-50" : ""
                          }`} // Style label when disabled
                        >
                          {item.label}
                        </Label>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Length/Width Inputs (Conditional) */}
        {form.watch("dimensionType").startsWith("area") && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="length"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Length</FormLabel>
                  <FormControl>
                    <NumericInput
                      // min="0.01"
                      // step="0.01"
                      className="peer text-center"
                      {...field}
                      value={field.value ?? ""} // Handle undefined
                      onChange={(e) => {
                        const length = Number(e.target.value);
                        console.log("Length:", length);
                        field.onChange(length || undefined); // Store undefined if empty/invalid
                        const width = form.getValues("width");
                        const areaQuantity = calculateAreaQuantity(
                          length,
                          width,
                        );
                        form.setValue("quantity", areaQuantity);
                        form.setValue("length", length); // Update length in form state
                      }}
                      disabled={!canAdd} // Disable if no permission
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Width</FormLabel>
                  <FormControl>
                    <NumericInput
                      // type="number"
                      // min="0.01"
                      // step="0.01"
                      className="peer text-center"
                      {...field}
                      value={field.value ?? ""} // Handle undefined
                      onChange={(e) => {
                        const width = Number(e.target.value);
                        field.onChange(width || undefined); // Store undefined if empty/invalid
                        const length = form.getValues("length");
                        const areaQuantity = calculateAreaQuantity(
                          length,
                          width,
                        );
                        form.setValue("quantity", areaQuantity);
                        form.setValue("width", width); // Update width in form state
                      }}
                      disabled={!canAdd} // Disable if no permission
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Display calculated area */}
            <div className="col-span-2 text-right text-sm font-medium text-muted-foreground">
              Area: {form.watch("quantity")}{" "}
              {form.watch("dimensionType").split("-")[1] || ""}
            </div>
          </div>
        )}

        {/* Quantity (Only enabled for unit dimension) */}
        {!form.watch("dimensionType").startsWith("area") && (
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    // min="0.01"
                    // step="0.01"
                    className="peer text-center"
                    {...field}
                    value={field.value} // Keep as number
                    onChange={(e) =>
                      field.onChange(Number(e.target.value) || 0)
                    } // Ensure number
                    disabled={
                      (form.getValues("itemType") === "inventory" &&
                        form.watch("dimensionType").startsWith("area")) ||
                      !canAdd // Disable if inventory & area based OR no permission
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Labor Type */}
        <FormField
          control={form.control}
          name="laborType"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Service Fee</FormLabel>
              <FormControl>
                <RadioGroup
                  className="flex flex-wrap gap-2"
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={
                    form.getValues("itemType") === "inventory" || !canAdd
                  } // Disable if inventory or no permission
                >
                  {[
                    /* ... labor options ... */
                    { value: "null", label: "No fee" },
                    { value: "percentage", label: "%" },
                    { value: "fixed", label: "Flat" },
                    { value: "quantity", label: "Per Unit" },
                  ].map((item) => (
                    <div
                      key={item.value}
                      className="border-input hover:bg-accent/50 has-[data-state=checked]:border-primary has-[data-state=checked]:bg-secondary/50 relative flex flex-col items-start rounded-md border p-2 shadow-xs outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value={item.value}
                          id={`labor-${item.value}`}
                          className="after:absolute after:inset-0"
                          disabled={!canAdd} // Disable radio item
                        />
                        <Label
                          htmlFor={`labor-${item.value}`}
                          className={`cursor-pointer ${
                            !canAdd ? "cursor-not-allowed opacity-50" : ""
                          }`} // Style label when disabled
                        >
                          {item.label}
                        </Label>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Labor Rate (Conditional) */}
        {form.watch("laborType") !== "null" && (
          <FormField
            control={form.control}
            name="laborRate"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>
                  {form.watch("laborType") === "percentage"
                    ? "Labor %"
                    : "Labor Rate"}
                </FormLabel>
                <FormControl>
                  <NumericInput
                    value={field.value?.toString() ?? "0"} // Handle optional value
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(Number(e.target.value) || 0); // Ensure number
                    }}
                    prefix={
                      form.watch("laborType") === "percentage"
                        ? ""
                        : currencyToSymbol(currency || "")
                    }
                    suffix={
                      form.watch("laborType") === "percentage" ? "%" : ""
                    }
                    placeholder="0.00"
                    className="peer text-center" // Align center
                    disabled={
                      form.getValues("itemType") === "inventory" || !canAdd
                    } // Disable if inventory or no permission
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Total Display */}
        <div className="text-sm font-semibold text-right mt-auto pt-4 border-t">
          {" "}
          {/* Push totals down */}
          <div className="flex justify-between">
            <span>Material:</span>
            <span>{formatCurrency(materialTotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Service Fee:</span>
            <span>{formatCurrency(laborTotal, currency)}</span>
          </div>
          <div className="flex justify-between border-t mt-2 pt-2 text-base">
            <span>Total:</span>
            <span>{formatCurrency(grandTotal, currency)}</span>
          </div>
        </div>
      </form>
    </Form>
  );

  if (isDesktop) {
    return (
      <div
        id="quote-add-item-form"
        // Ensure fixed positioning doesn't overlap printable area
        className="print-hide fixed bottom-4 right-4 z-50 bg-background border rounded-lg p-4 w-[400px] shadow-lg max-h-[calc(100vh-4rem)] flex flex-col" // Max height and flex column
      >
        <div className="mb-4 flex-shrink-0">
          {" "}
          {/* Prevent header shrink */}
          <h3 className="text-lg font-semibold">Add New Item</h3>
        </div>
        <div className="flex-grow overflow-y-auto pr-2">
          {" "}
          {/* Scrollable content */}
          {formContent}
        </div>
        <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
          {" "}
          {/* Prevent footer shrink */}
          <Button
            onClick={form.handleSubmit(handleAddItem)}
            disabled={isLoadingInventory || !canAdd} // Disable if loading or no permission
            variant={"brutalist"}
            type="button" // Use type="button" to prevent default form submission if inside a <form>
            title={!canAdd ? "You don't have permission to add items" : ""} // Add tooltip
          >
            {isLoadingInventory ? (
              <>
                {" "}
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...{" "}
              </>
            ) : (
              <>
                {" "}
                <Plus className="mr-2" size={16} /> Add Item{" "}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Mobile Drawer remains similar
  return (
    <div
      id="quote-add-item-form"
      className="relative mb-6 print-hide print:m-0"
    >
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            size="sm"
            className="w-full gap-2 print-hide"
            variant={"brutalist"}
            disabled={!canAdd} // Disable trigger button
            title={!canAdd ? "You don't have permission to add items" : ""} // Add tooltip
          >
            <ListPlus size={16} /> Add New Item
          </Button>
        </DrawerTrigger>
        <DrawerOverlay className="bg-black/40" />
        <DrawerContent className="flex flex-col max-h-[96%] rounded-t-[10px] bg-background">
          <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted flex-shrink-0" />{" "}
          {/* Drag handle */}
          <div className="max-w-md w-full mx-auto flex flex-col overflow-hidden p-4 rounded-t-[10px] flex-grow">
            <DrawerHeader className="flex-shrink-0">
              <DrawerTitle>Add New Item</DrawerTitle>
            </DrawerHeader>
            {formContent}
            <DrawerFooter className="pt-4 flex-shrink-0">
              <Button
                type="button" // Important for drawers
                onClick={form.handleSubmit(handleAddItem)}
                disabled={isLoadingInventory || !canAdd} // Disable add button
                variant={"brutalist"}
                className="w-full" // Make button full width
                title={!canAdd ? "You don't have permission to add items" : ""} // Add tooltip
              >
                {isLoadingInventory ? (
                  <>
                    {" "}
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Loading...{" "}
                  </>
                ) : (
                  <>
                    {" "}
                    <Plus className="mr-2" size={16} /> Add Item{" "}
                  </>
                )}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
