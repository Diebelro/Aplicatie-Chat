import type { Locale } from "@/lib/i18n/types";
import { LOCALES } from "@/lib/i18n/types";

/** Țară implicită pe limbă; orașul rămâne gol = căutare în toată țara. */
export function getSearchLocationDefaults(locale: Locale): { country: string; city: string } {
  switch (locale) {
    case "de":
      return { country: "Deutschland", city: "" };
    case "en":
      // Ads / piață EN principală = SUA (nu UK — altfel americanii apar greșit ca UK).
      return { country: "United States", city: "" };
    case "fr":
      return { country: "France", city: "" };
    case "it":
      return { country: "Italia", city: "" };
    case "es":
      return { country: "España", city: "" };
    case "ro":
    default:
      return { country: "România", city: "" };
  }
}

/** Valori vechi de oraș presetat (înainte de „oraș opțional / tot județul”). */
const LEGACY_DEFAULT_CITY: Record<Locale, string> = {
  ro: "București",
  en: "New York",
  de: "Berlin",
  fr: "Paris",
  it: "Roma",
  es: "Madrid",
};

/** Orașe sugerate (datalist) pentru filtrul de oraș, aliniate cu regiunea implicită pe limbă. */
export const SEARCH_CITY_HINTS: Record<Locale, readonly string[]> = {
  ro: ["București", "Cluj-Napoca", "Timișoara", "Iași", "Brașov", "Constanța"],
  en: ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "Philadelphia"],
  de: ["Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart"],
  fr: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes"],
  it: ["Roma", "Milano", "Napoli", "Torino", "Bologna", "Firenze"],
  es: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Málaga"],
};

export function matchesAnyLocaleDefaultRegion(country: string, city: string): boolean {
  const c = country.trim();
  const ci = city.trim();
  if (!c || !ci) return false;
  // Doar combo-ul vechi țară + capitală forțată. Țara singură (ex. România / Deutschland)
  // e preferință lejeră de piață — o păstrăm.
  return LOCALES.some((l) => {
    const d = getSearchLocationDefaults(l);
    if (c !== d.country) return false;
    return ci === LEGACY_DEFAULT_CITY[l];
  });
}

/**
 * Nu mai forțăm țara/orașul după limbă. Majoritatea profilurilor nu au țară/oraș setate;
 * un preset „România” / „Deutschland” golea Descoperă sau făcea filtrul să pară stricat.
 * Utilizatorul completează țara/orașul doar când vrea să filtreze.
 */
export function applyLocaleRegionToFilters<T extends { country: string; city: string }>(
  prev: T,
  _locale: Locale
): T {
  return prev;
}
