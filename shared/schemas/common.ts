import { z } from "zod";

export const traceSchema = z.object({
  createdBy: z.string(),
  createdAt: z.date(),
  updatedBy: z.string(),
  updatedAt: z.date(),
  deletedBy: z.string().optional(),
  deletedAt: z.date().optional(),
});

export const contactInfoSchema = z.object({
  name: z.string(),
  emails: z.array(z.string().email()).min(1),
  phones: z.array(z.string()).min(1),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
});

export const moneySchema = z.object({
  amount: z.number(),
  currency: z.string().default("USD"),
});

export const adjustmentSchema = z.object({
  preTax: z
    .array(
      z.object({
        type: z.enum([
          "addPercent",
          "addFixed",
          "discountPercent",
          "discountFixed",
        ]),
        value: z.number(),
        description: z.string(),
      }),
    )
    .default([]),
  taxRate: z.number().min(0).max(1).default(0),
});

export const paymentSchema = z.object({
  amount: moneySchema,
  date: z.date(),
  method: z.string(),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});
