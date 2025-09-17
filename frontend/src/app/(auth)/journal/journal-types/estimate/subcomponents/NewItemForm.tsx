// frontend/src/app/(auth)/journal/journal-types/estimate/subcomponents/NewItemForm.tsx
import { useState, useMemo } from "react";
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
import { LineItem } from "@backend/common/schemas/estimate_schema";
import { allowedCurrencySchemaType } from "@backend/common/schemas/common_schemas";
import { ROLES_THAT_ADD } from "@backend/common/const";
import { ROLES } from "@backend/common/schemas/common_schemas";
import { formatCurrency, currencyToSymbol } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NumericInput } from "@/components/InputUnit";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface NewItemFormProps {
  onAddItem: (items: LineItem[]) => Promise<boolean>; // Expects a promise now
  currency: allowedCurrencySchemaType;
  userRole: (typeof ROLES)[number];
}

const getLaborDescription = (
  laborType: "quantity" | "fixed" | "percentage",
  laborRate: number,
  currencySymbol: string,
) => {
  const formattedRate = formatCurrency(laborRate, currencySymbol);
  switch (laborType) {
    case "percentage":
      return `↳ service fee of ${laborRate}% of line total`;
    case "fixed":
      return `↳ service fee fixed at ${formattedRate}`;
    case "quantity":
      return `↳ service fee of ${formattedRate} per unit`;
    default:
      return "";
  }
};

const itemFormSchema = z
  .object({
    description: z
      .string()
      .min(1, "Description is required")
      .max(254, "Max 254 characters"),
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
        return data.laborRate !== undefined && data.laborRate >= 0;
      }
      return true;
    },
    { message: "Labor rate required", path: ["laborRate"] },
  );

type ItemFormValues = z.infer<typeof itemFormSchema>;

const defaultFormValues: ItemFormValues = {
  description: "",
  quantity: 1,
  unitPrice: 0,
  inventoryMaterialName: "",
  dimensionType: "unit-unit",
  length: undefined,
  width: undefined,
  laborType: "null",
  laborRate: 0,
};

export function NewItemForm({
  onAddItem,
  currency,
  userRole,
}: NewItemFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1340px)");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAdd = useMemo(() => ROLES_THAT_ADD.has(userRole), [userRole]);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: defaultFormValues,
  });

  const calculateAreaQuantity = (length?: number, width?: number) => {
    if (length === undefined || width === undefined) return 0;
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

  const createLineItemFromForm = (values: ItemFormValues): LineItem => {
    const [dimensionType, unitLabel] = values.dimensionType.split("-");
    return {
      id: crypto.randomUUID(),
      parentId: "root",
      quantity: values.quantity,
      dimensions: {
        length: values.length,
        width: values.width,
      },
      description: values.description,
      material: {
        id: crypto.randomUUID(),
        description: values.inventoryMaterialName || "",
        unitPrice: values.unitPrice,
        dimensions: {
          type: dimensionType as "area" | "unit",
          unitLabel: unitLabel as "m²" | "ft²" | "unit",
        },
        currency: currency,
        labor: null,
      },
    };
  };

  const createLaborItem = (
    values: ItemFormValues,
    parentItem: LineItem,
  ): LineItem | null => {
    if (values.laborType === "null" || values.laborRate === undefined) {
      return null;
    }

    const laborQuantity =
      values.laborType === "quantity" ? values.quantity : 1;
    const laborUnitPrice = laborTotal / laborQuantity;

    if (!isNaN(laborUnitPrice) && isFinite(laborUnitPrice)) {
      return {
        id: crypto.randomUUID(),
        parentId: parentItem.id,
        quantity: laborQuantity,
        description: getLaborDescription(
          values.laborType as "percentage" | "fixed" | "quantity",
          values.laborRate || 0,
          currency,
        ),
        material: {
          id: crypto.randomUUID(),
          description: "Labor",
          unitPrice: laborUnitPrice,
          currency: currency,
          dimensions: { type: "unit", unitLabel: "unit" },
          labor: null,
        },
      };
    }
    console.warn(
      "Calculated labor unit price is invalid, skipping labor item.",
    );
    return null;
  };

  const handleAddItem = async (values: ItemFormValues) => {
    values.inventoryMaterialName = values.description;

    setIsSubmitting(true);
    const lineItem = createLineItemFromForm(values);
    const laborItem = createLaborItem(values, lineItem);

    const itemsToAdd = [lineItem];
    if (laborItem) {
      itemsToAdd.push(laborItem);
    }

    const success = await onAddItem(itemsToAdd);

    if (success) {
      form.reset(defaultFormValues);
      setIsOpen(false);
    }
    setIsSubmitting(false);
  };

  const formContent = (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleAddItem)}
        className="space-y-4 px-4 flex flex-col flex-grow overflow-y-auto"
        id="newItemForm"
      >
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
                  disabled={!canAdd}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  className="peer text-center"
                  disabled={!canAdd}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                    if (value.startsWith("area")) {
                      const length = form.getValues("length");
                      const width = form.getValues("width");
                      const quantity = calculateAreaQuantity(length, width);
                      form.setValue("quantity", quantity);
                    } else {
                      form.setValue("length", undefined);
                      form.setValue("width", undefined);
                    }
                  }}
                  disabled={!canAdd}
                >
                  {[
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
                          disabled={!canAdd}
                        />
                        <Label
                          htmlFor={`dim-${item.value}`}
                          className={`cursor-pointer ${
                            !canAdd ? "cursor-not-allowed opacity-50" : ""
                          }`}
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
                      className="peer text-center"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const length = Number(e.target.value);
                        field.onChange(length || undefined);
                        const width = form.getValues("width");
                        const areaQuantity = calculateAreaQuantity(
                          length,
                          width,
                        );
                        form.setValue("quantity", areaQuantity);
                      }}
                      disabled={!canAdd}
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
                      className="peer text-center"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const width = Number(e.target.value);
                        field.onChange(width || undefined);
                        const length = form.getValues("length");
                        const areaQuantity = calculateAreaQuantity(
                          length,
                          width,
                        );
                        form.setValue("quantity", areaQuantity);
                      }}
                      disabled={!canAdd}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-2 text-right text-sm font-medium text-muted-foreground">
              Area: {form.watch("quantity")}{" "}
              {form.watch("dimensionType").split("-")[1] || ""}
            </div>
          </div>
        )}

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
                    className="peer text-center"
                    {...field}
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(Number(e.target.value) || 0)
                    }
                    disabled={!canAdd}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
                  disabled={!canAdd}
                >
                  {[
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
                          disabled={!canAdd}
                        />
                        <Label
                          htmlFor={`labor-${item.value}`}
                          className={`cursor-pointer ${
                            !canAdd ? "cursor-not-allowed opacity-50" : ""
                          }`}
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
                    value={field.value?.toString() ?? "0"}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(Number(e.target.value) || 0);
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
                    className="peer text-center"
                    disabled={!canAdd}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="text-sm font-semibold text-right mt-auto pt-4 border-t">
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
        id="estimate-add-item-form"
        className="print:hidden fixed bottom-4 right-4 z-50 bg-background border rounded-lg p-4 w-[400px] shadow-lg max-h-[calc(100vh-4rem)] flex flex-col"
      >
        <div className="mb-4 flex-shrink-0">
          <h3 className="text-lg font-semibold">Add New Item</h3>
        </div>
        <div className="flex-grow overflow-y-auto pr-2">{formContent}</div>
        <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
          <Button
            type="submit"
            form="newItemForm"
            disabled={isSubmitting || !canAdd}
            variant={"brutalist"}
            title={!canAdd ? "You don't have permission to add items" : ""}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Plus className="mr-2" size={16} /> Add Item
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="estimate-add-item-form"
      className="relative mb-6 print:hidden print:m-0"
    >
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            size="sm"
            className="w-full gap-2 print:hidden"
            variant={"brutalist"}
            disabled={!canAdd}
            title={!canAdd ? "You don't have permission to add items" : ""}
          >
            <ListPlus size={16} /> Add New Item
          </Button>
        </DrawerTrigger>
        <DrawerOverlay className="bg-black/40" />
        <DrawerContent className="flex flex-col max-h-[96%] rounded-t-[10px] bg-background">
          <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted flex-shrink-0" />
          <div className="max-w-md w-full mx-auto flex flex-col overflow-hidden p-4 rounded-t-[10px] flex-grow">
            <DrawerHeader className="flex-shrink-0">
              <DrawerTitle>Add New Item</DrawerTitle>
            </DrawerHeader>
            {formContent}
            <DrawerFooter className="pt-4 flex-shrink-0">
              <Button
                type="submit"
                form="newItemForm"
                disabled={isSubmitting || !canAdd}
                variant={"brutalist"}
                className="w-full"
                title={!canAdd ? "You don't have permission to add items" : ""}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2" size={16} /> Add Item
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