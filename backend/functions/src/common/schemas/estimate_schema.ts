import * as z from "zod";
import { contactInfoSchema, allowedCurrencySchema } from "./common_schemas";
import {
  materialItemSchema,
  laborItemSchema,
  dimensionConfigSchema,
} from "./InventorySchema";

export const currencyCodeSchema = allowedCurrencySchema; // ISO 4217 currency codes are 3 letters
// Add this near the top of the file, before the schemas
export const currencySchema = z
  .object({
    code: currencyCodeSchema, // ISO 4217 currency codes are 3 letters
    symbol: z.string(),
    name: z.string(),
  })
  .nullable();

export const paymentSchema = z.object({
  id: z.string().cuid().optional(),
  amount: z.number().positive("Payment amount must be positive."),
  date: z.coerce.date(),
  method: z.string().optional().nullable(),
  transactionId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const lineItemSchema = z.object({
  id: z.string(),
  parentId: z.string(),
  quantity: z.number().nonnegative(),
  dimensions: z
    .object({
      length: z.number().nonnegative().optional().nullable(),
      width: z.number().nonnegative().optional().nullable(),
    })
    .optional()
    .nullable(),
  description: z
    .string()
    .min(3, {
      message: "The description must be at least 3 characters.",
    })
    .max(254, {
      message: "A max of 254 characters is allowed in the description.",
    }),
  material: materialItemSchema,
});

export const adjustmentSchema = z.object({
  type: z.enum([
    "addPercent",
    "addFixed",
    "discountPercent",
    "discountFixed",
    "taxPercent",
  ]),
  value: z.number().nonnegative(),
  description: z.string(),
});

import { EstimateStatus, InvoiceStatus } from "../common_types";

export const estimateDetailsStateSchema = z.object({
  confirmedItems: z.array(lineItemSchema),
  status: z.union([z.nativeEnum(EstimateStatus), z.nativeEnum(InvoiceStatus)]),
  customer: contactInfoSchema,
  supplier: contactInfoSchema,
  logo: z.string().nullable(),
  adjustments: z.array(adjustmentSchema),
  taxPercentage: z.number().nonnegative(),
  currency: currencyCodeSchema,
  notes: z
    .string()
    .max(250, { message: "Notes must be less than 250 characters" })
    .optional()
    .nullable(),

  // Fields from invoice
  dueDate: z.coerce.date().optional().nullable(),
  payments: z.array(paymentSchema).optional(),
});

export type estimateDetailsState = z.infer<typeof estimateDetailsStateSchema>;
export type contactInfoSchemaType = z.infer<typeof contactInfoSchema>;
export type LineItem = z.infer<typeof lineItemSchema>;
export type Adjustment = z.infer<typeof adjustmentSchema>;
export type MaterialItem = z.infer<typeof materialItemSchema>;
export type LaborItem = z.infer<typeof laborItemSchema>;
export type DimensionConfig = z.infer<typeof dimensionConfigSchema>;
export type Payment = z.infer<typeof paymentSchema>;
// Add the type export
export type Currency = z.infer<typeof currencySchema>;
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
