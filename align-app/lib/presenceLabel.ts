/** „Activ recent” = văzut în ultimele 24h. Peste asta nu afișăm nimic (nici Offline, nici minute). */
export const RECENTLY_ACTIVE_MS = 24 * 60 * 60 * 1000;

export type PresenceKind = "online" | "recent" | null;

export function presenceKind(online?: boolean, lastActivityAt?: number | null): PresenceKind {
  if (online) return "online";
  if (lastActivityAt != null && Date.now() - lastActivityAt <= RECENTLY_ACTIVE_MS) return "recent";
  return null;
}
