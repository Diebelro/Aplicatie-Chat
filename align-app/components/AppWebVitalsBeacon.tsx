"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Trimite o dată pe navigare (după câteva secunde) măsurători ușoare pentru panoul admin.
 * Fără date personale; anonim + rate limit.
 */
export function AppWebVitalsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = window.setTimeout(() => {
      try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const lcps = performance.getEntriesByType("largest-contentful-paint");
        const lastLcp = lcps.length > 0 ? (lcps[lcps.length - 1] as PerformanceEntry).startTime : undefined;
        const path = (pathname || window.location.pathname || "/").slice(0, 400);
        const payload = {
          path,
          lcp: lastLcp,
          ttfb: nav?.responseStart,
          domReady:
            nav && nav.domContentLoadedEventEnd > 0
              ? nav.domContentLoadedEventEnd - nav.startTime
              : undefined,
        };
        void fetch("/api/metrics/vitals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    }, 5500);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
