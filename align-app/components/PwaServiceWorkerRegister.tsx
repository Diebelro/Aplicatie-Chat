"use client";

import { useEffect } from "react";
import { isDiebelAndroidShell } from "@/lib/navigateApp";

/** Înregistrare SW la nivel root (inclusiv în afara `/app`) — necesar pentru audit PWA / PWABuilder. */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (isDiebelAndroidShell()) return;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);
  return null;
}
