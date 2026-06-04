/**
 * Închidere apel — întâi curăță pending pe server (REST), apoi semnalizarea WS.
 * Ordinea greșită (WS închis înainte de POST /end) făcea reapariția „te sună” după câteva secunde.
 */
import { fetchWithAuthRetry, getAuthHeaders } from "@/lib/authClient";
import { markCallEndPosted, shouldSkipDuplicateCallEnd } from "@/lib/callEndDedup";
import { markIncomingGrace, POST_HANGUP_INCOMING_GRACE_MS } from "@/lib/callIncomingGrace";

export type ClientHangupCallOptions = {
  roomId: string;
  pendingSince?: string;
  recordMissedForCallee?: boolean;
  /** false = forțează POST chiar dacă e marcat recent (ex. retry explicit). */
  respectDedup?: boolean;
};

/** Curăță DB + grace local; returnează dacă a trimis POST (nu era dedup). */
export async function clientHangupCall(opts: ClientHangupCallOptions): Promise<boolean> {
  const roomId = opts.roomId.trim();
  if (!roomId) return false;
  if (opts.respectDedup !== false && shouldSkipDuplicateCallEnd(roomId)) return false;

  markCallEndPosted(roomId);
  markIncomingGrace(roomId, opts.pendingSince, POST_HANGUP_INCOMING_GRACE_MS);

  const body = JSON.stringify({
    roomId,
    ...(opts.recordMissedForCallee ? { recordMissedForCallee: true } : {}),
  });

  try {
    await fetchWithAuthRetry("/api/call/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body,
    });
    return true;
  } catch {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/call/end", blob);
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}
