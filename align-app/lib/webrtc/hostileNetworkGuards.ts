import { buildRtcPeerConnectionConfig } from "@/lib/webrtc/rtcConfig";
import { fetchRtcIceServers } from "@/lib/webrtc/iceFetch";
import { applyCodecPreferencesIfSupported } from "@/lib/webrtc/connection";
import { extractIceLinkDiagFromStats, type IceTransportKind } from "@/lib/webrtc/iceTransportDiag";
import { logTurn443CorporateHintIfApplicable } from "@/lib/webrtc/turnCorporateHint";

export const HOSTILE_ICE_ERROR = {
  GATHERING_TIMEOUT_NO_RELAY: "TURN_REQUIRED: ICE_GATHERING_TIMEOUT_NO_RELAY",
  CONNECTION_TIMEOUT: "TURN_REQUIRED: ICE_CONNECTION_TIMEOUT",
  DTLS_OR_CONNECT_STUCK: "TURN_REQUIRED: DTLS_OR_CONNECTION_SETUP_TIMEOUT",
  ICE_FAILED_AFTER_AUTO_RECOVERY: "TURN_REQUIRED: ICE_FAILED_AFTER_AUTO_RECOVERY",
  ICE_RESTART_FAILED: "TURN_REQUIRED: ICE_RESTART_FAILED",
  SELECTED_PAIR_NOT_RELAY: "TURN_WARNING: SELECTED_PAIR_NOT_RELAY",
} as const;

export type HostileIceDiag = {
  label: string;
  iceGatheringState: RTCIceGatheringState | string;
  iceConnectionState: RTCIceConnectionState | string;
  connectionState: RTCPeerConnectionState | string;
  relayCandidateSeen: boolean;
  selectedLocalType: string | null;
  selectedRemoteType: string | null;
  lastIceRestartReason: string | null;
  /** Completed auto-recovery sequences (ICE re-fetch + restart offer published). */
  recoveryCount: number;
  transport: IceTransportKind | null;
  candidateType: string | null;
  effectiveType: string | null;
  finalFailureReason: string | null;
  qualityLevel: number | null;
  qualityReason: string | null;
  sampleSource: string | null;
  glareDetectedCount: number;
  rollbackAttemptedCount: number;
  rollbackFailedCount: number;
  lastQualityChangeAt: number | null;
};

/** Call-site overlay (quality / glare) merged into ICE diagnostics; cleared when leaving a call. */
let callQualityOverlay: Partial<HostileIceDiag> = {};
let lastMergedDiagFingerprint = "";
/** Last ICE-only snapshot from `publishDiag` (before overlay merge) so hooks can refresh quality fields. */
let lastIceDiagForOverlay: HostileIceDiag | null = null;

export function patchHostileIceCallQualityOverlay(patch: Partial<HostileIceDiag>): void {
  callQualityOverlay = { ...callQualityOverlay, ...patch };
  if (lastIceDiagForOverlay) publishDiag(lastIceDiagForOverlay);
}

export function clearHostileIceCallQualityOverlay(): void {
  callQualityOverlay = {};
  lastMergedDiagFingerprint = "";
  lastIceDiagForOverlay = null;
}

function publishDiag(diag: HostileIceDiag): void {
  lastIceDiagForOverlay = { ...diag };
  const next: HostileIceDiag = { ...diag, ...callQualityOverlay };
  try {
    (globalThis as unknown as { __ALIGN_HOSTILE_ICE_DIAG__?: HostileIceDiag }).__ALIGN_HOSTILE_ICE_DIAG__ = next;
  } catch {
    /* ignore */
  }
  const fp = JSON.stringify(next);
  if (fp === lastMergedDiagFingerprint) return;
  lastMergedDiagFingerprint = fp;
  console.info("[HOSTILE_ICE]", {
    event: "hostile_ice_diag",
    ...next,
  });
}

async function readSelectedPathFromStats(
  pc: RTCPeerConnection
): Promise<{
  local: string | null;
  remote: string | null;
  transport: HostileIceDiag["transport"];
  candidateType: string | null;
  effectiveType: string | null;
}> {
  let local: string | null = null;
  let remote: string | null = null;
  let transport: HostileIceDiag["transport"] = null;
  let candidateType: string | null = null;
  let effectiveType: string | null = null;
  try {
    const report = await pc.getStats();
    const link = extractIceLinkDiagFromStats(report);
    transport = link.transport;
    candidateType = link.candidateType;
    effectiveType = link.effectiveType;
    report.forEach((r) => {
      if (r.type !== "candidate-pair") return;
      const pair = r as RTCStatsReport & {
        state?: string;
        localCandidateId?: string;
        remoteCandidateId?: string;
      };
      if (pair.state !== "succeeded") return;
      const lid = pair.localCandidateId;
      const rid = pair.remoteCandidateId;
      if (lid) {
        const lc = report.get(lid) as { candidateType?: string } | undefined;
        if (lc?.candidateType) local = lc.candidateType;
      }
      if (rid) {
        const rc = report.get(rid) as { candidateType?: string } | undefined;
        if (rc?.candidateType) remote = rc.candidateType;
      }
    });
  } catch {
    /* ignore */
  }
  return { local, remote, transport, candidateType, effectiveType };
}

const GATHER_NO_RELAY_MS = 28_000;
const ICE_CONNECT_MS = 55_000;
const DTLS_STUCK_MS = 48_000;
const STATS_POLL_MS = 4_000;
const ICE_DISCONNECT_DEBOUNCE_MS = 3_200;

export type HostileGuardsInput = {
  label: string;
  pc: RTCPeerConnection;
  getAuthHeaders: () => HeadersInit;
  isCancelled: () => boolean;
  onHardFail: (message: string) => void;
  onBanner: (message: string | null) => void;
  publishIceRestartOffer: (sdp: string) => void;
  createIceRestartOffer: (pc: RTCPeerConnection) => Promise<string | null>;
  /** Invoked once when an ICE-restart offer is published after auto-recovery (quality freeze). */
  onRecoveryPublished?: () => void;
};

export function attachHostileNetworkGuards(input: HostileGuardsInput): () => void {
  const {
    pc,
    label,
    getAuthHeaders,
    isCancelled,
    onHardFail,
    onBanner,
    publishIceRestartOffer,
    createIceRestartOffer,
    onRecoveryPublished,
  } = input;
  let disposed = false;
  let recoverySlotConsumed = false;
  let recoveryCount = 0;
  let recoveryInFlight = false;
  let relayCandidateSeen = false;
  let lastRestartReason: string | null = null;
  let finalFailureReason: string | null = null;
  let gatherTimer: ReturnType<typeof setTimeout> | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let dtlsTimer: ReturnType<typeof setTimeout> | null = null;
  let iceDiscTimer: ReturnType<typeof setTimeout> | null = null;
  let statsTimer: ReturnType<typeof setInterval> | null = null;

  const hardFail = (message: string) => {
    if (disposed || isCancelled()) return;
    finalFailureReason = message;
    logTurn443CorporateHintIfApplicable("ice_hard_fail");
    publishDiag(diag());
    onHardFail(message);
  };

  const diag = (): HostileIceDiag => ({
    label,
    iceGatheringState: pc.iceGatheringState,
    iceConnectionState: pc.iceConnectionState,
    connectionState: pc.connectionState,
    relayCandidateSeen,
    selectedLocalType: null,
    selectedRemoteType: null,
    lastIceRestartReason: lastRestartReason,
    recoveryCount,
    transport: null,
    candidateType: null,
    effectiveType: null,
    finalFailureReason,
    qualityLevel: null,
    qualityReason: null,
    sampleSource: null,
    glareDetectedCount: 0,
    rollbackAttemptedCount: 0,
    rollbackFailedCount: 0,
    lastQualityChangeAt: null,
  });

  const clearGather = () => {
    if (gatherTimer != null) {
      clearTimeout(gatherTimer);
      gatherTimer = null;
    }
  };
  const clearConnect = () => {
    if (connectTimer != null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  };
  const clearDtls = () => {
    if (dtlsTimer != null) {
      clearTimeout(dtlsTimer);
      dtlsTimer = null;
    }
  };
  const clearIceDisc = () => {
    if (iceDiscTimer != null) {
      clearTimeout(iceDiscTimer);
      iceDiscTimer = null;
    }
  };

  const armGatherNoRelayWatch = () => {
    clearGather();
    gatherTimer = setTimeout(() => {
      gatherTimer = null;
      if (disposed || isCancelled()) return;
      if (relayCandidateSeen) return;
      logTurn443CorporateHintIfApplicable("gather_no_relay_timeout");
      void tryRecovery(HOSTILE_ICE_ERROR.GATHERING_TIMEOUT_NO_RELAY);
    }, GATHER_NO_RELAY_MS);
  };

  const armConnectWatch = () => {
    clearConnect();
    connectTimer = setTimeout(() => {
      connectTimer = null;
      if (disposed || isCancelled()) return;
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") return;
      logTurn443CorporateHintIfApplicable("ice_connect_timeout");
      void tryRecovery(HOSTILE_ICE_ERROR.CONNECTION_TIMEOUT);
    }, ICE_CONNECT_MS);
  };

  const armDtlsWatch = () => {
    clearDtls();
    dtlsTimer = setTimeout(() => {
      dtlsTimer = null;
      if (disposed || isCancelled()) return;
      if (pc.connectionState === "connected") return;
      logTurn443CorporateHintIfApplicable("dtls_stuck");
      void tryRecovery(HOSTILE_ICE_ERROR.DTLS_OR_CONNECT_STUCK);
    }, DTLS_STUCK_MS);
  };

  async function tryRecovery(reason: string): Promise<void> {
    if (disposed || isCancelled()) return;
    if (recoveryInFlight) return;
    if (recoverySlotConsumed) {
      hardFail(`${HOSTILE_ICE_ERROR.ICE_FAILED_AFTER_AUTO_RECOVERY} (${reason})`);
      return;
    }
    recoveryInFlight = true;
    recoverySlotConsumed = true;
    lastRestartReason = reason;
    onBanner(`TURN_REQUIRED: reîncerc ICE (${reason})…`);
    publishDiag({
      ...diag(),
      lastIceRestartReason: reason,
    });
    try {
      const servers = await fetchRtcIceServers(getAuthHeaders);
      pc.setConfiguration(buildRtcPeerConnectionConfig(servers));
      applyCodecPreferencesIfSupported(pc);
      const sdp = await createIceRestartOffer(pc);
      if (!sdp) {
        hardFail(`${HOSTILE_ICE_ERROR.ICE_RESTART_FAILED} (empty SDP)`);
        return;
      }
      publishIceRestartOffer(sdp);
      recoveryCount += 1;
      onRecoveryPublished?.();
      relayCandidateSeen = false;
      armGatherNoRelayWatch();
      armConnectWatch();
      armDtlsWatch();
      publishDiag(diag());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      hardFail(`${HOSTILE_ICE_ERROR.ICE_RESTART_FAILED}: ${msg}`);
    } finally {
      recoveryInFlight = false;
    }
  }

  const onIceCandidate = (ev: RTCPeerConnectionIceEvent) => {
    if (ev.candidate?.type === "relay") relayCandidateSeen = true;
    if (!ev.candidate && pc.iceGatheringState === "complete" && !relayCandidateSeen) {
      console.warn("[HOSTILE_ICE]", label, HOSTILE_ICE_ERROR.GATHERING_TIMEOUT_NO_RELAY, "(gather complete, no relay)");
    }
  };

  const onIceGatheringState = () => {
    if (disposed || isCancelled()) return;
    if (pc.iceGatheringState === "gathering") armGatherNoRelayWatch();
    if (pc.iceGatheringState === "complete") clearGather();
    publishDiag(diag());
  };

  const onIceConn = () => {
    if (disposed || isCancelled()) return;
    const ice = pc.iceConnectionState;
    publishDiag(diag());
    if (ice === "checking" || ice === "disconnected") {
      armConnectWatch();
    }
    if (ice === "connected" || ice === "completed") {
      clearConnect();
      clearGather();
      clearIceDisc();
      onBanner(null);
    }
    if (ice === "failed") {
      clearIceDisc();
      void tryRecovery(`ice_${ice}`);
    }
    if (ice === "disconnected") {
      clearIceDisc();
      iceDiscTimer = setTimeout(() => {
        iceDiscTimer = null;
        if (disposed || isCancelled()) return;
        if (pc.iceConnectionState !== "disconnected") return;
        void tryRecovery("ice_disconnected");
      }, ICE_DISCONNECT_DEBOUNCE_MS);
    }
  };

  const onConn = () => {
    if (disposed || isCancelled()) return;
    const st = pc.connectionState;
    publishDiag(diag());
    if (st === "connecting") armDtlsWatch();
    if (st === "connected") {
      clearDtls();
      clearConnect();
      clearGather();
    }
  };

  const onOnline = () => {
    if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
      void tryRecovery("navigator_online");
    }
  };

  const onConnChange = () => {
    if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
      void tryRecovery("network_interface_change");
    }
  };

  pc.addEventListener("icecandidate", onIceCandidate);
  pc.addEventListener("icegatheringstatechange", onIceGatheringState);
  pc.addEventListener("iceconnectionstatechange", onIceConn);
  pc.addEventListener("connectionstatechange", onConn);
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
  }
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { connection?: EventTarget }) : null;
  nav?.connection?.addEventListener?.("change", onConnChange);

  statsTimer = setInterval(() => {
    void (async () => {
      if (disposed || isCancelled()) return;
      if (pc.connectionState !== "connected") return;
      const path = await readSelectedPathFromStats(pc);
      const d = diag();
      d.selectedLocalType = path.local;
      d.selectedRemoteType = path.remote;
      d.transport = path.transport;
      d.candidateType = path.candidateType;
      d.effectiveType = path.effectiveType;
      publishDiag(d);
      if (path.local && path.local !== "relay") {
        console.warn("[HOSTILE_ICE]", label, HOSTILE_ICE_ERROR.SELECTED_PAIR_NOT_RELAY, "local=", path.local);
        onBanner(HOSTILE_ICE_ERROR.SELECTED_PAIR_NOT_RELAY);
      }
    })();
  }, STATS_POLL_MS);

  publishDiag(diag());

  return () => {
    disposed = true;
    clearGather();
    clearConnect();
    clearDtls();
    clearIceDisc();
    if (statsTimer != null) {
      clearInterval(statsTimer);
      statsTimer = null;
    }
    pc.removeEventListener("icecandidate", onIceCandidate);
    pc.removeEventListener("icegatheringstatechange", onIceGatheringState);
    pc.removeEventListener("iceconnectionstatechange", onIceConn);
    pc.removeEventListener("connectionstatechange", onConn);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", onOnline);
    }
    nav?.connection?.removeEventListener?.("change", onConnChange);
  };
}
