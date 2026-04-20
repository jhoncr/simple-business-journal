import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioCardGroup } from "@/components/ui/radio-card-group";
import { NumericInput } from "@/components/InputUnit";
import { GripHorizontal, RectangleHorizontal } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { ItemFormValues } from "./schema";
import { useTranslations } from "next-intl";

interface DimensionsInputProps {
  form: UseFormReturn<ItemFormValues>;
  canAdd: boolean;
}

// length and width are in cm; area is computed in m²
export const calculateAreaQuantity = (lengthCm?: number, widthCm?: number): number => {
  if (lengthCm === undefined || widthCm === undefined || lengthCm <= 0 || widthCm <= 0) {
    return 0;
  }
  const lengthM = lengthCm / 100;
  const widthM = widthCm / 100;
  return Number((lengthM * widthM).toFixed(2));
};

export function DimensionsInput({ form, canAdd }: DimensionsInputProps) {
  const t = useTranslations("newItemForm");
  const currentCategory = form.watch("itemCategory");
  const isDrawing = ["window-sill", "tile-edge"].includes(currentCategory);

  return (
    <>
      <FormField
        control={form.control}
        name="dimensionType"
        render={({ field }) => {
          return (
            <FormItem className="space-y-0 mt-2">
              <FormLabel>{t("dimensionType")}</FormLabel>
              <FormControl>
                <RadioCardGroup
                  idPrefix="dim"
                  className="grid-cols-2"
                  layout="horizontal"
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
                  options={[
                    {
                      value: "unit-unit",
                      label: t("dimensionUnit"),
                      icon: <GripHorizontal className="h-4 w-4" />,
                      disabled: isDrawing || !canAdd,
                    },
                    {
                      value: "area-m²",
                      label: t("dimensionAreaM2"),
                      icon: <RectangleHorizontal className="h-4 w-4" />,
                      disabled: currentCategory === "gallery" || !canAdd,
                    },
                  ]}
                />
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
                      const areaQuantity = calculateAreaQuantity(length, width);
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
                      const areaQuantity = calculateAreaQuantity(length, width);
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
        {form.watch("quantity")} {form.watch("dimensionType").split("-")[1] || ""}
      </div>
    </>
  );
}
