/**
 * Închide notificările Web Push pentru același roomId (tag din `public/sw.js`).
 * Dacă userul deschide app-ul din icon, notificarea cu `requireInteraction` poate rămâne în fundal
 * până o închidem explicit aici.
 */
export function closeIncomingCallPushNotifications(roomId: string): void {
  if (typeof window === "undefined" || !roomId || !("serviceWorker" in navigator)) return;
  const tag = `align-incoming-call:${roomId}`;
  void navigator.serviceWorker.ready
    .then(async (reg) => {
      try {
        const list = await reg.getNotifications({ tag });
        list.forEach((n) => n.close());
        return;
      } catch {
        /* unele versiuni fără filtru tag */
      }
      try {
        const all = await reg.getNotifications();
        all.filter((n) => n.tag === tag).forEach((n) => n.close());
      } catch {
        /* ignore */
      }
    })
    .catch(() => {});
}
