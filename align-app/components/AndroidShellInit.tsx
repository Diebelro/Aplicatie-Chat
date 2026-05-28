"use client";

import { useEffect } from "react";
import { isDiebelAndroidShell } from "@/lib/navigateApp";
import {
  defaultSearchFilters,
  discoverFiltersForShell,
  resetDiscoverFiltersStorage,
} from "@/lib/useSearchFilters";

/** La fiecare deschidere în app Android: filtre deschise (ca în browser). */
export function AndroidShellInit() {
  useEffect(() => {
    if (!isDiebelAndroidShell()) return;
    try {
      resetDiscoverFiltersStorage();
      localStorage.setItem(
        "align_search_filters",
        JSON.stringify(discoverFiltersForShell(defaultSearchFilters))
      );
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) r.unregister();
        });
      }
      if ("caches" in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
    } catch {
      // ignore
    }
  }, []);
  return null;
}
