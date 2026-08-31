import { useMemo, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ItemFormValues, createItemFormSchema, defaultFormValues } from "./schema";
import { ItemTypeSelector } from "./ItemTypeSelector";
import { DimensionsInput } from "./DimensionsInput";
import { LaborInput } from "./LaborInput";
import { formatCurrency } from "@/lib/utils";
import { LineItem } from "@backend/common/schemas/estimate_schema";
import { allowedCurrencySchemaType, ROLES } from "@backend/common/schemas/common_schemas";
import { ROLES_THAT_ADD } from "@backend/common/const";
import { AttachedTemplate } from "@backend/common/schemas/estimate_schema";

export interface NewItemFormRootProps {
  onAddItem: (items: LineItem[]) => Promise<boolean>;
  currency: allowedCurrencySchemaType;
  userRole: (typeof ROLES)[number];
  editingItem?: LineItem | null;
  confirmedItems?: LineItem[];
  attachedTemplate: AttachedTemplate | null;
  onOpenGallery: () => void;
  onClearTemplate: () => void;
  onSuccess: () => void;
  formId: string;
  setIsSubmitting: (val: boolean) => void;
}

export interface NewItemFormHandle {
  onTemplateSelected: (templateName: string) => void;
  resetOnGalleryDismiss: () => void;
}

export const NewItemForm = forwardRef<NewItemFormHandle, NewItemFormRootProps>(
  (
    {
      onAddItem,
      currency,
      userRole,
      editingItem,
      confirmedItems = [],
      attachedTemplate,
      onOpenGallery,
      onClearTemplate,
      onSuccess,
      formId,
      setIsSubmitting,
    },
    ref
  ) => {
    const t = useTranslations("newItemForm");
  const canAdd = useMemo(() => ROLES_THAT_ADD.has(userRole), [userRole]);

  const populateFormFromLineItem = useCallback(
    (item: LineItem): ItemFormValues => {
      const material = item.material;
      const dimensions = item.dimensions;

      let dimensionType = "unit-unit";
      if (material?.dimensions?.type === "area") {
        dimensionType = `area-${material.dimensions.unitLabel}`;
      }

      const laborItem = confirmedItems.find((ci) => ci.parentId === item.id);
      let laborType: "null" | "percentage" | "fixed" | "quantity" = "null";
      let laborRate = 0;

      if (laborItem && laborItem.material) {
        const laborUnitPrice = laborItem.material.unitPrice;
        const materialTotal = item.quantity * (material?.unitPrice || 0);

        if (laborItem.quantity === 1 && materialTotal > 0) {
          const possiblePercentage = Number(
            ((laborUnitPrice / materialTotal) * 100).toFixed(2),
          );
          if (
            possiblePercentage >= 0 &&
            possiblePercentage <= 100 &&
            Math.abs(materialTotal * (possiblePercentage / 100) - laborUnitPrice) < 0.01
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
          return "   " + t("serviceFeeDescriptions.percentage", { rate: laborRate });
        case "fixed":
          return "   " + t("serviceFeeDescriptions.fixed", { rate: formatCurrency(laborRate, currencySymbol) });
        case "quantity":
          return "   " + t("serviceFeeDescriptions.quantity", { rate: formatCurrency(laborRate, currencySymbol) });
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

  useEffect(() => {
    if (editingItem && editingItem.parentId === "root") {
      const formValues = populateFormFromLineItem(editingItem);
      form.reset(formValues);
    } else if (!editingItem) {
      form.reset(defaultFormValues);
    }
  }, [editingItem, form, populateFormFromLineItem]);

  useImperativeHandle(ref, () => ({
    onTemplateSelected: (name: string) => {
      form.setValue("description", `Custom ${name}`);
      form.setValue("quantity", 1);
      form.setValue("itemCategory", "gallery");
    },
    resetOnGalleryDismiss: () => {
      if (form.getValues("itemCategory") === "gallery" && !attachedTemplate) {
        form.setValue("itemCategory", "none");
      }
    }
  }));

  const formValues = form.watch();
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

      const lengthM = values.length ? Number((values.length / 100).toFixed(4)) : undefined;
      const widthM = values.width ? Number((values.width / 100).toFixed(4)) : undefined;

      return {
        id: editingItem?.id || crypto.randomUUID(),
        parentId: "root",
        quantity: Number(values.quantity.toFixed(2)),
        dimensions: {
          length: lengthM,
          width: widthM,
        },
        description: values.description.trim(),
        material: {
          id: editingItem?.material?.id || crypto.randomUUID(),
          description: values.inventoryMaterialName?.trim() || "",
          unitPrice: Number(values.unitPrice.toFixed(2)),
          dimensions: {
            type: dimensionType as "area" | "unit",
            unitLabel: unitLabel as "m²" | "ft²" | "unit",
          },
          currency: currency,
          labor: null,
        },
        itemCategory: values.itemCategory,
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

      const laborQuantity = values.laborType === "quantity" ? values.quantity : 1;
      if (laborQuantity <= 0) return null;

      const laborUnitPrice = calculatedLaborTotal / laborQuantity;
      if (isNaN(laborUnitPrice) || !isFinite(laborUnitPrice) || laborUnitPrice < 0) return null;

      const existingLaborItem = editingItem
        ? confirmedItems.find((ci) => ci.parentId === editingItem.id)
        : null;

      return {
        id: existingLaborItem?.id || crypto.randomUUID(),
        parentId: parentItem.id,
        quantity: Number(laborQuantity.toFixed(2)),
        description: getLaborDescription(
          values.laborType as "percentage" | "fixed" | "quantity",
          values.laborRate,
          currency,
        ),
        material: {
          id: existingLaborItem?.material?.id || crypto.randomUUID(),
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
    if (!canAdd) return;

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
        onSuccess();
      }
    } catch (error) {
      console.error("Error adding item:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleAddItem)}
        className={`px-4 flex flex-col flex-grow overflow-y-auto ${
          editingItem ? "bg-orange-500/20" : ""
        }`}
        id={formId}
      >
        <ItemTypeSelector form={form} canAdd={canAdd} currency={currency} onOpenGallery={onOpenGallery} onClearTemplate={onClearTemplate} />
        <DimensionsInput form={form} canAdd={canAdd} />
        <LaborInput form={form} canAdd={canAdd} currency={currency} />

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
});
