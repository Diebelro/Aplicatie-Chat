/** Potrivire normalizată pentru filtre Descoperă (oraș, nume). */

export function normalizeStrict(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Oraș: egalitate normalizată sau conține (≥2 caractere în filtru) pentru variații „București“ / cartier. */
export function cityMatchesFilter(profileCity: string | null | undefined, filterCity: string): boolean {
  const want = normalizeStrict(filterCity);
  if (!want) return true;
  const hay = normalizeStrict(profileCity ?? "");
  if (want.length <= 1) return hay === want;
  return hay === want || hay.includes(want) || want.includes(hay);
}

/** Nume sau username: substring pe text normalizat (fără diacritice). */
export function nameMatchesFilter(
  displayName: string | null | undefined,
  username: string | null | undefined,
  query: string
): boolean {
  const n = normalizeStrict(query);
  if (!n) return true;
  const a = normalizeStrict(displayName ?? "");
  const b = normalizeStrict(username ?? "");
  return a.includes(n) || b.includes(n);
}
