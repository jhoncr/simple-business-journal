import { z } from "zod";
import {
  businessSchema,
  cashflowEntrySchema,
  customerSchema,
  eventSchema,
  inventoryItemSchema,
  orderSchema,
  roleSchema,
  userAccessSchema,
} from "../schemas";

export type Business = z.infer<typeof businessSchema>;
export type Role = z.infer<typeof roleSchema>;
export type UserAccess = z.infer<typeof userAccessSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type CashflowEntry = z.infer<typeof cashflowEntrySchema>;
export type Event = z.infer<typeof eventSchema>;
