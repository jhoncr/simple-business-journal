// backend/functions/src/common/schemas/BabySchema.ts
import * as z from "zod";

export const napDetailsSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const diaperDetailsSchema = z.object({
  time: z.coerce.date(),
  type: z.enum(["wet", "dirty", "mixed"]),
  notes: z.string().optional(),
});

export const feedDetailsSchema = z.object({
  time: z.coerce.date(),
  type: z.enum(["breast", "bottle"]),
  amount: z.number().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

export const growthDetailsSchema = z.object({
  date: z.coerce.date(),
  weight: z.number().optional(),
  height: z.number().optional(),
  headCirc: z.number().optional(),
  notes: z.string().optional(),
});
