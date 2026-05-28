import type { Locale } from "@/lib/i18n/types";
import { LOCALES } from "@/lib/i18n/types";

/** Țară implicită pe limbă; orașul rămâne gol = căutare în toată țara. */
export function getSearchLocationDefaults(locale: Locale): { country: string; city: string } {
  switch (locale) {
    case "de":
      return { country: "Deutschland", city: "" };
    case "en":
      return { country: "United Kingdom", city: "" };
    case "ro":
    default:
      return { country: "România", city: "" };
  }
}

/** Valori vechi de oraș presetat (înainte de „oraș opțional / tot județul”). */
const LEGACY_DEFAULT_CITY: Record<Locale, string> = {
  ro: "București",
  en: "London",
  de: "Berlin",
};

/** Orașe sugerate (datalist) pentru filtrul de oraș, aliniate cu regiunea implicită pe limbă. */
export const SEARCH_CITY_HINTS: Record<Locale, readonly string[]> = {
  ro: ["București", "Cluj-Napoca", "Timișoara", "Iași", "Brașov", "Constanța"],
  en: ["London", "Manchester", "Birmingham", "Edinburgh", "Liverpool", "Bristol"],
  de: ["Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart"],
};

export function matchesAnyLocaleDefaultRegion(country: string, city: string): boolean {
  const c = country.trim();
  const ci = city.trim();
  return LOCALES.some((l) => {
    const d = getSearchLocationDefaults(l);
    if (c !== d.country) return false;
    if (ci === d.city) return true;
    return ci === LEGACY_DEFAULT_CITY[l];
  });
}

export function applyLocaleRegionToFilters<T extends { country: string; city: string }>(
  prev: T,
  locale: Locale
): T {
  if (typeof navigator !== "undefined" && /DiebelAndroid/i.test(navigator.userAgent)) {
    return prev;
  }
  const empty = !prev.country.trim() && !prev.city.trim();
  if (!empty && !matchesAnyLocaleDefaultRegion(prev.country, prev.city)) {
    return prev;
  }
  const d = getSearchLocationDefaults(locale);
  if (prev.country.trim() === d.country && prev.city.trim() === d.city) {
    return prev;
  }
  return { ...prev, country: d.country, city: d.city };
}
