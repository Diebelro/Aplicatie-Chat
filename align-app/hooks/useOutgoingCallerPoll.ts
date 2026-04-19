"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "@/lib/authClient";
import {
  OUTGOING_CALL_INITIAL_GRACE_MS,
  OUTGOING_CALL_POLL_MS,
  OUTGOING_CALL_RINGING_EXTEND_MS,
  OUTGOING_UNREACHABLE_CONSECUTIVE_POLLS,
} from "@/lib/callOutgoingConstants";

export type OutgoingCallerTerminal = null | "rejected" | "unreachable";

type OutgoingStatusPayload = { status?: string };

/**
 * Poll stabil pentru apelant: `GET /api/call/outgoing-status`.
 *
 * Invariante (nu le împrăștia în CallUI):
 * - `roomId` poate schimba în timpul vieții componentei → ignoră răspunsuri vechi (stale fetch).
 * - `unreachable` apare adesea din cursă înainte ca `ring` să fie vizibil în DB → grace + streak.
 * - După `ringing`, nu anula grace (0) — altfel următorul `unreachable` fals închide al doilea apel.
 */
export function useOutgoingCallerPoll(opts: {
  roomId: string;
  isCaller: boolean;
  /** true când WebRTC e legat — oprim poll-ul. */
  callConnected: boolean;
  /** Pentru a anula „unreachable” dacă media s-a legat între timp. */
  remoteParticipantCount: number;
}): OutgoingCallerTerminal {
  const { roomId, isCaller, callConnected, remoteParticipantCount } = opts;
  const [outgoingTerminal, setOutgoingTerminal] = useState<OutgoingCallerTerminal>(null);

  const roomIdLiveRef = useRef(roomId);
  roomIdLiveRef.current = roomId;

  const unreachableGraceUntilRef = useRef(0);
  const unreachablePollStreakRef = useRef(0);

  useEffect(() => {
    setOutgoingTerminal(null);
    unreachablePollStreakRef.current = 0;
    if (!isCaller) {
      unreachableGraceUntilRef.current = 0;
      return;
    }
    unreachableGraceUntilRef.current = Date.now() + OUTGOING_CALL_INITIAL_GRACE_MS;
  }, [isCaller, roomId]);

  const fetchOutgoingStatus = useCallback(() => {
    const queriedRoom = roomIdLiveRef.current;
    fetch(`/api/call/outgoing-status?roomId=${encodeURIComponent(queriedRoom)}`, {
      headers: getAuthHeaders(),
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (roomIdLiveRef.current !== queriedRoom) return;
        const d = (await r.json().catch(() => ({}))) as OutgoingStatusPayload;
        if (!r.ok) return;
        if (d?.status === "ringing") {
          unreachablePollStreakRef.current = 0;
          unreachableGraceUntilRef.current = Date.now() + OUTGOING_CALL_RINGING_EXTEND_MS;
          setOutgoingTerminal(null);
          return;
        }
        if (d?.status === "rejected") {
          unreachablePollStreakRef.current = 0;
          setOutgoingTerminal("rejected");
          return;
        }
        if (d?.status === "unreachable") {
          if (Date.now() < unreachableGraceUntilRef.current) return;
          unreachablePollStreakRef.current += 1;
          if (unreachablePollStreakRef.current < OUTGOING_UNREACHABLE_CONSECUTIVE_POLLS) return;
          setOutgoingTerminal((prev) => (prev === "rejected" ? "rejected" : "unreachable"));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isCaller || callConnected) return;
    fetchOutgoingStatus();
    const t = setInterval(fetchOutgoingStatus, OUTGOING_CALL_POLL_MS);
    return () => clearInterval(t);
  }, [isCaller, callConnected, fetchOutgoingStatus]);

  useEffect(() => {
    if (outgoingTerminal !== "unreachable") return;
    if (callConnected || remoteParticipantCount > 0) {
      setOutgoingTerminal(null);
    }
  }, [outgoingTerminal, callConnected, remoteParticipantCount]);

  return outgoingTerminal;
}
