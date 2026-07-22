// frontend/src/lib/config_shared.ts
import * as z from "zod";
import { ENTRY_CONFIG } from "@backend/common/schemas/configmap";
import { allowedCurrencySchema, contactInfoSchema } from "@backend/common/schemas/common_schemas";
import { JOURNAL_COLLECTION } from "@backend/common/const";

export { JOURNAL_COLLECTION };

export const JOURNAL_TYPES = {
  BUSINESS: "business",
} as const;

export { allowedCurrencySchema, contactInfoSchema };

export const BusinessDetailsTypeSchema = z
  .object({
    currency: allowedCurrencySchema,
    contactInfo: contactInfoSchema,
    logo: z.string().nullable(),
  })
  .strict();

export type BusinessDetailsType = z.infer<typeof BusinessDetailsTypeSchema>;

export type EntryType = keyof typeof ENTRY_CONFIG;
export { ENTRY_CONFIG };
