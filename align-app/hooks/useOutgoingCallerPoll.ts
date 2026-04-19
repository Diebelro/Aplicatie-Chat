"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { parseOutgoingPollStatus } from "@/lib/callOutgoingStatus";
import {
  CALL_POLL_429_BACKOFF_MS,
  OUTGOING_CALL_INITIAL_GRACE_MS,
  OUTGOING_CALL_POLL_MS,
  OUTGOING_CALL_RINGING_EXTEND_MS,
  OUTGOING_UNREACHABLE_CONSECUTIVE_POLLS,
} from "@/lib/callOutgoingConstants";

export type OutgoingCallerTerminal = null | "rejected" | "unreachable";

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
  /** După 429: `Date.now()` până la care nu mai facem fetch. */
  const rate429UntilRef = useRef(0);

  useEffect(() => {
    setOutgoingTerminal(null);
    unreachablePollStreakRef.current = 0;
    rate429UntilRef.current = 0;
    if (!isCaller) {
      unreachableGraceUntilRef.current = 0;
      return;
    }
    unreachableGraceUntilRef.current = Date.now() + OUTGOING_CALL_INITIAL_GRACE_MS;
  }, [isCaller, roomId]);

  useEffect(() => {
    if (!isCaller || callConnected) return;
    const ac = new AbortController();

    const run = () => {
      if (Date.now() < rate429UntilRef.current) return;
      const queriedRoom = roomIdLiveRef.current;
      fetchWithAuthRetry(
        `/api/call/outgoing-status?roomId=${encodeURIComponent(queriedRoom)}`,
        { signal: ac.signal }
      )
        .then(async (r) => {
          if (ac.signal.aborted || roomIdLiveRef.current !== queriedRoom) return;
          if (r.status === 429) {
            rate429UntilRef.current = Date.now() + CALL_POLL_429_BACKOFF_MS;
            return;
          }
          if (!r.ok) return;
          rate429UntilRef.current = 0;
          const raw = (await r.json().catch(() => ({}))) as { status?: unknown };
          if (ac.signal.aborted || roomIdLiveRef.current !== queriedRoom) return;
          const status = parseOutgoingPollStatus(raw.status);
          if (status == null) return;
          if (status === "ringing") {
            unreachablePollStreakRef.current = 0;
            unreachableGraceUntilRef.current = Date.now() + OUTGOING_CALL_RINGING_EXTEND_MS;
            setOutgoingTerminal(null);
            return;
          }
          if (status === "rejected") {
            unreachablePollStreakRef.current = 0;
            setOutgoingTerminal("rejected");
            return;
          }
          if (status === "unreachable") {
            if (Date.now() < unreachableGraceUntilRef.current) return;
            unreachablePollStreakRef.current += 1;
            if (unreachablePollStreakRef.current < OUTGOING_UNREACHABLE_CONSECUTIVE_POLLS) return;
            setOutgoingTerminal((prev) => (prev === "rejected" ? "rejected" : "unreachable"));
          }
        })
        .catch((e: unknown) => {
          const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
          if (name === "AbortError") return;
        });
    };

    run();
    const t = setInterval(run, OUTGOING_CALL_POLL_MS);
    return () => {
      clearInterval(t);
      ac.abort();
    };
  }, [isCaller, callConnected, roomId]);

  useEffect(() => {
    if (outgoingTerminal !== "unreachable") return;
    if (callConnected || remoteParticipantCount > 0) {
      setOutgoingTerminal(null);
    }
  }, [outgoingTerminal, callConnected, remoteParticipantCount]);

  return outgoingTerminal;
}
