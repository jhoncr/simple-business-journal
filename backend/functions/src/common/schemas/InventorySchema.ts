import * as z from "zod";
import { allowedCurrencySchema } from "./common_schemas";

export const dimensionConfigSchema = z.object({
  type: z.enum(["area", "unit"]),
  unitLabel: z.enum(["m²", "ft²", "unit"]),
});

export const laborItemSchema = z.object({
  id: z.string(),
  laborRate: z.number().nonnegative(),
  laborType: z.enum(["quantity", "fixed", "percentage"]),
  description: z.string(),
});

export const materialItemSchema = z
  .object({
    id: z
      .string()
      .min(3, {
        message: "The description must be at least 3 characters.",
      })
      .max(254, {
        message: "A max of 254 characters is allowed in the description.",
      })
      .optional(),
    description: z.string(),
    unitPrice: z.number().nonnegative(),
    dimensions: dimensionConfigSchema,
    currency: allowedCurrencySchema.nullable(),
    labor: laborItemSchema.nullable().optional(), // Labor can be null or undefined
  })
  .strict();

export type materialItemSchemaType = z.infer<typeof materialItemSchema>;
