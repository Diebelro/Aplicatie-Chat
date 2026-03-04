"use client";

import { useState, useEffect } from "react";

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
  minAge: "",
  maxAge: "",
  maxDistanceKm: "",
  country: "",
  city: "",
  onlineOnly: false,
  name: "",
  sortBy: "",
};

function loadFilters(): SearchFilters {
  if (typeof window === "undefined") return defaultFilters;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFilters;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...defaultFilters,
      gender: typeof parsed.gender === "string" ? parsed.gender : defaultFilters.gender,
      minAge: parsed.minAge != null ? String(parsed.minAge) : defaultFilters.minAge,
      maxAge: parsed.maxAge != null ? String(parsed.maxAge) : defaultFilters.maxAge,
      maxDistanceKm: parsed.maxDistanceKm != null ? String(parsed.maxDistanceKm) : defaultFilters.maxDistanceKm,
      country: typeof parsed.country === "string" ? parsed.country : defaultFilters.country,
      city: typeof parsed.city === "string" ? parsed.city : defaultFilters.city,
      onlineOnly: typeof parsed.onlineOnly === "boolean" ? parsed.onlineOnly : defaultFilters.onlineOnly,
      name: typeof parsed.name === "string" ? parsed.name : defaultFilters.name,
      sortBy: typeof parsed.sortBy === "string" ? parsed.sortBy : defaultFilters.sortBy,
    };
  } catch {
    return defaultFilters;
  }
}

export function useSearchFilters(): [SearchFilters, React.Dispatch<React.SetStateAction<SearchFilters>>] {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);

  // Încarcă din localStorage la montare (doar pe client)
  useEffect(() => {
    setFilters(loadFilters());
  }, []);

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
