import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/** Supported locales. The array order does not affect detection precedence. */
const SUPPORTED_LOCALES = ["en", "ja"] as const;

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Parses an Accept-Language header string and returns the best matching
 * supported locale, respecting q-factor weighting.
 *
 * @param acceptLanguage - The value of the Accept-Language HTTP header.
 * @returns The best matching locale from SUPPORTED_LOCALES, defaulting to "en".
 */
export function detectLocale(acceptLanguage: string): SupportedLocale {
  if (!acceptLanguage) { return "en"; }

  // Parse "en-US,en;q=0.9,ja;q=0.8" into [{lang, q}, ...] sorted by q descending
  const entries = acceptLanguage
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(";");
      const lang = parts[0].trim().toLowerCase();
      const qParam = parts
        .slice(1)
        .map((part) => part.trim())
        .find((part) => part.toLowerCase().startsWith("q="));
      const q = qParam ? parseFloat(qParam.slice(2).trim()) : 1.0;
      return { lang, q: isNaN(q) ? 1.0 : q };
    })
    .sort((a, b) => b.q - a.q);

  // Return the first supported locale that matches (exact or language-prefix match)
  for (const { lang } of entries) {
    for (const supported of SUPPORTED_LOCALES) {
      if (lang === supported || lang.startsWith(`${supported}-`)) {
        return supported;
      }
    }
  }

  return "en";
}

export default getRequestConfig(async () => {
  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  const locale = detectLocale(acceptLanguage);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
