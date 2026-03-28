import * as z from 'zod';
// import { BABY_ENTRY_TYPES } from "../const"; // TODO: Fix missing BabySchema.ts or BABY_ENTRY_TYPES export and re-enable baby entry types.
// import {
//   napDetailsSchema,
//   diaperDetailsSchema,
//   feedDetailsSchema,
//   growthDetailsSchema,
// } from "./BabySchema"; // Updated import path // TODO: Fix missing BabySchema.ts or BABY_ENTRY_TYPES export and re-enable baby entry types.
import { estimateDetailsStateSchema } from './estimate_schema';
// import { invoiceDetailsSchema } from "./invoice_schema";
import { AssemblyTemplateSchema } from './studio';
import { ROLES } from './common_schemas';

// Define an interface for entry configuration
interface EntryConfig<T extends z.ZodTypeAny> {
  subcollection: string;
  schema: T;
  displayName?: string; // Optional human-readable name
  icon?: string; // Optional icon identifier
  category: 'business' | 'baby'; // Added baby for now if ever enabled
  sortField?: string; // Optional sort field
  allowedRoles: readonly (typeof ROLES)[number][];
}

// Map EntryType -> EntryConfig
export const ENTRY_CONFIG = {
  // Business Entry Types
  estimate: {
    subcollection: 'estimates',
    schema: estimateDetailsStateSchema,
    displayName: 'Estimate',
    category: 'business',
    sortField: 'createdAt', // Add sortField
    icon: 'ClipboardList', // Added icon
    allowedRoles: ['staff', 'admin', 'editor'],
  },
  template: {
    subcollection: 'templates',
    schema: AssemblyTemplateSchema,
    displayName: 'Template',
    category: 'business',
    sortField: 'createdAt',
    icon: 'Box',
    allowedRoles: ['admin'],
  },
  // invoice: {
  //   subcollection: "invoices",
  //   schema: invoiceDetailsSchema,
  //   displayName: "Invoice",
  //   category: "business",
  //   sortField: "details.dueDate",
  //   icon: "ReceiptText", // Added icon
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
  jid: z.string(),
  entryType: entryTypeSchema,
  name: z
    .string()
    .min(3, { message: 'Name must be at least 3 characters.' })
    .max(254, { message: 'Name cannot exceed 254 characters.' }),
  details: z.unknown(), // Will be validated based on entryType
});
