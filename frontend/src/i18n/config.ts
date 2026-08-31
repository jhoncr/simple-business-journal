import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";
import enMessages from "../../messages/en.json";

// Can be imported from a shared config
export const locales = ["en", "pt"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pt";

function isObject(item: any) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge(target: any, source: any) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

// Provide messages based on the requested locale (runs on the server)
export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  const resolved = (locale || defaultLocale) as Locale;
  if (!locales.includes(resolved)) notFound();

  const userMessages = (await import(`../../messages/${resolved}.json`)).default;
  const mergedMessages = deepMerge(enMessages, userMessages);

  return {
    locale: resolved,
    messages: mergedMessages,
  };
});
