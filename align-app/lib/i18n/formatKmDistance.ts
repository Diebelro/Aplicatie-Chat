import type { Locale } from "./types";
import { formatTpl } from "./formatTpl";

function intlTagForLocale(locale: Locale): string {
  if (locale === "en") return "en-US";
  if (locale === "de") return "de-DE";
  return "ro-RO";
}

/** Distanță pentru carduri profil (km sau m). */
export function formatKmDistance(km: number, locale: Locale, tStr: (path: string) => string): string {
  const tag = intlTagForLocale(locale);
  if (km < 1) {
    return formatTpl(tStr("pages.chat.distanceM"), { n: Math.round(km * 1000) });
  }
  const rounded = Math.round(km * 10) / 10;
  const n = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rounded);
  return formatTpl(tStr("pages.chat.distanceKm"), { n });
}
