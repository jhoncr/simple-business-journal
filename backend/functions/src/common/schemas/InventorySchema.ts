import * as z from 'zod';
import { allowedCurrencySchema } from './common_schemas';

export const dimensionConfigSchema = z.object({
  type: z.enum(['area', 'unit']),
  unitLabel: z.enum(['m²', 'ft²', 'unit']),
});

export const laborItemSchema = z.object({
  id: z.string(), // TODO: Define if this ID is local, global, or linked to another collection
  laborRate: z.number().nonnegative(),
  laborType: z.enum(['quantity', 'fixed', 'percentage']),
  description: z.string(),
});

export const materialItemSchema = z
  .object({
    id: z
      .string()
      .min(3, {
        message: 'ID must be at least 3 characters.', // Corrected message
      })
      .max(254, {
        message: 'ID cannot exceed 254 characters.', // Adjusted message for ID
      })
      .optional(),
    description: z
      .string()
      .min(3, { message: 'Description must be at least 3 characters.' })
      .max(254, { message: 'Description cannot exceed 254 characters.' }),
    unitPrice: z.number().nonnegative(),
    dimensions: dimensionConfigSchema,
    currency: allowedCurrencySchema.nullable(),
    labor: laborItemSchema.nullable().optional(), // Labor can be null or undefined
    entryType: z.enum(['material', 'labor', 'service']).optional(), // Added entryType
  })
  .strict();

export type materialItemSchemaType = z.infer<typeof materialItemSchema>;
