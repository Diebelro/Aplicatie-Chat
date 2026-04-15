/* global self, clients */
/**
 * Align service worker — cache minim, Web Push pentru apel intrare, fără WebRTC.
 * Compatibil Chrome / Edge / Firefox (Push API + VAPID).
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Passthrough — cerut de unele audituri PWA; nu interceptăm rețeaua aici. */
self.addEventListener("fetch", () => {});

function parsePushPayload(event) {
  const fallback = {
    type: "unknown",
    title: "Align",
    body: "",
    openUrl: "/app",
  };
  if (!event.data) return fallback;
  try {
    const json = event.data.json();
    if (json && typeof json === "object") return { ...fallback, ...json };
  } catch {
    /* continuu cu text */
  }
  try {
    const text = event.data.text();
    const json = JSON.parse(text);
    if (json && typeof json === "object") return { ...fallback, ...json };
  } catch {
    /* ignore */
  }
  return { ...fallback, body: event.data.text() || "" };
}

self.addEventListener("push", (event) => {
  const data = parsePushPayload(event);
  const title = typeof data.title === "string" && data.title.length ? data.title : "Align";
  const body = typeof data.body === "string" ? data.body : "";
  let openUrl = typeof data.openUrl === "string" ? data.openUrl : "/app";
  if (!openUrl.startsWith("http")) {
    try {
      openUrl = new URL(openUrl, self.location.origin).href;
    } catch {
      openUrl = self.location.origin + "/app";
    }
  }
  const roomId = typeof data.roomId === "string" ? data.roomId : "";
  const options = {
    body,
    data: {
      openUrl,
      roomId,
      type: data.type || "unknown",
    },
    tag: roomId ? "align-incoming-call:" + roomId : "align-notification",
    renotify: true,
    /** false = notificarea se poate retrage singură din bară când deschizi app-ul (închidem și din client). */
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw =
    event.notification.data && typeof event.notification.data.openUrl === "string"
      ? event.notification.data.openUrl
      : "/app";
  let urlToOpen = raw;
  if (!urlToOpen.startsWith("http")) {
    try {
      urlToOpen = new URL(urlToOpen, self.location.origin).href;
    } catch {
      urlToOpen = self.location.origin + "/app";
    }
  }

  event.waitUntil(
    (async () => {
      if (self.clients.openWindow) {
        const opened = await self.clients.openWindow(urlToOpen);
        if (opened) return;
      }
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (client.url && client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
    })()
  );
});
