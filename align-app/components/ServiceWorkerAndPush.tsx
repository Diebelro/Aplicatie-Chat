"use client";

import { useEffect, useRef } from "react";
import { getAuthHeaders, fetchWithAuthRetry } from "@/lib/authClient";
import { setBrowserPushPrimaryPathReady } from "@/lib/browserPushConstants";
import { isDiebelAndroidShell } from "@/lib/navigateApp";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Înregistrare Service Worker + abonare Web Push (VAPID), salvare pe server.
 * Fără asta, în browser rămâne fallback-ul la poll ușor pe evenimente.
 */
export default function ServiceWorkerAndPush() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (isDiebelAndroidShell()) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;

        await fetchWithAuthRetry("/api/me/web-push/public-key", { cache: "no-store" })
          .then(async (r) => {
            if (!r.ok) return null;
            return r.json() as Promise<{ configured?: boolean; publicKey?: string | null }>;
          })
          .then(async (cfg) => {
            if (cancelled || !cfg?.configured || !cfg.publicKey?.trim()) return;
            if (!("PushManager" in window)) return;

            const permission = await Notification.requestPermission().catch(() => "denied");
            if (permission !== "granted" || cancelled) return;

            const key = urlBase64ToUint8Array(cfg.publicKey.trim());
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
            });

            const j = sub.toJSON();
            if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return;

            const save = await fetch("/api/me/web-push/subscribe", {
              method: "POST",
              headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify(j),
            });
            if (save.ok && !cancelled) {
              setBrowserPushPrimaryPathReady();
            }
          })
          .catch(() => {});
      } catch {
        /* SW sau rețea — rămâne fără push primar */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
