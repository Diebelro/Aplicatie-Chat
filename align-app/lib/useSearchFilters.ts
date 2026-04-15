"use client";

import { useState, useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n/types";
import { applyLocaleRegionToFilters } from "@/lib/localeSearchDefaults";
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

const defaultFilters: SearchFilters = {
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

function loadFilters(): SearchFilters {
  if (typeof window === "undefined") return defaultFilters;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFilters;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const minAgeRaw = parsed.minAge != null ? Number(parsed.minAge) : NaN;
    const maxAgeRaw = parsed.maxAge != null ? Number(parsed.maxAge) : NaN;
    const minAge = !Number.isNaN(minAgeRaw) ? String(clampAge(minAgeRaw)) : defaultFilters.minAge;
    const maxAge = !Number.isNaN(maxAgeRaw) ? String(clampAge(maxAgeRaw)) : defaultFilters.maxAge;
    return {
      ...defaultFilters,
      gender: typeof parsed.gender === "string" ? parsed.gender : defaultFilters.gender,
      minAge,
      maxAge,
      maxDistanceKm:
        parsed.maxDistanceKm != null && String(parsed.maxDistanceKm) !== ""
          ? String(parsed.maxDistanceKm)
          : defaultFilters.maxDistanceKm,
      country: typeof parsed.country === "string" ? parsed.country : defaultFilters.country,
      city: typeof parsed.city === "string" ? parsed.city : defaultFilters.city,
      onlineOnly: typeof parsed.onlineOnly === "boolean" ? parsed.onlineOnly : defaultFilters.onlineOnly,
      name: typeof parsed.name === "string" ? parsed.name : defaultFilters.name,
      sortBy:
        typeof parsed.sortBy === "string" ? normalizeProfileSortBy(parsed.sortBy) : defaultFilters.sortBy,
    };
  } catch {
    return defaultFilters;
  }
}

export function useSearchFilters(locale: Locale): [SearchFilters, React.Dispatch<React.SetStateAction<SearchFilters>>] {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const persistedLocaleRef = useRef<Locale | null>(null);

  // Prima dată: localStorage + regiune pentru `locale`; apoi: la schimbarea limbii, aliniază țara/orașul dacă erau goale sau preset pe limbă
  useEffect(() => {
    if (persistedLocaleRef.current === null) {
      const disk = loadFilters();
      setFilters(applyLocaleRegionToFilters(disk, locale));
      persistedLocaleRef.current = locale;
      return;
    }
    if (persistedLocaleRef.current === locale) {
      return;
    }
    persistedLocaleRef.current = locale;
    setFilters((prev) => applyLocaleRegionToFilters(prev, locale));
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
