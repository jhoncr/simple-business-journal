
import { z } from 'zod';

export const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  userId: z.string(),
  timestamp: z.date(),
  details: z.record(z.any()),
});
