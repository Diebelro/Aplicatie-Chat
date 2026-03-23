/**
 * Evită reapariția overlay-ului „te sună” imediat după ce ai închis / respins apelul,
 * dacă poll-ul încă vede pending pe server o clipă.
 */
const ROOM_KEY = "align_dismiss_incoming_room";
const AT_KEY = "align_dismiss_incoming_at";
/** Suficient de lung ca să nu reapară „te sună” după ce ai închis cu back / ai ieșit din apel, până la următorul apel real. */
const WINDOW_MS = 30 * 60 * 1000;

export function markIncomingCallDismissed(roomId: string): void {
  if (typeof window === "undefined" || !roomId) return;
  try {
    sessionStorage.setItem(ROOM_KEY, roomId);
    sessionStorage.setItem(AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function shouldIgnorePolledIncoming(roomId: string): boolean {
  if (typeof window === "undefined" || !roomId) return false;
  try {
    const r = sessionStorage.getItem(ROOM_KEY);
    const t = Number(sessionStorage.getItem(AT_KEY) || 0);
    if (!r || r !== roomId) return false;
    return Date.now() - t < WINDOW_MS;
  } catch {
    return false;
  }
}
