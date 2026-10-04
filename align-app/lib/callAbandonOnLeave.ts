/**
 * Curățare apel la navigare înapoi / alt tab în app fără butonul „Închide”.
 * Dacă utilizatorul a închis explicit sau apelul era deja conectat, nu retragem din nou.
 */
import { clientHangupCall } from "@/lib/callHangupClient";
import { markIncomingGrace, POST_HANGUP_INCOMING_GRACE_MS } from "@/lib/callIncomingGrace";
import { stopIncomingRingtone } from "@/lib/callRingtone";

const EXPLICIT_END_PREFIX = "align_call_user_ended:";

/** Marchează că utilizatorul a apăsat Încheie / Respinge — cleanup-ul paginii nu mai retrimite /end. */
export function markCallUserEnded(roomId: string): void {
  if (!roomId.trim()) return;
  try {
    sessionStorage.setItem(EXPLICIT_END_PREFIX + roomId.trim(), String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function wasCallUserEnded(roomId: string): boolean {
  if (!roomId.trim()) return false;
  try {
    const v = sessionStorage.getItem(EXPLICIT_END_PREFIX + roomId.trim());
    if (!v) return false;
    const ts = Number(v);
    if (!Number.isFinite(ts) || Date.now() - ts > 120_000) {
      sessionStorage.removeItem(EXPLICIT_END_PREFIX + roomId.trim());
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export type AbandonCallOnLeaveOpts = {
  roomId: string;
  /** true = apelant care sună; la abandon înainte de conectare, marchează pierdut la destinatar. */
  isCaller?: boolean;
  /** Apel WebRTC deja legat — nu trimitem /end la navigare (utilizatorul poate reveni în cameră). */
  wasConnected?: boolean;
};

/** Oprește soneria locală și, dacă e cazul, curăță pending pe server. */
export function abandonCallOnLeave(opts: AbandonCallOnLeaveOpts): void {
  const roomId = opts.roomId.trim();
  if (!roomId) return;

  stopIncomingRingtone();

  if (opts.wasConnected || wasCallUserEnded(roomId)) return;

  markIncomingGrace(roomId, undefined, POST_HANGUP_INCOMING_GRACE_MS);
  clearActiveConnectedCall(roomId);
  void clientHangupCall({
    roomId,
    recordMissedForCallee: opts.isCaller === true,
    respectDedup: false,
  });
}

const ACTIVE_CONNECTED_KEY = "diebel_active_connected_call";

export function markActiveConnectedCall(roomId: string): void {
  if (!roomId.trim()) return;
  try {
    sessionStorage.setItem(ACTIVE_CONNECTED_KEY, roomId.trim());
  } catch {
    /* ignore */
  }
}

export function clearActiveConnectedCall(roomId?: string): void {
  try {
    if (roomId) {
      const cur = sessionStorage.getItem(ACTIVE_CONNECTED_KEY);
      if (cur !== roomId.trim()) return;
    }
    sessionStorage.removeItem(ACTIVE_CONNECTED_KEY);
  } catch {
    /* ignore */
  }
}

export function readActiveConnectedCall(): string | null {
  try {
    const v = sessionStorage.getItem(ACTIVE_CONNECTED_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}
