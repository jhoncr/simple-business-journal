// frontend/src/app/(auth)/journal/journal-types/estimate/subcomponents/NewItemForm.tsx
import { useState, useCallback, useMemo, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  PackagePlus,
  Loader2,
  Percent,
  CircleDollarSign,
  Package,
  Ban,
  GripHorizontal,
  RectangleHorizontal,
  Image as ImageIcon,
  Square,
  Ruler,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTranslations } from "next-intl";
import { LineItem } from "@backend/common/schemas/estimate_schema";
import { allowedCurrencySchemaType } from "@backend/common/schemas/common_schemas";
import { EntryItf } from "@backend/common/common_types";
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
import { TemplateGalleryModal } from "./TemplateGalleryModal";
import { DBentry } from "@/lib/custom_types";
import { AssemblyTemplate } from "@backend/common/schemas/studio";
import { AttachedTemplate } from "@backend/common/schemas/estimate_schema";
import { StoneForgeViewer } from "@/components/studio/StoneForgeViewer";
import { StoneForgeVariableEditor } from "@/components/studio/StoneForgeVariableEditor";
import { useParams, useSearchParams } from "next/navigation";

interface NewItemFormProps {
  onAddItem: (items: LineItem[]) => Promise<boolean>; // Expects a promise now
  currency: allowedCurrencySchemaType;
  inventoryCache: Record<string, EntryItf>;
  userRole: (typeof ROLES)[number];
  editingItem?: LineItem | null;
  onCancelEdit?: () => void;
  confirmedItems?: LineItem[]; // Add this to find labor items
}

// TODO: consolidate with estimate_schema.ts
const createItemFormSchema = (
  t: (key: string, values?: Record<string, any>) => string,
) =>
  z
    .object({
      itemCategory: z.enum(["none", "gallery", "window-sill", "tile-edge"]).default("none"),
      description: z
        .string()
        .min(1, t("validationErrors.descriptionRequired"))
        .max(254, t("validationErrors.maxCharacters", { count: 254 })),
      inventoryMaterialName: z
        .string()
        .max(254, t("validationErrors.maxCharacters", { count: 254 }))
        .optional(),
      quantity: z.number().min(0.01, t("validationErrors.quantityRequired")),
      unitPrice: z.number().min(0, t("validationErrors.unitPriceRequired")),
      dimensionType: z.string(),
      length: z.number().optional(),
      width: z.number().optional(),
      laborType: z.enum(["null", "percentage", "fixed", "quantity"]),
      laborRate: z.number().min(0).optional(),
    })
    .refine(
      (data) => {
        const isCustomDrawing = ["window-sill", "tile-edge"].includes(data.itemCategory);
        if (data.dimensionType.startsWith("area") || isCustomDrawing) {
          return data.length !== undefined && data.length > 0;
        }
        return true;
      },
      {
        message: t("validationErrors.lengthRequiredForArea"),
        path: ["length"],
      },
    )
    .refine(
      (data) => {
        const isCustomDrawing = ["window-sill", "tile-edge"].includes(data.itemCategory);
        if (data.dimensionType.startsWith("area") || isCustomDrawing) {
          return data.width !== undefined && data.width > 0;
        }
        return true;
      },
      {
        message: t("validationErrors.widthRequiredForArea"),
        path: ["width"],
      },
    )
    .refine(
      (data) => {
        if (data.laborType !== "null") {
          return data.laborRate !== undefined && data.laborRate >= 0;
        }
        return true;
      },
      {
        message: t("validationErrors.laborRateRequired"),
        path: ["laborRate"],
      },
    );

type ItemFormValues = z.infer<ReturnType<typeof createItemFormSchema>>;

const defaultFormValues: ItemFormValues = {
  itemCategory: "none",
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
  inventoryCache,
  userRole,
  editingItem,
  onCancelEdit,
  confirmedItems = [],
}: NewItemFormProps) {
  const formId = useId();
  const t = useTranslations("newItemForm");
  const tCommon = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const templateJustSelectedRef = useRef(false);
  const isDesktop = useMediaQuery("(min-width: 1340px)");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  const journalId = (params?.journalId as string) || searchParams?.get("jid") || "";

  const [attachedTemplate, setAttachedTemplate] = useState<AttachedTemplate | null>(null);

  const canAdd = useMemo(() => ROLES_THAT_ADD.has(userRole), [userRole]);

  const populateFormFromLineItem = useCallback(
    (item: LineItem): ItemFormValues => {
      const material = item.material;
      const dimensions = item.dimensions;

      // Determine dimension type
      let dimensionType = "unit-unit";
      if (material?.dimensions?.type === "area") {
        dimensionType = `area-${material.dimensions.unitLabel}`;
      }

      // Find any labor item that belongs to this item
      const laborItem = confirmedItems.find((ci) => ci.parentId === item.id);
      let laborType: "null" | "percentage" | "fixed" | "quantity" = "null";
      let laborRate = 0;

      if (laborItem && laborItem.material) {
        const laborUnitPrice = laborItem.material.unitPrice;
        const materialTotal = item.quantity * (material?.unitPrice || 0);

        // TODO: this should be a property in the estimate schema
        // Try to determine the labor type based on the relationship
        if (laborItem.quantity === 1 && materialTotal > 0) {
          // Check if it's a percentage
          const possiblePercentage = Number(
            ((laborUnitPrice / materialTotal) * 100).toFixed(2),
          );
          if (
            possiblePercentage >= 0 &&
            possiblePercentage <= 100 &&
            Math.abs(
              materialTotal * (possiblePercentage / 100) - laborUnitPrice,
            ) < 0.01
          ) {
            laborType = "percentage";
            laborRate = possiblePercentage;
          } else {
            laborType = "fixed";
            laborRate = laborUnitPrice;
          }
        } else if (laborItem.quantity === item.quantity) {
          laborType = "quantity";
          laborRate = laborUnitPrice;
        } else {
          // Default to fixed if we can't determine
          laborType = "fixed";
          laborRate = laborUnitPrice * laborItem.quantity;
        }
      }

      return {
        itemCategory: item.itemCategory || "none",
        description: item.description,
        inventoryMaterialName: material?.description || item.description,
        quantity: item.quantity,
        unitPrice: material?.unitPrice || 0,
        dimensionType,
        // Convert meters (backend) → cm (form display)
        length: dimensions?.length ? Number((dimensions.length * 100).toFixed(2)) : undefined,
        width: dimensions?.width ? Number((dimensions.width * 100).toFixed(2)) : undefined,
        laborType,
        laborRate,
      };
    },
    [confirmedItems],
  );

  const getLaborDescription = useCallback(
    (
      laborType: "quantity" | "fixed" | "percentage",
      laborRate: number,
      currencySymbol: string,
    ): string => {
      switch (laborType) {
        case "percentage":
          return (
            "   " + t("serviceFeeDescriptions.percentage", { rate: laborRate })
          );
        case "fixed":
          return (
            "   " +
            t("serviceFeeDescriptions.fixed", {
              rate: formatCurrency(laborRate, currencySymbol),
            })
          );
        case "quantity":
          return (
            "   " +
            t("serviceFeeDescriptions.quantity", {
              rate: formatCurrency(laborRate, currencySymbol),
            })
          );
        default:
          return "";
      }
    },
    [t],
  );

  const itemFormSchema = useMemo(() => createItemFormSchema(t), [t]);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: defaultFormValues,
  });

  // Effect to populate form when editing an item
  useEffect(() => {
    if (editingItem && editingItem.parentId === "root") {
      const formValues = populateFormFromLineItem(editingItem);
      form.reset(formValues);
      setAttachedTemplate(editingItem.attachedTemplate || null);
      setIsOpen(true); // Open dialog on mobile
    } else if (!editingItem) {
      form.reset(defaultFormValues);
      setAttachedTemplate(null);
      setIsOpen(false); // Close dialog when not editing
    }
  }, [editingItem, form, populateFormFromLineItem]);

  // length and width are in cm; area is computed in m²
  const calculateAreaQuantity = (lengthCm?: number, widthCm?: number): number => {
    if (
      lengthCm === undefined ||
      widthCm === undefined ||
      lengthCm <= 0 ||
      widthCm <= 0
    ) {
      return 0;
    }
    const lengthM = lengthCm / 100;
    const widthM = widthCm / 100;
    return Number((lengthM * widthM).toFixed(2));
  };

  const { watch } = form;
  const formValues = watch();

  // Memoize calculated values to prevent unnecessary recalculations
  const { quantity = 0, unitPrice = 0, laborType, laborRate = 0 } = formValues;

  const materialTotal = useMemo(() => {
    return Number((quantity * unitPrice).toFixed(2));
  }, [quantity, unitPrice]);

  const laborTotal = useMemo(() => {
    if (laborType === "null" || laborRate === undefined || laborRate < 0) {
      return 0;
    }

    try {
      let total = 0;
      switch (laborType) {
        case "percentage":
          total = materialTotal * (laborRate / 100);
          break;
        case "fixed":
          total = laborRate;
          break;
        case "quantity":
          total = laborRate * quantity;
          break;
        default:
          return 0;
      }

      // Ensure result is valid
      return isFinite(total) && !isNaN(total) ? Number(total.toFixed(2)) : 0;
    } catch (error) {
      console.error("Error calculating labor price:", error);
      return 0;
    }
  }, [laborType, laborRate, materialTotal, quantity]);

  const grandTotal = useMemo(() => {
    return Number((materialTotal + laborTotal).toFixed(2));
  }, [materialTotal, laborTotal]);

  const createLineItemFromForm = useCallback(
    (values: ItemFormValues): LineItem => {
      const [dimensionType, unitLabel] = values.dimensionType.split("-");

      // Validate dimension type and unit label
      const validDimensionTypes = ["area", "unit"];
      const validUnitLabels = ["m²", "ft²", "unit"];

      if (!validDimensionTypes.includes(dimensionType)) {
        console.error(`Invalid dimension type: ${dimensionType}`);
        throw new Error("Invalid dimension type");
      }

      if (!validUnitLabels.includes(unitLabel)) {
        console.error(`Invalid unit label: ${unitLabel}`);
        throw new Error("Invalid unit label");
      }

      // Convert cm (form) → meters (backend) for storage
      const lengthM = values.length ? Number((values.length / 100).toFixed(4)) : undefined;
      const widthM = values.width ? Number((values.width / 100).toFixed(4)) : undefined;

      return {
        id: editingItem?.id || crypto.randomUUID(), // Preserve ID when editing
        parentId: "root",
        quantity: Number(values.quantity.toFixed(2)),
        dimensions: {
          length: lengthM,
          width: widthM,
        },
        description: values.description.trim(),
        material: {
          id: editingItem?.material?.id || crypto.randomUUID(), // Preserve material ID when editing
          description: values.inventoryMaterialName?.trim() || "",
          unitPrice: Number(values.unitPrice.toFixed(2)),
          dimensions: {
            type: dimensionType as "area" | "unit",
            unitLabel: unitLabel as "m²" | "ft²" | "unit",
          },
          currency: currency,
          labor: null,
        },
        itemCategory: values.itemCategory !== "none" ? values.itemCategory : undefined,
        attachedTemplate: attachedTemplate,
      };
    },
    [currency, editingItem, attachedTemplate],
  );

  const createLaborItem = useCallback(
    (
      values: ItemFormValues,
      parentItem: LineItem,
      calculatedLaborTotal: number,
    ): LineItem | null => {
      if (
        values.laborType === "null" ||
        values.laborRate === undefined ||
        values.laborRate <= 0
      ) {
        return null;
      }

      const laborQuantity =
        values.laborType === "quantity" ? values.quantity : 1;

      // Avoid division by zero
      if (laborQuantity <= 0) {
        console.warn("Labor quantity must be greater than 0");
        return null;
      }

      const laborUnitPrice = calculatedLaborTotal / laborQuantity;

      // Validate the calculated unit price
      if (
        isNaN(laborUnitPrice) ||
        !isFinite(laborUnitPrice) ||
        laborUnitPrice < 0
      ) {
        console.warn(
          `Invalid labor unit price calculated: ${laborUnitPrice}. Skipping labor item.`,
        );
        return null;
      }

      // Find existing labor item if editing
      const existingLaborItem = editingItem
        ? confirmedItems.find((ci) => ci.parentId === editingItem.id)
        : null;

      return {
        id: existingLaborItem?.id || crypto.randomUUID(), // Preserve ID when editing
        parentId: parentItem.id,
        quantity: Number(laborQuantity.toFixed(2)),
        description: getLaborDescription(
          values.laborType as "percentage" | "fixed" | "quantity",
          values.laborRate,
          currency,
        ),
        material: {
          id: existingLaborItem?.material?.id || crypto.randomUUID(), // Preserve material ID
          description: t("laborItemDescription"),
          unitPrice: Number(laborUnitPrice.toFixed(2)),
          currency: currency,
          dimensions: { type: "unit", unitLabel: "unit" },
          labor: null,
        },
      };
    },
    [currency, getLaborDescription, t, editingItem, confirmedItems],
  );

  const handleAddItem = async (values: ItemFormValues) => {
    if (!canAdd) {
      console.warn("User does not have permission to add items");
      return;
    }

    // Ensure inventoryMaterialName is set
    values.inventoryMaterialName = values.description;

    setIsSubmitting(true);

    try {
      const lineItem = createLineItemFromForm(values);
      const laborItem = createLaborItem(values, lineItem, laborTotal);

      const itemsToAdd = [lineItem];
      if (laborItem) {
        itemsToAdd.push(laborItem);
      }

      const success = await onAddItem(itemsToAdd);

      if (success) {
        form.reset(defaultFormValues);
        setAttachedTemplate(null);
        setIsOpen(false);
        if (editingItem && onCancelEdit) {
          onCancelEdit(); // Clear editing state
        }
      }
    } catch (error) {
      console.error("Error adding item:", error);
      // Consider showing a toast notification here
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTemplate = (templateEntry: DBentry) => {
    const templateDetails = templateEntry.details as AssemblyTemplate;

    const newAttachedTemplate: AttachedTemplate = {
      sourceTemplateId: templateEntry.id,
      snapshot: JSON.parse(JSON.stringify(templateDetails)), // deep copy
      variableOverrides: {},
    };

    // Signal that a template was selected so onOpenChange doesn't revert itemCategory
    templateJustSelectedRef.current = true;
    setAttachedTemplate(newAttachedTemplate);
    form.setValue("description", `Custom ${templateDetails.name}`);
    form.setValue("quantity", 1);
    form.setValue("itemCategory", "gallery");
    setIsGalleryOpen(false);
    setIsOpen(true);
  };

  const handleVariableChange = (variableId: string, newValue: number) => {
    if (!attachedTemplate) return;

    setAttachedTemplate({
      ...attachedTemplate,
      variableOverrides: {
        ...(attachedTemplate.variableOverrides || {}),
        [variableId]: newValue
      }
    });
  };

  const mergedVariables = useMemo(() => {
    if (!attachedTemplate) return {};

    const merged: Record<string, number> = {};
    attachedTemplate.snapshot.variables.forEach(v => {
      if (v.label) {
        merged[v.label] = v.default;
      }
    });

    Object.entries(attachedTemplate.variableOverrides || {}).forEach(([id, value]) => {
      const variable = attachedTemplate.snapshot.variables.find(v => v.id === id);
      if (variable && variable.label) {
        merged[variable.label] = value;
      }
    });

    return merged;
  }, [attachedTemplate]);

  const formContent = (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleAddItem)}
        className={`px-4 flex flex-col flex-grow overflow-y-auto ${editingItem ? "bg-orange-500/20" : ""
          }`}
        id={formId}
      >
        <FormField
          control={form.control}
          name="itemCategory"
          render={({ field }) => (
            <FormItem className="space-y-0 mt-2 mb-4">
              <FormLabel>{t("itemType")}</FormLabel>
              <FormControl>
                <RadioGroup
                  className="grid grid-cols-2 md:grid-cols-4 gap-2"
                  value={field.value}
                  onValueChange={(value: "none" | "gallery" | "window-sill" | "tile-edge") => {
                    field.onChange(value);

                    if (value === "window-sill" || value === "tile-edge") {
                      form.setValue("dimensionType", "area-m²");
                      const label = value === "window-sill" ? t("itemTypeWindowSill") : t("itemTypeTileEdge");
                      form.setValue("description", label);
                    } else if (value === "gallery") {
                      form.setValue("dimensionType", "unit-unit");
                      form.setValue("length", undefined);
                      form.setValue("width", undefined);
                      // Open gallery modal if no template already attached
                      if (!attachedTemplate) {
                        setIsGalleryOpen(true);
                      }
                    }
                    // "none" → no side effects
                  }}
                  disabled={!canAdd}
                >
                  {[
                    {
                      value: "none",
                      label: t("itemTypeNone"),
                      icon: <Ban className="h-4 w-4" />,
                    },
                    {
                      value: "gallery",
                      label: t("itemTypeGallery"),
                      icon: <ImageIcon className="h-4 w-4" />,
                    },
                    {
                      value: "window-sill",
                      label: t("itemTypeWindowSill"),
                      icon: <Square className="h-4 w-4" />,
                    },
                    {
                      value: "tile-edge",
                      label: t("itemTypeTileEdge"),
                      icon: <Ruler className="h-4 w-4" />,
                    },
                  ].map((item) => (
                    <div
                      key={item.value}
                      className={`border-input hover:bg-accent/50 relative flex flex-col items-center justify-center rounded-md border p-2 shadow-xs outline-none ${
                        field.value === item.value
                          ? "border-primary border-4 bg-primary/10 shadow-md"
                          : ""
                      }`}
                    >
                      <RadioGroupItem
                        value={item.value}
                        id={`category-${item.value}`}
                        className="peer sr-only"
                        disabled={!canAdd}
                      />
                      <Label
                        htmlFor={`category-${item.value}`}
                        className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-center text-xs ${
                          field.value === item.value
                            ? "font-semibold text-primary"
                            : ""
                        } ${!canAdd ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {item.icon}
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="space-y-0 mt-2">
              <FormLabel>{t("description")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("descriptionPlaceholder")}
                  {...field}
                  disabled={!canAdd}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unitPrice"
            render={({ field }) => (
              <FormItem className="space-y-0 mt-2">
                <FormLabel>{t("unitPrice")}</FormLabel>
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
                    aria-label={t("unitPrice")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!form.watch("dimensionType").startsWith("area") && (
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem className="space-y-0 mt-2">
                  <FormLabel>{t("quantity")}</FormLabel>
                  <FormControl>
                    <NumericInput
                      className="peer text-center"
                      value={field.value.toString()}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = Number(e.target.value);
                        field.onChange(value >= 0 ? value : 0);
                      }}
                      disabled={!canAdd}
                      aria-label={t("quantity")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={form.control}
          name="dimensionType"
          render={({ field }) => {
            const currentCategory = form.watch("itemCategory");
            const isDrawing = ["window-sill", "tile-edge"].includes(currentCategory);

            return (
              <FormItem className="space-y-0 mt-2">
                <FormLabel>{t("dimensionType")}</FormLabel>
                <FormControl>
                  <RadioGroup
                    className="grid grid-cols-2 gap-2"
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
                      {
                        value: "unit-unit",
                        label: t("dimensionUnit"),
                        icon: <GripHorizontal className="h-4 w-4" />,
                        isDisabled: isDrawing || !canAdd,
                      },
                      {
                        value: "area-m²",
                        label: t("dimensionAreaM2"),
                        icon: <RectangleHorizontal className="h-4 w-4" />,
                        isDisabled: currentCategory === "gallery" || !canAdd,
                      },
                      // { value: "area-ft²", label: t("dimensionAreaFt2") },
                    ].map((item) => (
                      <div
                        key={item.value}
                        className={`border-input relative flex flex-col items-center justify-center rounded-md border p-2 shadow-xs outline-none ${field.value === item.value
                            ? "border-4 bg-primary/10 shadow-md border-primary"
                            : ""
                          } ${item.isDisabled ? "opacity-50 bg-muted" : "hover:bg-accent/50"}`}
                      >
                        <div className="flex items-center">
                          <RadioGroupItem
                            value={item.value}
                            id={`dim-${item.value}`}
                            className="peer sr-only"
                            disabled={item.isDisabled}
                          />
                          <Label
                            htmlFor={`dim-${item.value}`}
                            className={`flex h-full w-full items-center justify-center gap-2 ${field.value === item.value
                                ? "font-semibold text-primary"
                                : ""
                              } ${item.isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            {item.icon}
                            {item.label}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {form.watch("dimensionType").startsWith("area") && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="length"
              render={({ field }) => (
                <FormItem className="space-y-0 mt-2">
                  <FormLabel>{t("length")}</FormLabel>
                  <FormControl>
                    <NumericInput
                      className="peer text-center"
                      suffix="cm"
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
                <FormItem className="space-y-0 mt-2">
                  <FormLabel>{t("width")}</FormLabel>
                  <FormControl>
                    <NumericInput
                      className="peer text-center"
                      suffix="cm"
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
          </div>
        )}

        <div className="text-right text-sm font-medium text-muted-foreground mt-0">
          {form.watch("quantity")}{" "}
          {form.watch("dimensionType").split("-")[1] || ""}
        </div>

        <FormField
          control={form.control}
          name="laborType"
          render={({ field }) => (
            <FormItem className="space-y-0 mt-2">
              <FormLabel>{t("serviceFee")}</FormLabel>
              <FormControl>
                <RadioGroup
                  className="grid grid-cols-2 gap-2"
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canAdd}
                >
                  {[
                    {
                      value: "percentage",
                      label: t("serviceFeePercentage"),
                      icon: <Percent className="h-4 w-4" />,
                    },
                    {
                      value: "fixed",
                      label: t("serviceFeeFlatRate"),
                      icon: <CircleDollarSign className="h-4 w-4" />,
                    },
                    {
                      value: "quantity",
                      label: t("serviceFeePerUnit"),
                      icon: <Package className="h-4 w-4" />,
                    },
                    {
                      value: "null",
                      label: t("serviceFeeNone"),
                      icon: <Ban className="h-4 w-4" />,
                    },
                  ].map((item) => (
                    <div
                      key={item.value}
                      className={`border-input hover:bg-accent/50 relative flex flex-col items-center justify-center border p-1 shadow-xs outline-none ${field.value === item.value
                          ? "border-primary border-4 bg-primary/10"
                          : ""
                        }`}
                    >
                      <RadioGroupItem
                        value={item.value}
                        id={`labor-${item.value}`}
                        className="peer sr-only"
                        disabled={!canAdd}
                      />
                      <Label
                        htmlFor={`labor-${item.value}`}
                        className={`flex h-full w-full cursor-pointer flex-row items-center justify-center gap-2 p-2 text-center ${field.value === item.value
                            ? "font-semibold text-primary"
                            : ""
                          } ${!canAdd ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {item.icon}
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="laborRate"
          render={({ field }) => (
            <FormItem className="space-y-0 mt-2">
              <FormLabel>
                {form.watch("laborType") === "percentage"
                  ? t("laborPercentage")
                  : t("laborRate")}
              </FormLabel>
              <FormControl>
                <NumericInput
                  value={field.value?.toString() ?? "0"}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = Number(e.target.value);
                    // Prevent negative values and excessive percentages
                    if (
                      form.watch("laborType") === "percentage" &&
                      value > 1000 // max of 1000% to prevent absurd entries
                    ) {
                      field.onChange(100);
                    } else {
                      field.onChange(value >= 0 ? value : 0);
                    }
                  }}
                  prefix={
                    form.watch("laborType") === "percentage"
                      ? ""
                      : currencyToSymbol(currency || "")
                  }
                  suffix={form.watch("laborType") === "percentage" ? "%" : ""}
                  placeholder="0.00"
                  className="peer text-center"
                  disabled={!canAdd || form.watch("laborType") === "null"}
                  aria-label={
                    form.watch("laborType") === "percentage"
                      ? t("laborPercentage")
                      : t("laborRate")
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {attachedTemplate && (
          <div className="mt-6 mb-2 border rounded-md overflow-hidden bg-white shadow-sm">
            <StoneForgeVariableEditor
              template={attachedTemplate.snapshot}
              overrides={attachedTemplate.variableOverrides}
              onVariableChange={handleVariableChange}
              scrollable={false}
            />
          </div>
        )}

        <div className="text-sm font-semibold text-right mt-auto pt-4 border-t">
          <div className="flex justify-between">
            <span>{t("material")}:</span>
            <span>{formatCurrency(materialTotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("serviceFeeSummary")}:</span>
            <span>{formatCurrency(laborTotal, currency)}</span>
          </div>
          <div className="flex justify-between border-t mt-2 pt-2 text-base">
            <span>{t("total")}:</span>
            <span>{formatCurrency(grandTotal, currency)}</span>
          </div>
        </div>
      </form>
    </Form>
  );

  const combinedContent = attachedTemplate ? (
    <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] lg:grid-cols-[2fr_1fr] gap-6 h-full min-h-[600px]">
      {/* LEFT PANE: 3D Viewer (Maximized Real Estate) */}
      <div className="flex flex-col h-full bg-secondary/20 rounded-md overflow-hidden border relative min-h-[400px]">
        <StoneForgeViewer
          components={attachedTemplate.snapshot.components}
          variables={mergedVariables}
          fixedCameraView={attachedTemplate.snapshot.cameraViews?.[0]}
        />
      </div>

      {/* RIGHT PANE: Form & Variables */}
      <div className="flex flex-col h-full overflow-hidden border-l pl-2">
        {formContent}
      </div>
    </div>
  ) : (
    <div className="flex-grow overflow-y-auto pr-2">{formContent}</div>
  );

  if (isDesktop) {
    return (
      <>
        <div
          id="estimate-add-item-form"
          className={`print:hidden fixed bottom-4 right-4 z-50 bg-background border rounded-lg p-4 shadow-lg max-h-[calc(100vh-4rem)] flex flex-col ${attachedTemplate ? 'w-[95vw] max-w-7xl' : 'w-[400px]'}`}
        >
          <div className="mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold">
              {editingItem ? t("editItem") : t("title")}
            </h3>
          </div>
          <div className="flex-grow overflow-y-auto pr-2">{combinedContent}</div>
          <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
            {editingItem && onCancelEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset(defaultFormValues);
                  setAttachedTemplate(null);
                  onCancelEdit();
                }}
              >
                {t("cancel")}
              </Button>
            )}
            {!editingItem && attachedTemplate && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset(defaultFormValues);
                  setAttachedTemplate(null);
                }}
              >
                Clear Template
              </Button>
            )}
            <Button
              type="submit"
              form={formId}
              disabled={isSubmitting || !canAdd}
              variant={"brutalist"}
              title={!canAdd ? t("permissionDenied") : ""}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("saving")}
                </>
              ) : (
                <>
                  <Plus className="mr-2" size={16} />
                  {editingItem ? t("updateItem") : t("addItem")}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Controlled gallery modal — opened when user clicks "Gallery" radio */}
        <TemplateGalleryModal
          journalId={journalId}
          onSelectTemplate={handleSelectTemplate}
          disabled={!canAdd}
          open={isGalleryOpen}
          onOpenChange={(open) => {
            setIsGalleryOpen(open);
          if (!open && templateJustSelectedRef.current) {
              templateJustSelectedRef.current = false;
            } else if (!open && !attachedTemplate) {
              form.setValue("itemCategory", "none");
            }
          }}
        />
      </>
    );
  }

  return (
    <div
      id="estimate-add-item-form"
      className="relative mb-6 print:hidden print:m-0"
    >
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          // If dialog is closing and we're in edit mode, cancel the edit
          if (!open && editingItem && onCancelEdit) {
            onCancelEdit();
          }
        }}
      >
        {!editingItem && (
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="w-full gap-2 print:hidden"
              variant={"brutalist"}
              disabled={!canAdd}
              title={!canAdd ? t("permissionDenied") : ""}
            >
              <PackagePlus size={16} /> {t("title")}
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className={`${attachedTemplate ? 'max-w-[95vw] xl:max-w-7xl max-h-[90vh]' : 'max-w-md max-h-[90vh]'} flex flex-col overflow-hidden`}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingItem ? t("editItem") : t("title")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-2">{combinedContent}</div>
          <DialogFooter className="pt-4 flex flex-row shrink-0 gap-2">
            {attachedTemplate && !editingItem && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  form.reset(defaultFormValues);
                  setAttachedTemplate(null);
                }}
              >
                Clear Template
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline" className="w-full" onClick={() => {
                if (editingItem && onCancelEdit) {
                  onCancelEdit();
                }
              }}>
                {editingItem ? t("cancel") : tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form={formId}
              disabled={isSubmitting || !canAdd}
              variant={"brutalist"}
              className="w-full"
              title={!canAdd ? t("permissionDenied") : ""}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  <Plus className="mr-2" size={16} />
                  {editingItem ? t("updateItem") : t("addItem")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Controlled gallery modal — opened when user clicks "Gallery" radio */}
      <TemplateGalleryModal
        journalId={journalId}
        onSelectTemplate={handleSelectTemplate}
        disabled={!canAdd}
        open={isGalleryOpen}
        onOpenChange={(open) => {
          setIsGalleryOpen(open);
          // If user dismissed the gallery without selecting a template, revert to "none"
          if (!open && templateJustSelectedRef.current) {
            templateJustSelectedRef.current = false;
          } else if (!open && !attachedTemplate) {
            form.setValue("itemCategory", "none");
          }
        }}
      />
    </div>
  );
}
