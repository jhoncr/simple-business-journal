import * as z from 'zod';
import {
  AccessSchema,
  allowedCurrencySchema,
  contactInfoSchema,
  pendingAccessSchema,
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
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    deletedAt: z.coerce.date().optional(),
    deletedBy: z.string().optional(),
    journalType: journalTypeSchema,
    details: businessDetailsSchema.optional(),
    isActive: z.boolean(),
  })
  .strict();


export type JournalSchemaType = z.infer<typeof JournalSchema>;
export type BusinessDetailsType = z.infer<typeof businessDetailsSchema>;
export type AccessMap = z.infer<typeof AccessSchema>;
export type PendingAccess = z.infer<typeof JournalSchema>['pendingAccess'];
