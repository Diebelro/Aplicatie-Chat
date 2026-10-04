/**
 * Când deschizi un profil din Descoperă și te întorci, reiei de la același card
 * (nu de la începutul pachetului).
 */

const KEY = "align_discover_resume";
const MAX_AGE_MS = 45 * 60 * 1000;

export type DiscoverResumeSnapshot = {
  focusId: string;
  order: string[];
  filtersKey: string;
  at: number;
};

export function discoverFiltersKey(filters: {
  gender: string;
  minAge: string;
  maxAge: string;
  maxDistanceKm: string;
  country: string;
  city: string;
  onlineOnly: boolean;
  name: string;
  sortBy: string;
}): string {
  return [
    filters.gender,
    filters.minAge,
    filters.maxAge,
    filters.maxDistanceKm,
    filters.country.trim().toLowerCase(),
    filters.city.trim().toLowerCase(),
    filters.onlineOnly ? "1" : "0",
    filters.name.trim().toLowerCase(),
    filters.sortBy,
  ].join("|");
}

export function saveDiscoverResume(
  focusId: string,
  order: string[],
  filtersKey: string
): void {
  if (typeof window === "undefined" || !focusId) return;
  const snap: DiscoverResumeSnapshot = {
    focusId,
    order: order.filter(Boolean),
    filtersKey,
    at: Date.now(),
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    // ignore
  }
}

/** Citește snapshot-ul fără a-l șterge (utile la reload). */
export function peekDiscoverResume(filtersKey: string): DiscoverResumeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as DiscoverResumeSnapshot;
    if (!snap?.focusId || !Array.isArray(snap.order)) return null;
    if (Date.now() - (snap.at || 0) > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    // Dacă filtrele s-au schimbat puțin (debounce nume / auto-relax), tot reia
    // cardul vizitat — altfel utilizatorul crede că „nu ține minte”.
    if (snap.filtersKey !== filtersKey) {
      return { ...snap, filtersKey };
    }
    return snap;
  } catch {
    return null;
  }
}

export function clearDiscoverResume(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Reordonează profilurile: focus primul, apoi ordinea salvată, apoi restul. */
export function applyDiscoverResumeOrder<T extends { id: string }>(
  profiles: T[],
  resume: DiscoverResumeSnapshot
): T[] {
  if (!profiles.length) return profiles;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: T[] = [];

  const push = (id: string) => {
    if (seen.has(id)) return;
    const p = byId.get(id);
    if (!p) return;
    out.push(p);
    seen.add(id);
  };

  push(resume.focusId);
  for (const id of resume.order) push(id);
  for (const p of profiles) {
    if (!seen.has(p.id)) out.push(p);
  }
  return out;
}
