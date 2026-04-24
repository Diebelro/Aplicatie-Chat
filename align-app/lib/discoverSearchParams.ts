/**
 * Filtre Descoperă / listă profiluri: același contract URL între client și rutele /api/feed și /api/profiles.
 */

import type { SearchFilters } from "@/lib/useSearchFilters";
import type { FeedFilters } from "@/lib/repo-prisma"; // type-only: fără dependență circulară la runtime
import { MAX_PROFILE_SEARCH_RADIUS_KM, parseMaxDistanceKmQuery } from "@/lib/profileSearchConstants";

/** Construiește query pentru /api/feed și /api/profiles. */
export function buildDiscoverApiQuery(f: SearchFilters): string {
  const p = new URLSearchParams();
  if (f.gender) p.set("gender", f.gender);

  const minStr = String(f.minAge ?? "").trim();
  const maxStr = String(f.maxAge ?? "").trim();
  const minN = minStr === "" ? 18 : Number(minStr);
  const maxN = maxStr === "" ? 100 : Number(maxStr);
  const minOk = !Number.isNaN(minN) && minN >= 18 && minN <= 100;
  const maxOk = !Number.isNaN(maxN) && maxN >= 18 && maxN <= 100;
  const implicitFullRange = minOk && maxOk && minN <= 18 && maxN >= 100;
  if (!implicitFullRange) {
    if (minStr !== "") p.set("minAge", minStr);
    if (maxStr !== "") p.set("maxAge", maxStr);
  }

  const md = f.maxDistanceKm.trim();
  if (md !== "" && md !== "0") {
    const n = Number(md);
    if (!Number.isNaN(n) && n > 0) {
      p.set("maxDistanceKm", String(Math.min(MAX_PROFILE_SEARCH_RADIUS_KM, n)));
    }
  }
  if (f.country?.trim()) p.set("country", f.country.trim());
  if (f.city.trim()) p.set("city", f.city.trim());
  if (f.onlineOnly) p.set("onlineOnly", "true");
  if (f.name.trim()) p.set("name", f.name.trim());
  if (f.sortBy) p.set("sortBy", f.sortBy);
  const q = p.toString();
  return q ? `?${q}` : "";
}

/** Parsează aceiași parametri în ambele rute API (feed + profiles). */
export function parseDiscoverSearchFilters(searchParams: URLSearchParams): FeedFilters {
  const gender = searchParams.get("gender") ?? "";
  const minAge = searchParams.get("minAge");
  const maxAge = searchParams.get("maxAge");
  const maxDistanceKmParam = searchParams.get("maxDistanceKm");
  const country = searchParams.get("country") ?? "";
  const city = searchParams.get("city") ?? "";
  const onlineOnly = searchParams.get("onlineOnly") === "true" || searchParams.get("onlineOnly") === "1";
  const name = searchParams.get("name") ?? "";
  const minAgeNum = minAge != null && minAge !== "" ? Number(minAge) : NaN;
  const maxAgeNum = maxAge != null && maxAge !== "" ? Number(maxAge) : NaN;
  const minAgeOk = !Number.isNaN(minAgeNum) && minAgeNum >= 18 && minAgeNum <= 100;
  const maxAgeOk = !Number.isNaN(maxAgeNum) && maxAgeNum >= 18 && maxAgeNum <= 100;
  let finalMin = minAgeOk ? minAgeNum : undefined;
  let finalMax = maxAgeOk ? maxAgeNum : undefined;
  if (finalMin != null && finalMax != null && finalMin > finalMax) finalMax = finalMin;
  if (finalMin != null && finalMax != null && finalMin <= 18 && finalMax >= 100) {
    finalMin = undefined;
    finalMax = undefined;
  }

  const maxDist = parseMaxDistanceKmQuery(maxDistanceKmParam);
  const maxDistActive = maxDist !== undefined && maxDist > 0 ? maxDist : undefined;

  return {
    ...(gender && { gender }),
    ...(finalMin != null && { minAge: finalMin }),
    ...(finalMax != null && { maxAge: finalMax }),
    ...(maxDistActive != null && { maxDistanceKm: maxDistActive }),
    ...(country.trim() && { country: country.trim() }),
    ...(city.trim() && { city: city.trim() }),
    ...(onlineOnly && { onlineOnly: true }),
    ...(name.trim() && { name: name.trim() }),
  };
}
