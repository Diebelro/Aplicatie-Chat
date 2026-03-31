/** Distanță maximă (km) permisă în filtrul de profiluri; serverul refuză valori mai mari. */
export const MAX_PROFILE_SEARCH_RADIUS_KM = 1000;

/** Valoare numerică din query `maxDistanceKm` (inclusiv 0); `undefined` dacă lipsește sau e invalidă. */
export function parseMaxDistanceKmQuery(param: string | null): number | undefined {
  if (param == null || param === "") return undefined;
  const n = Number(param);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.min(MAX_PROFILE_SEARCH_RADIUS_KM, n);
}
