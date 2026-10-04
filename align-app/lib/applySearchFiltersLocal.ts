import {
  cityMatchesFilter,
  nameMatchesFilter,
  gendersMatch,
  isNameLookupQuery,
} from "@/lib/discoverMatchUtils";
import { canonicalCountryKey } from "@/lib/countrySoftRegion";
import type { SearchFilters } from "@/lib/useSearchFilters";

type FilterableUser = {
  gender?: string | null;
  age?: number | null;
  country?: string | null;
  city?: string | null;
  name?: string | null;
  username?: string | null;
  online?: boolean;
  distanceKm?: number | null;
};

/** Filtru local (ex. Match) — aceleași criterii ca Descoperă / Profile. */
export function passesSharedSearchFilters(u: FilterableUser, f: SearchFilters): boolean {
  const wantName = (f.name ?? "").trim();
  if (isNameLookupQuery(wantName)) {
    return nameMatchesFilter(u.name, u.username, wantName);
  }

  if (f.onlineOnly && !u.online) return false;
  if (f.gender && !gendersMatch(u.gender, f.gender)) return false;

  const minAge = Number(f.minAge);
  const maxAge = Number(f.maxAge);
  if (u.age != null && Number.isFinite(u.age)) {
    if (Number.isFinite(minAge) && minAge > 0 && u.age < minAge) return false;
    if (Number.isFinite(maxAge) && maxAge > 0 && u.age > maxAge) return false;
  }

  const wantCountry = (f.country ?? "").trim();
  if (wantCountry) {
    const raw = (u.country ?? "").trim();
    if (!raw) return false;
    const a = canonicalCountryKey(wantCountry);
    const b = canonicalCountryKey(raw);
    if ((a || "") !== (b || "")) return false;
  }

  const wantCity = (f.city ?? "").trim();
  if (wantCity) {
    const raw = (u.city ?? "").trim();
    if (!raw) return false;
    if (!cityMatchesFilter(raw, wantCity)) return false;
  }

  if (wantName && !nameMatchesFilter(u.name, u.username, wantName)) return false;

  const maxKm = Number(f.maxDistanceKm) || 0;
  if (maxKm > 0 && u.distanceKm != null && Number.isFinite(u.distanceKm) && u.distanceKm > maxKm) {
    return false;
  }

  return true;
}
