import { canonicalCountryKey } from "@/lib/countrySoftRegion";

/** Valori stocate în profil — aliniate cu aliasurile din `countrySoftRegion`. */
export const PROFILE_COUNTRY_OPTIONS = [
  { key: "ro", value: "România" },
  { key: "de", value: "Deutschland" },
  { key: "us", value: "United States" },
  { key: "uk", value: "United Kingdom" },
  { key: "at", value: "Austria" },
  { key: "fr", value: "France" },
  { key: "it", value: "Italia" },
  { key: "es", value: "España" },
  { key: "hu", value: "Ungaria" },
  { key: "bg", value: "Bulgaria" },
  { key: "md", value: "Moldova" },
  { key: "pl", value: "Polonia" },
] as const;

/** Oraș tipic US → dacă profilul e marcat greșit UK (locale en), corectăm la United States. */
const US_CITY_HINT =
  /\b(michigan|philadelphia|texas|florida|california|arizona|ohio|georgia|illinois|colorado|nevada|carolina|virginia|tennessee|missouri|indiana|wisconsin|minnesota|alabama|louisiana|oklahoma|kentucky|oregon|washington|massachusetts|connecticut|maryland|new york|new jersey|pennsylvania|chicago|houston|dallas|atlanta|miami|seattle|denver|phoenix|detroit|boston|vegas|brooklyn|manhattan|urbana|milford|southfield|copperas)\b/i;

export function maybeCorrectUkToUs(country: string | null | undefined, city: string | null | undefined): string | null {
  const c = (country ?? "").trim();
  const ci = (city ?? "").trim();
  if (!c || !ci) return c || null;
  if (canonicalCountryKey(c) !== "uk") return c;
  if (US_CITY_HINT.test(ci)) return "United States";
  return c;
}

export type ProfileCountryValue = (typeof PROFILE_COUNTRY_OPTIONS)[number]["value"];

/** Normalizează text liber / alias → valoarea din listă (sau null). */
export function normalizeCountryToOption(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const key = canonicalCountryKey(t);
  if (!key) return null;
  const hit = PROFILE_COUNTRY_OPTIONS.find((o) => o.key === key);
  return hit ? hit.value : null;
}

/** Pentru `<select>`: valoarea exactă din listă, sau "" dacă lipsește / necunoscută. */
export function countrySelectValue(raw: string | null | undefined): string {
  return normalizeCountryToOption(raw) ?? "";
}

export function hasRequiredCountry(raw: string | null | undefined): boolean {
  return !!(raw ?? "").trim();
}

/** Gate UI: lipsește țara (adminii trec). */
export function userMissingCountry(user: { country?: string | null; role?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "SUPERADMIN") return false;
  return !hasRequiredCountry(user.country);
}

/**
 * Rute unde fără țară redirecționăm la profil (nu blocăm chat / mesaje / setări).
 */
export function isCountryGatedAppPath(pathname: string | null | undefined): boolean {
  const p = pathname ?? "";
  if (p === "/app" || p === "/app/") return true;
  if (p.startsWith("/app/profiles")) return true;
  if (p.startsWith("/app/matches")) return true;
  if (p.startsWith("/app/map")) return true;
  if (p.startsWith("/app/review-swipes")) return true;
  return false;
}
