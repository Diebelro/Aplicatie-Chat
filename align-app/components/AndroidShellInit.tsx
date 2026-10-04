"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isDiebelAndroidShell, isDiebelNativeShell } from "@/lib/navigateApp";
import { UI_BUILD_VERSION } from "@/lib/uiBuildVersion";

const UI_BUILD_STORAGE_KEY = "diebel_ui_build";

type DiebelNativeBridge = { setCallChrome?: (isCall: boolean) => void };

/** La fiecare deschidere: forțează reload când UI s-a schimbat (+ chrome nativ Android). */
export function AndroidShellInit() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isDiebelAndroidShell()) return;
    const bridge = (window as unknown as { DiebelNative?: DiebelNativeBridge }).DiebelNative;
    if (!bridge?.setCallChrome) return;
    try {
      bridge.setCallChrome(/\/app\/call/i.test(pathname ?? ""));
    } catch {
      /* ignore */
    }
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDiebelAndroidShell()) {
      root.classList.add("diebel-native-insets", "diebel-force-app-height");
    } else if (isDiebelNativeShell()) {
      root.classList.add("diebel-native-insets");
    }

    try {
      const prev = localStorage.getItem(UI_BUILD_STORAGE_KEY);
      if (prev !== UI_BUILD_VERSION) {
        localStorage.setItem(UI_BUILD_STORAGE_KEY, UI_BUILD_VERSION);
        try {
          sessionStorage.removeItem("align_discover_resume");
          for (const k of Object.keys(sessionStorage)) {
            if (k.startsWith("align_list_scroll:")) sessionStorage.removeItem(k);
          }
        } catch {
          /* ignore */
        }
        // Hard navigation — reload() pe WebView poate păstra JS vechi din cache.
        const u = new URL(window.location.href);
        u.searchParams.set("ui", UI_BUILD_VERSION);
        u.searchParams.set("_", String(Date.now()));
        window.location.replace(u.toString());
        return;
      }
    } catch {
      /* ignore */
    }

    if (!isDiebelNativeShell()) return;
    try {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) r.unregister();
        });
      }
      if ("caches" in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
