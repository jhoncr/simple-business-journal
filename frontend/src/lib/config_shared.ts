// frontend/src/lib/config_shared.ts
// This file contains configurations manually copied from the backend
// for an interim solution to avoid direct backend imports.
// TODO: Replace this with a shared package or API endpoint for configurations.

import * as z from "zod";

// Copied from backend/functions/src/common/const.ts
export const JOURNAL_COLLECTION = "journals"; // Added

export const JOURNAL_TYPES = {
  BUSINESS: "business",
  BABY: "baby",
} as const;

export const BABY_ENTRY_TYPES = {
  NAP: "nap",
  DIAPER: "diaper",
  FEED: "feed",
  GROWTH: "growth",
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

// Copied and simplified from backend/functions/src/common/schemas/configmap.ts
// Define a simplified interface for entry configuration for frontend use
interface FrontendEntryConfig {
  subcollection: string;
  // schema is omitted or typed as any as frontend doesn't execute backend Zod schemas directly
  // schema: any; // Or z.ZodTypeAny if you want to keep zod type but not specific schema
  displayName?: string;
  icon?: string;
  category: "business" | "baby" | "other";
  sortField?: string;
}

// Map EntryType -> EntryConfig (frontend version)
// Schemas are represented as empty objects or `as any` since frontend doesn't use them for validation here.
export const ENTRY_CONFIG: Record<string, FrontendEntryConfig> = {
  // Business Entry Types
  cashflow: {
    subcollection: "cashflow_entries",
    // schema: {} as any, // Placeholder for backend schema
    displayName: "Cash Flow",
    category: "business",
    sortField: "details.date",
  },
  inventory: {
    subcollection: "inventory_items",
    // schema: {} as any,
    displayName: "Inventory",
    category: "business",
    sortField: "createdAt",
  },
  estimate: {
    subcollection: "estimates",
    // schema: {} as any,
    displayName: "Estimate",
    category: "business",
    sortField: "createdAt",
  },

  // Baby Entry Types
  [BABY_ENTRY_TYPES.NAP]: {
    subcollection: "naps",
    // schema: {} as any,
    displayName: "Nap",
    category: "baby",
    sortField: "details.start",
  },
  [BABY_ENTRY_TYPES.DIAPER]: {
    subcollection: "diapers",
    // schema: {} as any,
    displayName: "Diaper",
    category: "baby",
    sortField: "details.time",
  },
  [BABY_ENTRY_TYPES.FEED]: {
    subcollection: "feeds",
    // schema: {} as any,
    displayName: "Feed",
    category: "baby",
    sortField: "details.time",
  },
  [BABY_ENTRY_TYPES.GROWTH]: {
    subcollection: "growth_entries",
    // schema: {} as any,
    displayName: "Growth",
    category: "baby",
    sortField: "details.date",
  },
};

// Added EntryType based on the shared ENTRY_CONFIG
export type EntryType = keyof typeof ENTRY_CONFIG;
