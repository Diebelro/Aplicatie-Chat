import type { Locale } from "./types";
import { DEFAULT_LOCALE } from "./types";

/** Limba browserului → ro / en / de (primul tag suportat din `languages`). Altfel `DEFAULT_LOCALE`. */
export function detectBrowserLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const tags: string[] = [];
  try {
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
      tags.push(...navigator.languages);
    }
  } catch {
    /* ignore */
  }
  const primary = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage;
  if (primary) tags.push(primary);
  for (const raw of tags) {
    if (!raw || typeof raw !== "string") continue;
    const code = raw.trim().split(/[-_]/)[0]?.toLowerCase();
    if (code === "en" || code === "de" || code === "ro") return code as Locale;
  }
  return DEFAULT_LOCALE;
}

/** BCP 47 pentru `toLocaleDateString` / `toLocaleTimeString` aliniat cu limba UI. */
export function intlLocaleTag(locale: Locale): string {
  if (locale === "en") return "en-GB";
  if (locale === "de") return "de-DE";
  return "ro-RO";
}
