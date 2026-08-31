import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioCardGroup } from "@/components/ui/radio-card-group";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/InputUnit";
import { Ban, Cuboid, RectangleEllipsis, RectangleHorizontal } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { ItemFormValues } from "./schema";
import { currencyToSymbol } from "@/lib/utils";
import { allowedCurrencySchemaType } from "@backend/common/schemas/common_schemas";
import { useTranslations } from "next-intl";

interface ItemTypeSelectorProps {
  form: UseFormReturn<ItemFormValues>;
  canAdd: boolean;
  currency: allowedCurrencySchemaType;
  onOpenGallery: () => void;
  onClearTemplate: () => void;
}

export function ItemTypeSelector({ form, canAdd, currency, onOpenGallery, onClearTemplate }: ItemTypeSelectorProps) {
  const t = useTranslations("newItemForm");

  return (
    <>
      <FormField
        control={form.control}
        name="itemCategory"
        render={({ field }) => (
          <FormItem className="space-y-0 mt-2 mb-4">
            <FormLabel>{t("itemType")}</FormLabel>
            <FormControl>
              <RadioCardGroup
                idPrefix="category"
                className="grid-cols-2 md:grid-cols-4"
                layout="vertical"
                value={field.value}
                onValueChange={(value: "none" | "gallery" | "window-sill" | "tile-edge") => {
                  field.onChange(value);

                  if (value !== "gallery") {
                    onClearTemplate();
                  }

                  if (value === "window-sill" || value === "tile-edge") {
                    form.setValue("dimensionType", "area-m²");
                    const label = value === "window-sill" ? t("itemTypeWindowSill") : t("itemTypeTileEdge");
                    form.setValue("description", label);
                  } else if (value === "gallery") {
                    form.setValue("dimensionType", "unit-unit");
                    form.setValue("length", undefined);
                    form.setValue("width", undefined);
                    onOpenGallery();
                  }
                }}
                disabled={!canAdd}
                options={[
                  { value: "none", label: t("itemTypeNone"), icon: <Ban className="h-4 w-4" /> },
                  { value: "gallery", label: t("itemTypeGallery"), icon: <Cuboid className="h-4 w-4" /> },
                  { value: "window-sill", label: t("itemTypeWindowSill"), icon: <RectangleEllipsis className="h-4 w-4" /> },
                  { value: "tile-edge", label: t("itemTypeTileEdge"), icon: <RectangleHorizontal className="h-4 w-4" /> },
                ]}
              />
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
    </>
  );
}
