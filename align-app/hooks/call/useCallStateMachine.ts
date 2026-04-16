"use client";

import { useCallback, useState } from "react";

/**
 * Mașină de stări apel (FSM) — shadow mode față de vechiul `status` din useWebRtcCall până la Checkpoint 4.
 * Doar acest modul mută `callState` (FSM); useWebRtcCall păstrează `CallRuntimeState` neschimbat pentru UI.
 */
export type CallState =
  | "idle"
  | "incoming"
  | "outgoing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "failed";

export type LegacyCallStatusSnapshot = {
  status: "idle" | "connecting" | "connected" | "left" | "error" | "permission_help";
};

export function deriveCallStateFromLegacy(
  s: LegacyCallStatusSnapshot,
  ctx: { isCaller: boolean; isConference: boolean }
): CallState {
  switch (s.status) {
    case "permission_help":
    case "error":
      return "failed";
    case "left":
      return "ended";
    case "connected":
      return "connected";
    case "idle":
      return "idle";
    case "connecting":
      if (ctx.isConference) return "connecting";
      if (ctx.isCaller) return "outgoing";
      return "incoming";
    default:
      return "idle";
  }
}

export function useCallStateMachine() {
  const [callState, setCallState] = useState<CallState>("idle");

  const syncFromLegacy = useCallback(
    (legacy: LegacyCallStatusSnapshot, ctx: { isCaller: boolean; isConference: boolean }) => {
      const next = deriveCallStateFromLegacy(legacy, ctx);
      setCallState((prev) => (prev === next ? prev : next));
    },
    []
  );

  return { callState, syncFromLegacy };
}
