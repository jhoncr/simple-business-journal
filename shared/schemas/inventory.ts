import { z } from "zod";
import { moneySchema, traceSchema } from "./common";

export const unitLabelSchema = z.enum(["m²", "ft²", "unit"]);

export const inventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  unitPrice: moneySchema,
  unitLabel: unitLabelSchema,
  labor: z
    .object({
      laborRate: z.number(),
      laborType: z.enum(["per-unit", "fixed", "percentage"]),
      description: z.string(),
    })
    .optional(),
  isActive: z.boolean().default(true),
  trace: traceSchema,
});
