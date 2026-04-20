import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioCardGroup } from "@/components/ui/radio-card-group";
import { NumericInput } from "@/components/InputUnit";
import { Percent, CircleDollarSign, Package, Ban } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { ItemFormValues } from "./schema";
import { currencyToSymbol } from "@/lib/utils";
import { allowedCurrencySchemaType } from "@backend/common/schemas/common_schemas";
import { useTranslations } from "next-intl";

interface LaborInputProps {
  form: UseFormReturn<ItemFormValues>;
  canAdd: boolean;
  currency: allowedCurrencySchemaType;
}

export function LaborInput({ form, canAdd, currency }: LaborInputProps) {
  const t = useTranslations("newItemForm");

  return (
    <>
      <FormField
        control={form.control}
        name="laborType"
        render={({ field }) => (
          <FormItem className="space-y-0 mt-2">
            <FormLabel>{t("serviceFee")}</FormLabel>
            <FormControl>
              <RadioCardGroup
                idPrefix="labor"
                className="grid-cols-2"
                layout="horizontal"
                value={field.value}
                onValueChange={field.onChange}
                disabled={!canAdd}
                options={[
                  { value: "percentage", label: t("serviceFeePercentage"), icon: <Percent className="h-4 w-4" /> },
                  { value: "fixed", label: t("serviceFeeFlatRate"), icon: <CircleDollarSign className="h-4 w-4" /> },
                  { value: "quantity", label: t("serviceFeePerUnit"), icon: <Package className="h-4 w-4" /> },
                  { value: "null", label: t("serviceFeeNone"), icon: <Ban className="h-4 w-4" /> },
                ]}
              />
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
                  if (form.watch("laborType") === "percentage" && value > 1000) {
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
    </>
  );
}
