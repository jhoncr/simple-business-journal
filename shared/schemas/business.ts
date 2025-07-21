import { z } from "zod";
import { contactInfoSchema, traceSchema } from "./common";

export const roleSchema = z.enum(["Admin", "Staff", "Viewer"]);

export const userAccessSchema = z.object({
  displayName: z.string(),
  email: z.string().email(),
  photoURL: z.string().url(),
  role: roleSchema,
});

export const BaseCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  access: z.record(userAccessSchema),
  access_array: z.array(z.string()),
  pendingAccess: z.record(roleSchema),
  trace: traceSchema,
  isActive: z.boolean().default(true),
});

export const businessSchema = BaseCollectionSchema.extend({
  details: z.object({
    currency: z.string().default("USD"),
    contactInfo: contactInfoSchema,
    logo: z.string().url().optional(),
  }),
});
