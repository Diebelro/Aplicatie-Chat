"use client";

import { useState, useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n/types";
import { applyLocaleRegionToFilters } from "@/lib/localeSearchDefaults";
import { isDiebelAndroidShell } from "@/lib/navigateApp";
import { normalizeProfileSortBy } from "@/lib/profileSort";

const STORAGE_KEY = "align_search_filters";

export type SearchFilters = {
  gender: string;
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

/** Filtre salvate pe mobil (WebView) care ascund toți utilizatorii — reset ușor. */
function sanitizeLoadedFilters(f: SearchFilters): SearchFilters {
  const legacyCities = new Set(["bucurești", "bucuresti", "london", "berlin"]);
  const cityNorm = f.city.trim().toLowerCase();
  let city = f.city;
  if (cityNorm && legacyCities.has(cityNorm)) {
    city = "";
  }
  return { ...f, city };
}

function loadFilters(): SearchFilters {
  if (typeof window === "undefined") return defaultSearchFilters;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSearchFilters;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const minAgeRaw = parsed.minAge != null ? Number(parsed.minAge) : NaN;
    const maxAgeRaw = parsed.maxAge != null ? Number(parsed.maxAge) : NaN;
    const minAge = !Number.isNaN(minAgeRaw) ? String(clampAge(minAgeRaw)) : defaultSearchFilters.minAge;
    const maxAge = !Number.isNaN(maxAgeRaw) ? String(clampAge(maxAgeRaw)) : defaultSearchFilters.maxAge;
    const loaded: SearchFilters = {
      ...defaultSearchFilters,
      gender: typeof parsed.gender === "string" ? parsed.gender : defaultSearchFilters.gender,
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
    return sanitizeLoadedFilters(loaded);
  } catch {
    return defaultSearchFilters;
  }
}

/** Filtre deschise pe app Android — fără țară/oraș preset (altfel feed gol față de laptop). */
export function discoverFiltersForShell(base: SearchFilters): SearchFilters {
  if (!isDiebelAndroidShell()) return base;
  return sanitizeLoadedFilters({
    ...base,
    country: "",
    city: "",
    onlineOnly: false,
    maxDistanceKm: "0",
  });
}

export function resetDiscoverFiltersStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** @deprecated Folosește discoverFiltersForShell / resetDiscoverFiltersStorage */
export function clearRestrictiveMobileFilters(): boolean {
  if (!isDiebelAndroidShell()) return false;
  resetDiscoverFiltersStorage();
  return true;
}

export function useSearchFilters(locale: Locale): [SearchFilters, React.Dispatch<React.SetStateAction<SearchFilters>>] {
  const [filters, setFilters] = useState<SearchFilters>(defaultSearchFilters);
  const persistedLocaleRef = useRef<Locale | null>(null);

  // Prima dată: localStorage + regiune pentru `locale`; apoi: la schimbarea limbii, aliniază țara/orașul dacă erau goale sau preset pe limbă
  useEffect(() => {
    if (persistedLocaleRef.current === null) {
      if (isDiebelAndroidShell()) {
        setFilters(discoverFiltersForShell(defaultSearchFilters));
      } else {
        const disk = loadFilters();
        const withLocale = applyLocaleRegionToFilters(disk, locale);
        setFilters(discoverFiltersForShell(withLocale));
      }
      persistedLocaleRef.current = locale;
      return;
    }
    if (persistedLocaleRef.current === locale) {
      return;
    }
    persistedLocaleRef.current = locale;
    setFilters((prev) => discoverFiltersForShell(applyLocaleRegionToFilters(prev, locale)));
  }, [locale]);

  // Salvare la fiecare schimbare
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters]);

  return [filters, setFilters];
}
