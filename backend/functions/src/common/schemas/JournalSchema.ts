import * as z from 'zod';
import {
  AccessSchema,
  allowedCurrencySchema,
  contactInfoSchema,
  pendingAccessSchema,
  firestoreDateSchema,
} from './common_schemas';
import { JOURNAL_TYPES } from '../const';

export const journalTypeSchema = z.nativeEnum(JOURNAL_TYPES);

export const businessDetailsSchema = z
  .object({
    currency: allowedCurrencySchema,
    contactInfo: contactInfoSchema,
    logo: z.string().nullable(),
  })
  .strict();

export const JournalSchema = z
  .object({
    id: z.string().min(20).max(50).optional(),
    title: z.string(),
    access: AccessSchema,
    access_array: z.array(z.string()),
    pendingAccess: pendingAccessSchema.optional(),
    createdAt: firestoreDateSchema,
    updatedAt: firestoreDateSchema.optional().nullable(),
    deletedAt: firestoreDateSchema.optional().nullable(),
    deletedBy: z.string().optional().nullable(),
    journalType: journalTypeSchema,
    details: businessDetailsSchema.optional(),
    isActive: z.boolean(),
  })
  .strict();


export type JournalSchemaType = z.infer<typeof JournalSchema>;
export type BusinessDetailsType = z.infer<typeof businessDetailsSchema>;
export type AccessMap = z.infer<typeof AccessSchema>;
export type PendingAccess = z.infer<typeof JournalSchema>['pendingAccess'];
