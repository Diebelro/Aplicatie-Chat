"use client";

import { useEffect } from "react";

/**
 * În producție: dezactivează React DevTools și hook-uri de debugging.
 * __NEXT_DATA__ nu este modificat — Next.js îl folosește pentru încărcarea chunk-urilor; ștergerea cauza TypeError în webpack.
 */
export function DisableDevTools() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const w = window as unknown as Record<string, unknown>;
    try {
      if (w.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined) {
        delete w.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      }
      Object.defineProperty(w, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
        get: () => undefined,
        configurable: true,
      });
    } catch {
      // ignore
    }
  }, []);
  return null;
}
