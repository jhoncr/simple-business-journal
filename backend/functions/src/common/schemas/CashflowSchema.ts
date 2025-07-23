import * as z from 'zod';

export const cashFlowEntryDetailsSchema = z.object({
  description: z
    .string()
    .min(3, {
      message: 'The description must be at least 3 characters.',
    })
    .max(254, {
      message: 'A max of 254 characters is allowed in the description.',
    }),
  date: z.coerce
    .date({
      required_error: 'An entry date is required',
    })
    .nullable(),
  type: z.enum(['received', 'paid'], {
    required_error: 'Please select an entry type.', // Renamed to avoid confusion with journalType
  }),
  value: z.coerce.number().min(0.01, {
    message: 'The value must be greater than 0.',
  }),
  currency: z.enum(['USD', 'BRL'], {
    required_error: 'Please select a currency.',
  }),
});

export type CashFlowEntryDetailsType = z.infer<
  typeof cashFlowEntryDetailsSchema
>;
