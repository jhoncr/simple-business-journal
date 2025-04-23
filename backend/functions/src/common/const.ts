// backend/functions/src/common/const.ts
import * as z from "zod";

export const ROLES_THAT_ADD = new Set(["reporter", "admin", "editor"]);
export const ROLES_CAN_DELETE = new Set(["admin", "editor"]);
export const JOURNAL_COLLECTION = "journals";
// --- REMOVE --- (no longer the primary way to identify entries)
// export const ENTRIES_SUBCOLLECTION = "entries";

export const JOURNAL_TYPES = {
  BUSINESS: "business",
  BABY: "baby",
} as const;

// --- NEW: Define Baby Entry Types ---
export const BABY_ENTRY_TYPES = {
  NAP: "nap",
  DIAPER: "diaper",
  FEED: "feed",
  GROWTH: "growth",
} as const;

// --- NEW/UPDATE: Map Entry Types to Subcollections and Schemas ---
// Define baby schemas (simple placeholders for now)
export const napDetailsSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date().optional(),
  notes: z.string().optional(),
});
export const diaperDetailsSchema = z.object({
  time: z.coerce.date(),
  type: z.enum(["wet", "dirty", "mixed"]),
  notes: z.string().optional(),
});
export const feedDetailsSchema = z.object({
  time: z.coerce.date(),
  type: z.enum(["breast", "bottle"]),
  amount: z.number().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});
export const growthDetailsSchema = z.object({
  date: z.coerce.date(),
  weight: z.number().optional(),
  height: z.number().optional(),
  headCirc: z.number().optional(),
  notes: z.string().optional(),
});

export const CURRENCY_OPTIONS: {
  [symbol: string]: { code: string; name: string; symbol: string };
} = {
  USD: { code: "USD", name: "United States Dollar", symbol: "$" },
  BRL: { code: "BRL", name: "Brazilian Real", symbol: "R$" },
};
