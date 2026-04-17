/**
 * După închiderea locală a apelului, poll-ul `/api/call/incoming` poate mai întoarce același
 * pending o scurtă perioadă (serverless / replici / cursă). Fără filtru, overlay-ul „te sună”
 * apare și dispare în buclă. Nu înlocuiește ștergerea pe server — doar UX stabil pe client.
 */
const STORAGE_PREFIX = "align_incoming_grace:";

/** Cât timp ignorăm incoming pentru același roomId după marcarea locală a închiderii. */
export const INCOMING_HANGUP_GRACE_MS = 14_000;

function key(roomId: string): string {
  return STORAGE_PREFIX + roomId;
}

export function markIncomingHangupGrace(roomId: string): void {
  if (typeof window === "undefined" || !roomId.trim()) return;
  try {
    sessionStorage.setItem(key(roomId), String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function isIncomingHangupGraced(roomId: string): boolean {
  if (typeof window === "undefined" || !roomId.trim()) return false;
  try {
    const raw = sessionStorage.getItem(key(roomId));
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) {
      sessionStorage.removeItem(key(roomId));
      return false;
    }
    if (Date.now() - ts > INCOMING_HANGUP_GRACE_MS) {
      sessionStorage.removeItem(key(roomId));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
