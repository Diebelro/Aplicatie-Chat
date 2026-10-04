import { normalizeStrict } from "@/lib/discoverMatchUtils";

/** ~140 km — destul de lejer pentru zone de graniță, fără a amesteca București cu Berlin. */
export const BORDER_SOFT_KM = 140;
/** Dacă după filtrul lejer rămân prea puțini, lărgim raza. */
export const BORDER_SOFT_WIDE_KM = 280;
const MIN_SOFT_KEEP = 6;

/** Aliasuri → cheie canonică (ro, de, …). Acoperă RO/DE/EN/FR/IT/ES uzuale. */
const COUNTRY_ALIASES: Record<string, string> = {
  ro: "ro",
  romania: "ro",
  rumanien: "ro",
  rumania: "ro",
  roumanie: "ro",
  // normalizeStrict scoate diacriticele → „românia” ajunge „romania”
  de: "de",
  deutschland: "de",
  germany: "de",
  germania: "de",
  allemagne: "de",
  alemania: "de",
  fr: "fr",
  france: "fr",
  frankreich: "fr",
  francia: "fr",
  franta: "fr",
  frankrijk: "fr",
  it: "it",
  italia: "it",
  italy: "it",
  italien: "it",
  italie: "it",
  es: "es",
  espana: "es",
  spain: "es",
  spanien: "es",
  spagna: "es",
  spanie: "es",
  espagne: "es",
  uk: "uk",
  "united kingdom": "uk",
  "great britain": "uk",
  britain: "uk",
  england: "uk",
  gb: "uk",
  "regatul unit": "uk",
  "vereinigtes konigreich": "uk",
  "royaume uni": "uk",
  "regno unito": "uk",
  "reino unido": "uk",
  us: "us",
  usa: "us",
  sua: "us",
  "united states": "us",
  "united states of america": "us",
  "statele unite": "us",
  "statele unite ale americii": "us",
  amerika: "us",
  america: "us",
  americii: "us",
  etatsunis: "us",
  "etats unis": "us",
  "vereinigte staaten": "us",
  "stati uniti": "us",
  "estados unidos": "us",
  at: "at",
  austria: "at",
  osterreich: "at",
  autriche: "at",
  hu: "hu",
  hungary: "hu",
  ungaria: "hu",
  ungarn: "hu",
  ungheria: "hu",
  hongrie: "hu",
  bg: "bg",
  bulgaria: "bg",
  bulgarien: "bg",
  bulgarie: "bg",
  md: "md",
  moldova: "md",
  "republica moldova": "md",
  moldavia: "md",
  pl: "pl",
  poland: "pl",
  polonia: "pl",
  polen: "pl",
  pologne: "pl",
};

export function canonicalCountryKey(raw: string | null | undefined): string | null {
  const n = normalizeStrict(raw ?? "");
  if (!n) return null;
  if (COUNTRY_ALIASES[n]) return COUNTRY_ALIASES[n];
  // „Romania” fără diacritice e deja în map; fallback: primul token scurt
  const compact = n.replace(/[^a-z]/g, "");
  if (COUNTRY_ALIASES[compact]) return COUNTRY_ALIASES[compact];
  return n.length >= 2 ? n : null;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type SoftCountryCandidate = {
  country: string | null | undefined;
  lat?: number | null;
  lng?: number | null;
};

/**
 * Filtru lejer pe țară (doar când utilizatorul NU a ales țară în filtre):
 * - aceeași țară → da
 * - fără țară pe profil → da (nu pedepsim date incomplete)
 * - altă țară + aproape (graniță) → da
 * - altă țară departe → nu
 */
export function softCountryAllows(
  candidate: SoftCountryCandidate,
  myCountryKey: string,
  myLat: number | null | undefined,
  myLng: number | null | undefined,
  borderKm: number
): boolean {
  const theirKey = canonicalCountryKey(candidate.country);
  if (!theirKey) return true;
  if (theirKey === myCountryKey) return true;

  const hasMy =
    myLat != null && myLng != null && Number.isFinite(myLat) && Number.isFinite(myLng);
  const hasTheir =
    candidate.lat != null &&
    candidate.lng != null &&
    Number.isFinite(candidate.lat) &&
    Number.isFinite(candidate.lng);
  if (hasMy && hasTheir) {
    return haversineKm(myLat!, myLng!, candidate.lat!, candidate.lng!) <= borderKm;
  }
  // Altă țară, fără GPS comun → nu amestecăm (ex. DE vs RO).
  return false;
}

export function softCountryAffinityScore(
  candidate: SoftCountryCandidate,
  myCountryKey: string | null,
  myLat: number | null | undefined,
  myLng: number | null | undefined
): number {
  if (!myCountryKey) return 0;
  const theirKey = canonicalCountryKey(candidate.country);
  if (theirKey === myCountryKey) return 3;
  if (!theirKey) return 1;
  const hasMy =
    myLat != null && myLng != null && Number.isFinite(myLat) && Number.isFinite(myLng);
  const hasTheir =
    candidate.lat != null &&
    candidate.lng != null &&
    Number.isFinite(candidate.lat) &&
    Number.isFinite(candidate.lng);
  if (hasMy && hasTheir) {
    const km = haversineKm(myLat!, myLng!, candidate.lat!, candidate.lng!);
    if (km <= BORDER_SOFT_KM) return 2;
    if (km <= BORDER_SOFT_WIDE_KM) return 1;
  }
  return 0;
}

/**
 * Preferință lejeră pe țară: DOAR sortare (aceeași țară / apropiere primele).
 * Nu mai tăiem DE/US/etc. din feed — altfel userii din alte piețe (ads) dispar
 * când ești logat din RO. Filtrul strict rămâne doar dacă alegi țară în căutare.
 */
export function applySoftCountryPreference<T extends SoftCountryCandidate>(
  list: T[],
  myCountryKey: string | null,
  myLat: number | null | undefined,
  myLng: number | null | undefined
): T[] {
  return sortByAffinity(list, myCountryKey, myLat, myLng);
}

function sortByAffinity<T extends SoftCountryCandidate>(
  list: T[],
  myCountryKey: string | null,
  myLat: number | null | undefined,
  myLng: number | null | undefined
): T[] {
  if (!myCountryKey) return list;
  return [...list].sort(
    (a, b) =>
      softCountryAffinityScore(b, myCountryKey, myLat, myLng) -
      softCountryAffinityScore(a, myCountryKey, myLat, myLng)
  );
}
