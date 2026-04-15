/**
 * Evită dublarea POST /api/call/end când utilizatorul închide apelul explicit
 * (handleLeave trimite deja) iar cleanup-ul paginii sau pagehide mai trimit o dată.
 */

const PREFIX = "align_call_end_posted:";

function keyForRoom(roomId: string): string {
  return PREFIX + roomId;
}

/** Marchează că sesiunea a încheiat deja apelul pe client (înainte de navigare). */
export function markCallEndPosted(roomId: string): void {
  try {
    sessionStorage.setItem(keyForRoom(roomId), String(Date.now()));
  } catch {
    /* ignore */
  }
}

const TTL_MS = 12_000;

/** true dacă un end a fost marcat recent pentru această cameră — nu retrimite același lucru. */
export function shouldSkipDuplicateCallEnd(roomId: string): boolean {
  try {
    const v = sessionStorage.getItem(keyForRoom(roomId));
    if (!v) return false;
    const ts = Number(v);
    if (!Number.isFinite(ts) || Date.now() - ts > TTL_MS) {
      sessionStorage.removeItem(keyForRoom(roomId));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
