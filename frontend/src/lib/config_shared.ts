// frontend/src/lib/config_shared.ts
// This file contains configurations manually copied from the backend
// for an interim solution to avoid direct backend imports.
// TODO: Replace this with a shared package or API endpoint for configurations.

import * as z from "zod";
import { ENTRY_CONFIG } from "../../../backend/functions/src/common/schemas/configmap";
// Copied from backend/functions/src/common/const.ts
export const JOURNAL_COLLECTION = "journals"; // Added

export const JOURNAL_TYPES = {
  BUSINESS: "business",
} as const;

// Copied and simplified from backend/functions/src/common/schemas/common_schemas.ts
export const allowedCurrencySchema = z.enum(["USD", "BRL"], {
  required_error: "Allowed currency is mandatory.",
  invalid_type_error: "Allowed currency is mandatory.",
});

export const contactInfoSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Name longer than 3 letters is required" })
    .max(50, { message: "Name must be less than 50 characters" }),
  email: z
    .string()
    .email({ message: "Please enter a valid email address" })
    .optional()
    .nullable(),
  phone: z
    .string()
    .min(10, { message: "Phone number must be at least 10 digits" })
    .regex(/^\+?[\d\s-()]+$/, {
      message: "Please enter a valid phone number",
    })
    .optional()
    .nullable(),
  address: z.object({
    street: z
      .string()
      .min(1, { message: "Street address is required" })
      .optional()
      .nullable(),
    city: z
      .string()
      .min(1, { message: "City is required" })
      .optional()
      .nullable(),
    state: z
      .string()
      .min(1, { message: "State is required" })
      .optional()
      .nullable(),
    zipCode: z
      .string()
      .regex(/^\d{5}(-\d{0,4})?$/, {
        message: "Please enter a valid ZIP code",
      })
      .optional()
      .nullable(),
  }),
});

// Copied and simplified from backend/functions/src/common/schemas/JournalSchema.ts
export const BusinessDetailsTypeSchema = z // Renamed from businessDetailsSchema for clarity
  .object({
    currency: allowedCurrencySchema,
    contactInfo: contactInfoSchema,
    logo: z.string().nullable(),
  })
  .strict();

export type BusinessDetailsType = z.infer<typeof BusinessDetailsTypeSchema>;

// Added EntryType based on the shared ENTRY_CONFIG
export type EntryType = keyof typeof ENTRY_CONFIG;
export { ENTRY_CONFIG };
