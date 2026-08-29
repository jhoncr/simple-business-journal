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

export const traceSchema = z.object({
  createdBy: z.string(),
  createdAt: z.coerce.date(),
  updatedBy: z.string(),
  updatedAt: z.coerce.date(),
  deletedBy: z.string().optional(),
  deletedAt: z.coerce.date().optional(),
});

export type contactInfoSchemaType = z.infer<typeof contactInfoSchema>;

export type AccessMap = z.infer<typeof AccessSchema>;

export type UserSchemaType = z.infer<typeof UserSchema>;

export type pendingAccessSchemaType = z.infer<typeof pendingAccessSchema>;
