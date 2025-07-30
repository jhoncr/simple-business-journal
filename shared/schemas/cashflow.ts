
import { z } from 'zod';
import { moneySchema, traceSchema } from './common';

export const cashflowEntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  eventDate: z.date(),
  type: z.enum(['received', 'paid']),
  amount: moneySchema,
  isActive: z.boolean().default(true),
  trace: traceSchema,
});
