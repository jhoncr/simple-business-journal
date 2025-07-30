import { z } from "zod";
import {
  adjustmentSchema,
  contactInfoSchema,
  paymentSchema,
  traceSchema,
} from "./common";
import { inventoryItemSchema } from "./inventory";

export const orderStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "INVOICED",
  "PAID",
  "VOIDED",
]);

export const lineItemSchema = z.object({
  description: z.string(),
  dimensions: z
    .object({
      length: z.number(),
      width: z.number(),
    })
    .optional(),
  quantity: z.number(),
  item: inventoryItemSchema,
});

export const orderSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: orderStatusSchema,
  details: z.object({
    customer: contactInfoSchema,
    notes: z.string().optional(),
    dueDate: z.date().optional(),
    payments: z.array(paymentSchema),
    adjustments: adjustmentSchema,
    items: z.array(lineItemSchema),
  }),
  isActive: z.boolean().default(true),
  trace: traceSchema,
});
