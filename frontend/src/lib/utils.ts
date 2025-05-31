import { type ClassValue, clsx } from "clsx";
import { Timestamp } from "firebase/firestore";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function formattedDate(entryDate: Timestamp | Date) {
  // console.log(entryDate);

  let date: Date = new Date();
  if (entryDate instanceof Timestamp) {
    date = new Date(entryDate.toDate());
  }
  let options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  // Corrected logic: Display the year if the entry's year is different from the current year.
  if (date.getFullYear() !== new Date().getFullYear()) {
    options["year"] = "numeric";
  }
  return date.toLocaleDateString("en-US", options);
}

// Format currency
// Renamed parameter currencySymbol to currencyCode for clarity.
export const formatCurrency = (amount: number, currencyCode: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode, // Use the renamed parameter
  }).format(amount);
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
    console.warn("Invalid currency code for currencyToSymbol:", currency, error);
    // Return default USD symbol if currency code is invalid
    return "$";
  }
};
