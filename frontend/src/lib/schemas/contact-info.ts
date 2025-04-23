import * as z from "zod";

export const contactInfoSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Name longer than 3 letters is required" })
    .max(50, { message: "Name must be less than 50 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z
    .string()
    .min(10, { message: "Phone number must be at least 10 digits" })
    .regex(/^\+?[\d\s-()]+$/, {
      message: "Please enter a valid phone number",
    }),
  address: z.object({
    street: z.string().min(1, { message: "Street address is required" }),
    city: z.string().min(1, { message: "City is required" }),
    state: z.string().min(1, { message: "State is required" }),
    zipCode: z.string().regex(/^\d{5}(-\d{0,4})?$/, {
      message: "Please enter a valid ZIP code",
    }),
  }),
});

export type ContactInfoSchema = z.infer<typeof contactInfoSchema>;
