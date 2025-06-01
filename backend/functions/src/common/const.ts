// backend/functions/src/common/const.ts
// import * as z from "zod";

export const ROLES_THAT_ADD = new Set(["reporter", "admin", "editor"]); // Changed "staff" to "reporter"
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

export const CURRENCY_OPTIONS: {
  [symbol: string]: { code: string; name: string; symbol: string };
} = {
  USD: { code: "USD", name: "United States Dollar", symbol: "$" },
  BRL: { code: "BRL", name: "Brazilian Real", symbol: "R$" },
};
