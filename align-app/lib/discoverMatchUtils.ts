/** Potrivire normalizată pentru filtre Descoperă (oraș, nume). */

export function normalizeStrict(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const MALE_GENDER = new Set([
  "male",
  "m",
  "man",
  "men",
  "barbat",
  "masculin",
  "uomo",
  "homme",
  "hombre",
  "mann",
]);
const FEMALE_GENDER = new Set([
  "female",
  "f",
  "woman",
  "women",
  "femeie",
  "feminin",
  "donna",
  "femme",
  "mujer",
  "frau",
]);
const OTHER_GENDER = new Set(["other", "altul", "altro", "autre", "otro", "divers"]);

/** male | female | other | "" — ca filtrul „Femeie” să nu piardă profiluri scrise „feminin”. */
export function canonicalGender(raw: string | null | undefined): string {
  const n = normalizeStrict(raw ?? "");
  if (!n) return "";
  if (MALE_GENDER.has(n)) return "male";
  if (FEMALE_GENDER.has(n)) return "female";
  if (OTHER_GENDER.has(n)) return "other";
  return n;
}

export function gendersMatch(profileGender: string | null | undefined, filterGender: string | null | undefined): boolean {
  const want = canonicalGender(filterGender);
  if (!want) return true;
  return canonicalGender(profileGender) === want;
}

/** Aliasuri oraș (limbi diferite) → cheie comună. */
const CITY_ALIASES: Record<string, string> = {
  bucuresti: "bucuresti",
  bucharest: "bucuresti",
  bukarest: "bucuresti",
  munchen: "munchen",
  muenchen: "munchen",
  munich: "munchen",
  koln: "koln",
  koeln: "koln",
  cologne: "koln",
  wien: "wien",
  vienna: "wien",
  viena: "wien",
  berlin: "berlin",
  hamburg: "hamburg",
  frankfurt: "frankfurt",
  "frankfurt am main": "frankfurt",
  cluj: "cluj",
  "cluj napoca": "cluj",
  iasi: "iasi",
  timisoara: "timisoara",
  constanta: "constanta",
  brasov: "brasov",
};

function canonicalCityKey(raw: string): string {
  const n = normalizeStrict(raw);
  if (!n) return "";
  if (CITY_ALIASES[n]) return CITY_ALIASES[n];
  const compact = n.replace(/[^a-z]/g, "");
  return CITY_ALIASES[compact] || n;
}

/** Oraș: egalitate normalizată, aliasuri multilimbă, sau conține (≥2 caractere). */
export function cityMatchesFilter(profileCity: string | null | undefined, filterCity: string): boolean {
  const want = normalizeStrict(filterCity);
  if (!want) return true;
  const hay = normalizeStrict(profileCity ?? "");
  if (!hay) return false;
  if (want.length <= 1) return hay === want;
  const wantKey = canonicalCityKey(want);
  const hayKey = canonicalCityKey(hay);
  if (wantKey && hayKey && wantKey === hayKey) return true;
  return hay === want || hay.includes(want) || want.includes(hay);
}

/** Token de căutare: fără @, underscore, punct, spații — ca să meargă și `user_` / `@ionela`. */
export function foldNameSearchToken(s: string): string {
  return normalizeStrict(s)
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/gi, "");
}

/** Căutare după nume/username (2+ caractere) — ignorăm gen/țară/distanță. */
export function isNameLookupQuery(name: string | null | undefined): boolean {
  return foldNameSearchToken(name ?? "").length >= 2;
}

/** Nume sau username: substring pe text normalizat (fără diacritice, @, underscore). */
export function nameMatchesFilter(
  displayName: string | null | undefined,
  username: string | null | undefined,
  query: string
): boolean {
  const n = foldNameSearchToken(query);
  if (!n) return true;
  return (
    foldNameSearchToken(displayName ?? "").includes(n) ||
    foldNameSearchToken(username ?? "").includes(n)
  );
}
