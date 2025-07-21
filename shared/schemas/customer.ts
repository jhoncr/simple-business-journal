
import { z } from 'zod';
import { contactInfoSchema, traceSchema } from './common';

export const customerSchema = z.object({
  id: z.string(),
  contact: contactInfoSchema,
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
  trace: traceSchema,
});
