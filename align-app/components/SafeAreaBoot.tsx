"use client";

import { useEffect } from "react";

/** Măsoară env(safe-area-inset-top) — 0 pe multe WebView-uri Android. */
function measureEnvInset(prop: "top" | "bottom"): number {
  if (typeof document === "undefined") return 0;
  const el = document.createElement("div");
  const envProp = prop === "top" ? "safe-area-inset-top" : "safe-area-inset-bottom";
  el.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-${prop}:env(${envProp},0px);`;
  document.documentElement.appendChild(el);
  const style = getComputedStyle(el);
  const px = parseFloat(prop === "top" ? style.paddingTop : style.paddingBottom) || 0;
  el.remove();
  return px;
}

/**
 * Setează --safe-area-inset-* pentru CSS când env() lipsește (browser Android / unele WebView).
 * APK-ul Diebel injectează 0 + padding nativ pe WebView — nu dublăm.
 */
export function SafeAreaBoot() {
  useEffect(() => {
    const apply = () => {
      const root = document.documentElement;
      const ua = navigator.userAgent;
      const isDiebelApp = /DiebelAndroid/i.test(ua);

      if (isDiebelApp) return;

      const envTop = measureEnvInset("top");
      const envBottom = measureEnvInset("bottom");

      let top = envTop;
      let bottom = envBottom;

      if (top <= 0 && /Android/i.test(ua)) top = 28;
      if (bottom <= 0 && /Android/i.test(ua)) bottom = 20;

      root.style.setProperty("--safe-area-inset-top", `${top}px`);
      root.style.setProperty("--safe-area-inset-bottom", `${bottom}px`);

      if (!root.style.getPropertyValue("--safe-area-inset-left")) {
        root.style.setProperty("--safe-area-inset-left", "0px");
      }
      if (!root.style.getPropertyValue("--safe-area-inset-right")) {
        root.style.setProperty("--safe-area-inset-right", "0px");
      }
    };

    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.visualViewport?.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return null;
}
