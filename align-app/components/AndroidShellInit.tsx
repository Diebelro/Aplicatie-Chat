"use client";

import { useEffect } from "react";
import { isDiebelAndroidShell } from "@/lib/navigateApp";
import {
  defaultSearchFilters,
  discoverFiltersForShell,
  resetDiscoverFiltersStorage,
} from "@/lib/useSearchFilters";

const BOOT_KEY = "align_android_shell_ready_v23";

/** O dată la instalare: filtre Descoperă deschise (feed ca pe laptop). */
export function AndroidShellInit() {
  useEffect(() => {
    if (!isDiebelAndroidShell()) return;
    try {
      if (localStorage.getItem(BOOT_KEY) === "1") return;
      resetDiscoverFiltersStorage();
      localStorage.setItem(
        "align_search_filters",
        JSON.stringify(discoverFiltersForShell(defaultSearchFilters))
      );
      localStorage.setItem(BOOT_KEY, "1");
    } catch {
      // ignore
    }
  }, []);
  return null;
}
