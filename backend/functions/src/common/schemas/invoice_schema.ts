import * as z from "zod";
import { contactInfoSchema, allowedCurrencySchema } from "./common_schemas";
import { lineItemSchema, adjustmentSchema } from "./estimate_schema"; // Assuming these can be reused

export const invoiceDetailsSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number cannot be empty"),
  estimateId_ref: z.string().optional(),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { // Basic date string validation
    message: "Due date must be a valid date string",
  }),
  paymentStatus: z.enum(["pending", "paid", "overdue", "cancelled"]),
  customer: contactInfoSchema,
  supplier: contactInfoSchema,
  lineItems: z.array(lineItemSchema),
  adjustments: z.array(adjustmentSchema),
  currency: allowedCurrencySchema,
  notes: z
    .string()
    .max(250, { message: "Notes must be less than 250 characters" })
    .optional()
    .nullable(),
  totalAmount: z.number().nonnegative("Total amount must be a non-negative number"),
  paymentDetails: z
    .object({
      method: z.string().optional(),
      transactionId: z.string().optional(),
      paymentDate: z.string().refine((val) => !isNaN(Date.parse(val)), { // Basic date string validation for paymentDate
        message: "Payment date must be a valid date string",
      }).optional(),
    })
    .optional()
    .nullable(),
});

export type InvoiceDetails = z.infer<typeof invoiceDetailsSchema>;
