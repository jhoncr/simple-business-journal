import { type ClassValue, clsx } from "clsx";
import { Timestamp } from "firebase/firestore";
import { twMerge } from "tailwind-merge";
import { DBentry, WorkStatus } from "./custom_types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export type DateInput =
  | Timestamp
  | Date
  | { toDate: () => Date }
  | { seconds: number; nanoseconds?: number }
  | string
  | number
  | null
  | undefined;

function resolveIntlLocale(locale?: string): string {
  if (!locale) return "en-US";
  if (locale === "pt") return "pt-BR";
  if (locale === "en") return "en-US";
  return locale;
}

export function formattedDate(entryDate: DateInput, locale?: string): string {
  if (entryDate === null || entryDate === undefined) {
    return "";
  }

  let date: Date | null = null;
  if (entryDate instanceof Timestamp) {
    date = entryDate.toDate();
  } else if (entryDate instanceof Date) {
    date = entryDate;
  } else if (
    typeof entryDate === "object" &&
    "toDate" in entryDate &&
    typeof entryDate.toDate === "function"
  ) {
    date = entryDate.toDate();
  } else if (
    typeof entryDate === "object" &&
    "seconds" in entryDate &&
    typeof entryDate.seconds === "number"
  ) {
    const nanos =
      typeof entryDate.nanoseconds === "number" ? entryDate.nanoseconds : 0;
    date = new Date(entryDate.seconds * 1000 + nanos / 1_000_000);
  } else if (typeof entryDate === "string" || typeof entryDate === "number") {
    date = new Date(entryDate);
  }

  if (!date || isNaN(date.getTime())) {
    return "";
  }

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  try {
    return date.toLocaleDateString(resolveIntlLocale(locale), options);
  } catch {
    return date.toLocaleDateString("en-US", options);
  }
}

// Format currency
export const formatCurrency = (
  amount: number,
  currencyCode: string,
  locale?: string,
): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(resolveIntlLocale(locale), {
      style: "currency",
      currency: currencyCode,
    }).format(safeAmount);
  } catch (error) {
    console.warn("Invalid currency code for formatCurrency:", currencyCode, error);
    return `$${safeAmount.toFixed(2)}`;
  }
};

export const currencyToSymbol = (currency: string): string => {
  if (!currency || typeof currency !== "string") {
    return "$"; // Default to USD symbol
  }

  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    });

    const parts = formatter.formatToParts(0);
    const symbol = parts.find((part) => part.type === "currency")?.value;
    return symbol || "$";
  } catch (error) {
    // Added console.warn for better error visibility during development
    console.warn(
      "Invalid currency code for currencyToSymbol:",
      currency,
      error,
    );
    // Return default USD symbol if currency code is invalid
    return "$";
  }
};

export function getEstimateStatus(entry: DBentry): WorkStatus {
  if (!entry) return WorkStatus.DRAFT;
  const validStatuses: WorkStatus[] = Object.values(WorkStatus);
  if (
    entry.details &&
    typeof entry.details === "object" &&
    "status" in entry.details &&
    entry.details.status &&
    validStatuses.includes(entry.details.status as WorkStatus)
  ) {
    return entry.details.status as WorkStatus;
  }
  if (entry.status && validStatuses.includes(entry.status as WorkStatus)) {
    return entry.status as WorkStatus;
  }
  return WorkStatus.DRAFT;
}
