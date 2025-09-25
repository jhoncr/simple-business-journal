import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

// Can be imported from a shared config
export const locales = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "ja",
  "ko",
  "zh",
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pt";

// Provide messages based on the requested locale (runs on the server)
export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  const resolved = (locale || defaultLocale) as Locale;
  if (!locales.includes(resolved)) notFound();

  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
  };
});
