// backend/functions/src/common/schemas/common_schemas.ts
import * as z from "zod";

export const ROLES = ["viewer", "staff", "editor", "admin"] as const;

// User access schemas
export const UserSchema = z.object({
  displayName: z.string(),
  email: z.string().email(),
  photoURL: z.string().url().optional(),
  role: z.enum(ROLES),
});

export const AccessSchema = z.record(z.string(), UserSchema);
export const pendingAccessSchema = z.record(
  z.string().email({ message: "Please enter a valid email." }),
  z.enum(ROLES),
);

export const allowedCurrencySchema = z.enum(["USD", "BRL"], {
  required_error: "Allowed currency is mandatory.",
  invalid_type_error: "Allowed currency is mandatory.",
});

export type allowedCurrencySchemaType = z.infer<typeof allowedCurrencySchema>;

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

export const traceSchema = z.object({
  createdBy: z.string(),
  createdAt: z.date(),
  updatedBy: z.string(),
  updatedAt: z.date(),
  deletedBy: z.string().optional(),
  deletedAt: z.date().optional(),
});

export type contactInfoSchemaType = z.infer<typeof contactInfoSchema>;

export type AccessMap = z.infer<typeof AccessSchema>;

export type UserSchemaType = z.infer<typeof UserSchema>;

export type pendingAccessSchemaType = z.infer<typeof pendingAccessSchema>;
