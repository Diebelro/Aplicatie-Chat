"use client";

import { useState, useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n/types";
import { applyLocaleRegionToFilters, matchesAnyLocaleDefaultRegion } from "@/lib/localeSearchDefaults";
import { normalizeProfileSortBy } from "@/lib/profileSort";
import { getStoredUserRaw } from "@/lib/store";

const STORAGE_KEY = "align_search_filters";

export type SearchFilters = {
  gender: string;
  /** true = userul a ales explicit (inclusiv „Toate”); nu mai forțăm genul opus. */
  genderLocked: boolean;
  minAge: string;
  maxAge: string;
  maxDistanceKm: string;
  country: string;
  city: string;
  onlineOnly: boolean;
  name: string;
  sortBy: string;
};

export const defaultSearchFilters: SearchFilters = {
  gender: "",
  genderLocked: false,
  minAge: "18",
  maxAge: "100",
  maxDistanceKm: "0",
  country: "",
  city: "",
  onlineOnly: false,
  name: "",
  sortBy: "recommended",
};

function clampAge(val: number): number {
  return Math.max(18, Math.min(100, val));
}

function readMyGender(): string {
  try {
    const raw = getStoredUserRaw();
    if (!raw) return "";
    const g = String((JSON.parse(raw) as { gender?: string }).gender ?? "").toLowerCase();
    return g === "male" || g === "female" || g === "other" ? g : "";
  } catch {
    return "";
  }
}

function withDefaultSeekingGender(f: SearchFilters): SearchFilters {
  if (f.genderLocked || f.gender) return f;
  const mine = readMyGender();
  const want = mine === "male" ? "female" : mine === "female" ? "male" : "";
  if (!want) return f;
  return { ...f, gender: want };
}

/** Curăță preseturi vechi de regiune (auto după limbă) care goleau Descoperă. */
function sanitizeLoadedFilters(f: SearchFilters): SearchFilters {
  let city = f.city;
  let country = f.country;
  if (matchesAnyLocaleDefaultRegion(country, city)) {
    // Preset vechi „România” / „Deutschland” + oraș gol sau capitală → scoatem.
    country = "";
    city = "";
  }
  return { ...f, city, country };
}

function loadFilters(): SearchFilters {
  if (typeof window === "undefined") return defaultSearchFilters;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return withDefaultSeekingGender(defaultSearchFilters);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const minAgeRaw = parsed.minAge != null ? Number(parsed.minAge) : NaN;
    const maxAgeRaw = parsed.maxAge != null ? Number(parsed.maxAge) : NaN;
    const minAge = !Number.isNaN(minAgeRaw) ? String(clampAge(minAgeRaw)) : defaultSearchFilters.minAge;
    const maxAge = !Number.isNaN(maxAgeRaw) ? String(clampAge(maxAgeRaw)) : defaultSearchFilters.maxAge;
    const loaded: SearchFilters = {
      ...defaultSearchFilters,
      gender: typeof parsed.gender === "string" ? parsed.gender : defaultSearchFilters.gender,
      genderLocked: parsed.genderLocked === true || (typeof parsed.gender === "string" && parsed.gender !== ""),
      minAge,
      maxAge,
      maxDistanceKm:
        parsed.maxDistanceKm != null && String(parsed.maxDistanceKm) !== ""
          ? String(parsed.maxDistanceKm)
          : defaultSearchFilters.maxDistanceKm,
      country: typeof parsed.country === "string" ? parsed.country : defaultSearchFilters.country,
      city: typeof parsed.city === "string" ? parsed.city : defaultSearchFilters.city,
      onlineOnly: typeof parsed.onlineOnly === "boolean" ? parsed.onlineOnly : defaultSearchFilters.onlineOnly,
      name: typeof parsed.name === "string" ? parsed.name : defaultSearchFilters.name,
      sortBy:
        typeof parsed.sortBy === "string" ? normalizeProfileSortBy(parsed.sortBy) : defaultSearchFilters.sortBy,
    };
    return withDefaultSeekingGender(sanitizeLoadedFilters(loaded));
  } catch {
    return withDefaultSeekingGender(defaultSearchFilters);
  }
}

/** Criterii care restrâng rezultatele. Genul e intenție (Femeie/Bărbat), nu se golește la „toți”. */
export function hasActiveSearchFilters(f: SearchFilters): boolean {
  return (
    f.minAge !== defaultSearchFilters.minAge ||
    f.maxAge !== defaultSearchFilters.maxAge ||
    (Number(f.maxDistanceKm) || 0) > 0 ||
    f.country.trim() !== "" ||
    f.city.trim() !== "" ||
    f.onlineOnly !== defaultSearchFilters.onlineOnly ||
    f.name.trim() !== ""
  );
}

/** Scoate țară/oraș/distanță/nume/online/vârstă. Păstrează genul selectat. */
export function broadenSearchFilters(current: SearchFilters): SearchFilters {
  return {
    ...defaultSearchFilters,
    gender: current.gender,
    genderLocked: current.genderLocked || current.gender !== "",
    sortBy: current.sortBy || defaultSearchFilters.sortBy,
  };
}

export function resetDiscoverFiltersStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useSearchFilters(
  locale: Locale
): [SearchFilters, React.Dispatch<React.SetStateAction<SearchFilters>>, boolean] {
  const [filters, setFilters] = useState<SearchFilters>(defaultSearchFilters);
  const [hydrated, setHydrated] = useState(false);
  const persistedLocaleRef = useRef<Locale | null>(null);

  useEffect(() => {
    if (persistedLocaleRef.current === null) {
      persistedLocaleRef.current = locale;
      setFilters(applyLocaleRegionToFilters(loadFilters(), locale));
      setHydrated(true);
      return;
    }
    if (persistedLocaleRef.current === locale) {
      return;
    }
    persistedLocaleRef.current = locale;
    setFilters((prev) => applyLocaleRegionToFilters(prev, locale));
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      window.dispatchEvent(new CustomEvent("align_search_filters_changed", { detail: filters }));
    } catch {
      // ignore
    }
  }, [filters, hydrated]);

  // Sincron între pagini / tab-uri: Descoperă ↔ Profile ↔ Match.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<SearchFilters>).detail;
      if (!detail || typeof detail !== "object") return;
      setFilters((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(detail)) return prev;
        return { ...defaultSearchFilters, ...detail };
      });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = sanitizeLoadedFilters({
          ...defaultSearchFilters,
          ...(JSON.parse(e.newValue) as SearchFilters),
        });
        setFilters((prev) =>
          JSON.stringify(prev) === JSON.stringify(next) ? prev : next
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("align_search_filters_changed", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("align_search_filters_changed", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [filters, setFilters, hydrated];
}
