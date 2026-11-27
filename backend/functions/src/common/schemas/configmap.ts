import * as z from 'zod';
import { estimateDetailsStateSchema } from './estimate_schema';
import { AssemblyTemplateSchema } from './studio';
import { docIdSchema, ROLES } from './common_schemas';

// Define an interface for entry configuration
interface EntryConfig<T extends z.ZodTypeAny> {
  subcollection: string;
  schema: T;
  displayName?: string; // Optional human-readable name
  icon?: string; // Optional icon identifier
  category: 'business';
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
    sortField: 'createdAt',
    icon: 'ClipboardList',
    allowedRoles: ['staff', 'admin', 'editor'],
  },
  template: {
    subcollection: 'templates',
    schema: AssemblyTemplateSchema,
    displayName: 'Template',
    category: 'business',
    sortField: 'createdAt',
    icon: 'Box',
    allowedRoles: ['admin', 'editor'],
  },
} as const satisfies Record<string, EntryConfig<z.ZodTypeAny>>;

// Type helper to get subcollection names
export type SubcollectionName =
  (typeof ENTRY_CONFIG)[keyof typeof ENTRY_CONFIG]['subcollection'];

// Export schema for entry type validation
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
  entryId: docIdSchema.optional(),
  jid: docIdSchema,
  entryType: entryTypeSchema,
  name: z
    .string()
    .min(3, { message: 'Name must be at least 3 characters.' })
    .max(254, { message: 'Name cannot exceed 254 characters.' }),
  details: z.unknown(), // Will be validated based on entryType
  thumbnailBase64: z
    .string()
    .max(700_000, {
      message: 'Thumbnail is too large (max ~500KB image).',
    })
    .optional(), // Top-level field for the upload
  // Optimistic-concurrency guard for updates: the client sends the updatedAt
  // (in millis) it loaded; the server rejects the write when the document has
  // changed since, instead of silently overwriting with stale data.
  expectedUpdatedAtMillis: z.number().int().positive().optional(),
});
