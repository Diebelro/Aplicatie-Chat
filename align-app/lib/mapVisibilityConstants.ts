/** Durată minimă / maximă vizibilitate pe hartă (minute). */
export const MAP_VISIBILITY_MIN_MINUTES = 15;
export const MAP_VISIBILITY_MAX_MINUTES = 180;

/** Cât des se retrimite GPS-ul pe server cât timp ești vizibil pe hartă (baterie vs. acuratețe). */
export const MAP_LIVE_LOCATION_INTERVAL_MS = 60_000;

export function clampMapDurationMinutes(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < MAP_VISIBILITY_MIN_MINUTES || rounded > MAP_VISIBILITY_MAX_MINUTES) return null;
  return rounded;
}
