// backend/functions/src/common/schemas/common_schemas.ts
import * as z from 'zod';

export const ROLES = ['viewer', 'staff', 'editor', 'admin'] as const;

// User access schemas
export const UserSchema = z.object({
  displayName: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email(),
  photoURL: z.string().url().optional().nullable().or(z.literal('')),
  role: z.enum(ROLES),
});

export const AccessSchema = z.record(z.string(), UserSchema);
export const pendingAccessSchema = z.record(
  z.string(),
  z.enum(ROLES),
);

export const allowedCurrencySchema = z.enum(['USD', 'BRL'], {
  required_error: 'Allowed currency is mandatory.',
  invalid_type_error: 'Allowed currency is mandatory.',
});

export type allowedCurrencySchemaType = z.infer<typeof allowedCurrencySchema>;

export const contactInfoSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Name longer than 3 letters is required' })
    .max(50, { message: 'Name must be less than 50 characters' }),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address' })
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z
    .string()
    .min(10, { message: 'Phone number must be at least 10 digits' })
    .regex(/^\+?[\d\s-()]+$/, {
      message: 'Please enter a valid phone number',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z.object({
    street: z
      .string()
      .min(1, { message: 'Street address is required' })
      .optional()
      .nullable()
      .or(z.literal('')),
    city: z
      .string()
      .min(1, { message: 'City is required' })
      .optional()
      .nullable()
      .or(z.literal('')),
    state: z
      .string()
      .min(1, { message: 'State is required' })
      .optional()
      .nullable()
      .or(z.literal('')),
    zipCode: z
      .string()
      .regex(/^\d{5}(-\d{0,4})?$/, {
        message: 'Please enter a valid ZIP code',
      })
      .optional()
      .nullable()
      .or(z.literal('')),
  }),
});

// Firestore Date Schema: handles JS Date, Firestore Timestamp instances (.toDate()),
// Firestore serialized objects ({ seconds, nanoseconds } or { _seconds, _nanoseconds }),
// numeric timestamps, and ISO strings.
export const firestoreDateSchema = z.preprocess((val: unknown) => {
  if (val === null || val === undefined || val === '') return val;
  if (val instanceof Date) return val;
  if (typeof val === 'object') {
    if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate();
    }
    const sec =
      (val as { seconds?: number; _seconds?: number }).seconds ??
      (val as { _seconds?: number })._seconds;
    const nsec =
      (val as { nanoseconds?: number; _nanoseconds?: number }).nanoseconds ??
      (val as { _nanoseconds?: number })._nanoseconds ??
      0;
    if (typeof sec === 'number') {
      return new Date(sec * 1000 + nsec / 1000000);
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return val;
}, z.date());

export const traceSchema = z.object({
  createdBy: z.string(),
  createdAt: firestoreDateSchema,
  updatedBy: z.string(),
  updatedAt: firestoreDateSchema,
  deletedBy: z.string().optional().nullable(),
  deletedAt: firestoreDateSchema.optional().nullable(),
});

export type contactInfoSchemaType = z.infer<typeof contactInfoSchema>;

export type AccessMap = z.infer<typeof AccessSchema>;

export type UserSchemaType = z.infer<typeof UserSchema>;

export type pendingAccessSchemaType = z.infer<typeof pendingAccessSchema>;
