import * as z from 'zod';
// import { BABY_ENTRY_TYPES } from "../const"; // TODO: Fix missing BabySchema.ts or BABY_ENTRY_TYPES export and re-enable baby entry types.
// import {
//   napDetailsSchema,
//   diaperDetailsSchema,
//   feedDetailsSchema,
//   growthDetailsSchema,
// } from "./BabySchema"; // Updated import path // TODO: Fix missing BabySchema.ts or BABY_ENTRY_TYPES export and re-enable baby entry types.
import { cashFlowEntryDetailsSchema } from './CashflowSchema';
import { materialItemSchema } from './InventorySchema';
import { estimateDetailsStateSchema } from './estimate_schema';
// import { invoiceDetailsSchema } from "./invoice_schema";

// Define an interface for entry configuration
interface EntryConfig<T extends z.ZodTypeAny> {
  subcollection: string;
  schema: T;
  displayName?: string; // Optional human-readable name
  icon?: string; // Optional icon identifier
  category: 'business';
  sortField?: string; // Optional sort field
}

// Map EntryType -> EntryConfig
export const ENTRY_CONFIG = {
  // Business Entry Types
  cashflow: {
    subcollection: 'cashflow_entries',
    schema: cashFlowEntryDetailsSchema,
    displayName: 'Cash Flow',
    category: 'business',
    sortField: 'details.date', // Add sortField
  },
  inventory: {
    subcollection: 'inventory_items',
    schema: materialItemSchema,
    displayName: 'Inventory',
    category: 'business',
    sortField: 'createdAt', // Add sortField
  },
  estimate: {
    subcollection: 'estimates',
    schema: estimateDetailsStateSchema,
    displayName: 'Estimate',
    category: 'business',
    sortField: 'createdAt', // Add sortField
    icon: 'ClipboardList', // Added icon
  },
  // invoice: {
  //   subcollection: "invoices",
  //   schema: invoiceDetailsSchema,
  //   displayName: "Invoice",
  //   category: "business",
  //   sortField: "details.dueDate",
  //   icon: "ReceiptText", // Added icon
  // },

  // Baby Entry Types // TODO: Fix missing BabySchema.ts or BABY_ENTRY_TYPES export and re-enable baby entry types.
  // [BABY_ENTRY_TYPES.NAP]: {
  //   subcollection: "naps",
  //   schema: napDetailsSchema,
  //   displayName: "Nap",
  //   category: "baby",
  //   sortField: "details.start", // Add sortField
  // },
  // [BABY_ENTRY_TYPES.DIAPER]: {
  //   subcollection: "diapers",
  //   schema: diaperDetailsSchema,
  //   displayName: "Diaper",
  //   category: "baby",
  //   sortField: "details.time", // Add sortField
  // },
  // [BABY_ENTRY_TYPES.FEED]: {
  //   subcollection: "feeds",
  //   schema: feedDetailsSchema,
  //   displayName: "Feed",
  //   category: "baby",
  //   sortField: "details.time", // Add sortField
  // },
  // [BABY_ENTRY_TYPES.GROWTH]: {
  //   subcollection: "growth_entries",
  //   schema: growthDetailsSchema,
  //   displayName: "Growth",
  //   category: "baby",
  //   sortField: "details.date", // Add sortField
  // },
} as const satisfies Record<string, EntryConfig<any>>;

// Helper functions to filter entries by category
export const getBusinessEntries = () =>
  Object.entries(ENTRY_CONFIG)
    .filter(([_, config]) => config.category === 'business')
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

// TODO: Uncomment or adjust getBabyEntries when baby entry types are re-enabled.
// export const getBabyEntries = () =>
//   Object.entries(ENTRY_CONFIG)
//     .filter(([_, config]) => config.category === "baby")
//     .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

// Type helper to get subcollection names
export type SubcollectionName =
  (typeof ENTRY_CONFIG)[keyof typeof ENTRY_CONFIG]['subcollection'];

// export schema for entry type validation

export const entryTypeSchema = z.enum(
  Object.keys(ENTRY_CONFIG) as [string, ...string[]],
  {
    required_error: 'Entry type is mandatory.',
    invalid_type_error: 'Invalid entry type.',
  },
);
export type EntryType = keyof typeof ENTRY_CONFIG;
// Entry schema

export const entrySchema = z.object({
  entryId: z.string().optional(),
  journalId: z.string(),
  entryType: entryTypeSchema,
  name: z
    .string()
    .min(3, { message: 'Name must be at least 3 characters.' })
    .max(254, { message: 'Name cannot exceed 254 characters.' }),
  details: z.unknown(), // Will be validated based on entryType
});
