"use client";

import { useEffect, useRef } from "react";

/**
 * Interval care rulează doar cât tab-ul / WebView-ul e vizibil.
 * La revenire (visibility, pageshow, focus) — tick imediat (important pe Android).
 */
export function useVisibleInterval(callback: () => void, ms: number, enabled = true): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || ms < 500) return;
    if (typeof document === "undefined") return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const clearPoll = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      cbRef.current();
    };

    const startPoll = () => {
      clearPoll();
      if (document.visibilityState !== "visible") return;
      tick();
      intervalId = setInterval(tick, ms);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") startPoll();
      else clearPoll();
    };

    const onResume = () => startPoll();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("focus", tick);

    if (document.visibilityState === "visible") startPoll();

    return () => {
      clearPoll();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("focus", tick);
    };
  }, [enabled, ms]);
}
