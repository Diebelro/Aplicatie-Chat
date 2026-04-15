import type { Locale } from "@/lib/i18n/types";
import { LOCALES } from "@/lib/i18n/types";

export function getSearchLocationDefaults(locale: Locale): { country: string; city: string } {
  switch (locale) {
    case "de":
      return { country: "Deutschland", city: "Berlin" };
    case "en":
      return { country: "United Kingdom", city: "London" };
    case "ro":
    default:
      return { country: "România", city: "București" };
  }
}

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
    return c === d.country && ci === d.city;
  });
}

export function applyLocaleRegionToFilters<T extends { country: string; city: string }>(
  prev: T,
  locale: Locale
): T {
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
