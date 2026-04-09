/**
 * Evită o cursă scurtă: imediat după Respinge/Back, poll-ul poate încă vedea același pending pe server.
 * IMPORTANT: roomId e același pentru orice apel între aceiași doi useri — nu putem ignora „doar după roomId” minute întregi,
 * altfel următoarele apeluri nu mai apar (regres).
 */
const KEY = "align_dismiss_incoming_ring";

type Stash = { roomId: string; pendingSince: string };

/** Marchează că utilizatorul a respins explicit overlay-ul pentru acest ring (roomId + moment înregistrat pe server). */
export function markIncomingCallDismissed(roomId: string, pendingSince?: string): void {
  if (typeof window === "undefined" || !roomId) return;
  if (!pendingSince) {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ roomId, pendingSince } satisfies Stash));
  } catch {
    /* ignore */
  }
}

/** La închiderea apelului din CallUI / pagina de apel: nu păstra niciun filtru vechi. */
export function clearIncomingRingDismissFilter(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function shouldIgnorePolledIncoming(roomId: string, pendingSince?: string): boolean {
  if (typeof window === "undefined" || !roomId || !pendingSince) return false;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as Stash;
    return s.roomId === roomId && s.pendingSince === pendingSince;
  } catch {
    return false;
  }
}
