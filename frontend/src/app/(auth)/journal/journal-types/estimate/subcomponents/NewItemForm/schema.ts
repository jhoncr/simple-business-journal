import * as z from "zod";

export const createItemFormSchema = (
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

export type ItemFormValues = z.infer<ReturnType<typeof createItemFormSchema>>;

export const defaultFormValues: ItemFormValues = {
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
