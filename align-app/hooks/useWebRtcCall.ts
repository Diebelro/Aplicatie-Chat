"use client";

/**
 * Adapter apel WebRTC: orchestrează `useCallStateMachine`, semnalizarea (`useCallSignaling`), peer helpers
 * (`useWebRtcPeer`), DataChannel cursor (`useCallDataChannels`). API-ul returnat rămâne compatibil cu
 * consumatorii existenți (`CallUI`, etc.).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  acquireCallMediaStream,
  formatMediaPermissionHelp,
  getVideoConstraints,
  isMobileDevice,
} from "@/lib/webrtc/mediaConstraints";
import {
  applyCodecPreferencesIfSupported,
  setMaxBitrate,
  applyVideoDegradationPreference,
} from "@/lib/webrtc/connection";
import {
  attachHostileNetworkGuards,
  patchHostileIceCallQualityOverlay,
  clearHostileIceCallQualityOverlay,
  isHostileIceBannerSuppressedFromUi,
} from "@/lib/webrtc/hostileNetworkGuards";
import {
  createNegotiationMutex,
  emptyGlareMetrics,
  resolveOfferGlare,
  type GlareMetrics,
} from "@/lib/webrtc/negotiationMutex";
import {
  decideQualityAdaptation,
  DEFAULT_QUALITY_OPTS,
  type QualityAdaptState,
} from "@/lib/webrtc/qualityAdaptation";
import {
  canApplyQualityStep,
  QUALITY_POST_ICE_RECOVERY_FREEZE_MS,
} from "@/lib/webrtc/qualityCooldown";
import { emptyQualityStatsCursor, sampleQualityFromPeerConnectionStats } from "@/lib/webrtc/sampleCallQuality";
import { applyLocalVideoSendDownscale } from "@/lib/webrtc/videoSendDownscale";
import {
  applyVideoSenderScaleAndBitrate,
  applyVideoDegradationPreferenceSafe,
} from "@/lib/webrtc/videoRtpSenderTune";
import { fetchRtcIceServers } from "@/lib/webrtc/iceFetch";
import {
  buildRtcPeerConnectionConfig,
  applyInboundAudioPlayoutHint,
  applyPlayoutHintsForAllReceivers,
} from "@/lib/webrtc/rtcConfig";
import { parseSignalingIncoming, coerceSignalingWsBaseForSecureContext } from "@/lib/webrtc/signaling";
import {
  getWebrtcPublicConfig,
  getPublicSignalingWsBaseUrl,
  isScreenshareFeatureEnabled,
} from "@/lib/env/webrtcConfig";
import { getAuthHeaders } from "@/lib/authClient";
import { useCallStateMachine } from "@/hooks/call/useCallStateMachine";
import {
  fetchCallSignalingToken,
  openSignalingWebSocketWithRetry,
} from "@/hooks/call/useCallSignaling";
import {
  CALL_SIGNALING_HEARTBEAT_MS,
  type PeerBundle,
  ensureRecvOnlyVideoIfNoLocalVideo,
  flushIceQueueOnPeer,
  flushPeerBundleIce,
  formatRtcNegotiationErrorSuffix,
  mergeRemoteTrackIntoMediaStream,
  rtcOfferOptionsWithRecvFallback,
} from "@/hooks/call/useWebRtcPeer";
import { bindP2pCursorDataChannel } from "@/hooks/call/useCallDataChannels";
import { pushCallDebug } from "@/hooks/call/callDebugLog";

export type RemoteParticipant = {
  id: string;
  displayName: string;
  stream: MediaStream | null;
};

/** Faze explicite pentru UI (semnalizare / pereche / WebRTC). */
export type CallConnectionPhase =
  | null
  | "signaling_connecting"
  | "signaling_connected"
  | "waiting_peer"
  | "peer_joined"
  | "negotiating";

type CallRuntimeState = {
  status: "idle" | "connecting" | "connected" | "left" | "error" | "permission_help";
  error: string | null;
  /** Ghid permisiuni microfon/cameră — UI prietenos, fără roșu */
  permissionHelp: { headline: string; lines: string[] } | null;
  remoteParticipants: RemoteParticipant[];
  muted: boolean;
  videoMuted: boolean;
  /** Microfon OK dar camera refuzată / indisponibilă — UI să nu zică „ai oprit tu camera”. */
  cameraSoftFailed: boolean;
  localStream: MediaStream | null;
  banner: string | null;
  canSwitchCamera: boolean;
  screenSharing: boolean;
  /** Semnalizare: ești singur în cameră P2P / fără peers mesh — UI arată „așteptăm celălalt”, nu „se conectează”. */
  waitingForPeerInRoom: boolean;
  connectionPhase: CallConnectionPhase;
};

export type UseWebRtcCallOptions = {
  roomId: string;
  userId: string;
  displayName: string;
  audioOnly: boolean;
  isCaller: boolean;
  isConference: boolean;
  /** Apel încheiat de celălalt sau limită timp — ex. redirecționare la mesaje. */
  onAutoEnded?: () => void;
};

export type { CallState } from "@/hooks/call/useCallStateMachine";
export { callDebugLog } from "@/hooks/call/callDebugLog";

/** Heartbeat client — alias la constanta partajată din `useWebRtcPeer`. */
const HEARTBEAT_MS = CALL_SIGNALING_HEARTBEAT_MS;

export function useWebRtcCall({
  roomId,
  userId,
  displayName: _localDisplayName,
  audioOnly,
  isCaller,
  isConference,
  onAutoEnded,
}: UseWebRtcCallOptions) {
  /** Reîncercare după refuz permisiuni — rerulează efectul (getUserMedia + semnalizare). */
  const [permissionRetryKey, setPermissionRetryKey] = useState(0);

  const [state, setState] = useState<CallRuntimeState>({
    status: "idle",
    error: null,
    permissionHelp: null,
    remoteParticipants: [],
    muted: false,
    videoMuted: audioOnly,
    cameraSoftFailed: false,
    localStream: null,
    banner: null,
    canSwitchCamera: false,
    screenSharing: false,
    waitingForPeerInRoom: false,
    connectionPhase: null,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  /** Conferință mesh: câte un RTCPeerConnection per participant distant. */
  const peerMapRef = useRef<Map<string, PeerBundle>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  /** După `call-end`, amânăm `cleanupMedia()` ca frame-ul să iasă înainte de `ws.close()` (altfel peer-ul nu primea mereu mesajul). */
  const leaveFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callStartRef = useRef<number>(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxMinutesRef = useRef(30);
  const p2pHostileDetachRef = useRef<(() => void) | null>(null);
  /** Cap bitrate video trimis: coboară la pierderi mari, urcă treptat când e stabil. */
  const adaptiveVideoBpsRef = useRef(2_500_000);
  const maxVideoBpsCapRef = useRef(2_500_000);
  const onAutoEndedRef = useRef(onAutoEnded);
  const negotiateRef = useRef<null | (() => Promise<void>)>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  /** Pe mobil: ultima față folosită pentru comutare user ↔ environment. */
  const facingModeRef = useRef<"user" | "environment">("user");
  /** Conferință: stream combinat per participant distant (mergeRemoteTrackIntoMediaStream). */
  const meshRemoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  /** 1-la-1: același stream stabil când audio și video nu vin în același eveniment ontrack. */
  const p2pRemoteStreamRef = useRef<MediaStream | null>(null);
  /** Un singur listener `ended` per track video local (mesh adaugă același track în mai multe PC-uri). */
  const localVideoEndedHandledRef = useRef<WeakSet<MediaStreamTrack>>(new WeakSet());
  /** Dacă nu vine `session` (P2P) / peers mesh, după timeout arătăm mesaj clar — evită „se conectează” ore întregi. */
  const connectWatchdogRef = useRef<number | null>(null);
  /** P2P: după ~20s în `iceConnectionState === checking` arătăm un banner (TURN / rețea). */
  const p2pIceStuckHintTimerRef = useRef<number | null>(null);
  const p2pCursorDcRef = useRef<RTCDataChannel | null>(null);
  const [cursorDataChannel, setCursorDataChannel] = useState<RTCDataChannel | null>(null);

  onAutoEndedRef.current = onAutoEnded;

  const { callState, syncFromLegacy } = useCallStateMachine();

  const clearConnectWatchdog = useCallback(() => {
    if (connectWatchdogRef.current != null) {
      clearTimeout(connectWatchdogRef.current);
      connectWatchdogRef.current = null;
    }
  }, []);

  const clearStatsMonitor = useCallback(() => {
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    if (p2pIceStuckHintTimerRef.current != null) {
      clearTimeout(p2pIceStuckHintTimerRef.current);
      p2pIceStuckHintTimerRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    clearStatsMonitor();
    clearConnectWatchdog();
    negotiateRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    screenStreamRef.current = null;

    for (const [, bundle] of peerMapRef.current) {
      try {
        bundle.deferredRemoteOfferSdp = null;
        bundle.detachHostileGuards?.();
        bundle.pc.getReceivers().forEach((r) => {
          try {
            r.track?.stop();
          } catch {}
        });
        bundle.pc.getSenders().forEach((x) => {
          try {
            x.track?.stop();
          } catch {}
        });
        bundle.pc.close();
      } catch {}
    }
    peerMapRef.current.clear();

    const pc = pcRef.current;
    if (pc) {
      try {
        p2pCursorDcRef.current?.close();
      } catch {}
      p2pCursorDcRef.current = null;
      setCursorDataChannel(null);
      p2pHostileDetachRef.current?.();
      p2pHostileDetachRef.current = null;
      pc.getReceivers().forEach((r) => {
        try {
          r.track?.stop();
        } catch {}
      });
      pc.getSenders().forEach((x) => {
        try {
          x.track?.stop();
        } catch {}
      });
      pc.close();
    }
    pcRef.current = null;
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
    iceQueueRef.current = [];
    remoteIdRef.current = null;
    meshRemoteStreamsRef.current.clear();
    p2pRemoteStreamRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    localStreamRef.current = null;
    callStartRef.current = 0;
    p2pHostileDetachRef.current?.();
    p2pHostileDetachRef.current = null;
    localVideoEndedHandledRef.current = new WeakSet();
    clearHostileIceCallQualityOverlay();
  }, [clearStatsMonitor, clearConnectWatchdog, setCursorDataChannel]);

  const attachLocalVideoEndedOnce = useCallback(
    (track: MediaStreamTrack) => {
      if (audioOnly || track.kind !== "video") return;
      const bag = localVideoEndedHandledRef.current;
      if (bag.has(track)) return;
      bag.add(track);
      track.addEventListener("ended", () => {
        if (audioOnly) return;
        console.warn("[WebRTC] local video track ended");
        setState((s) => ({
          ...s,
          videoMuted: true,
          banner:
            "Cameră întreruptă (sistem sau browser). Apasă „Pornește video” după ce ai recamera activă.",
        }));
        const clearEndedVideoSenders = (pc: RTCPeerConnection | null) => {
          if (!pc) return;
          for (const sender of pc.getSenders()) {
            if (sender.track?.kind === "video" && sender.track.readyState === "ended") {
              try {
                void sender.replaceTrack(null);
              } catch {
                /* ignore */
              }
            }
          }
        };
        clearEndedVideoSenders(pcRef.current);
        for (const [, b] of peerMapRef.current) clearEndedVideoSenders(b.pc);
      });
    },
    [audioOnly]
  );

  const leave = useCallback(() => {
    if (leaveFlushTimerRef.current != null) {
      clearTimeout(leaveFlushTimerRef.current);
      leaveFlushTimerRef.current = null;
    }
    const applyLeftState = () => {
      leaveFlushTimerRef.current = null;
      pushCallDebug({ kind: "call_end", detail: { reason: "user_leave" } });
      cleanupMedia();
      setState((s) => ({
        ...s,
        status: "left",
        localStream: null,
        remoteParticipants: [],
        screenSharing: false,
        canSwitchCamera: false,
        permissionHelp: null,
        cameraSoftFailed: false,
        waitingForPeerInRoom: false,
        connectionPhase: null,
      }));
    };
    try {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ t: "call-end" }));
        leaveFlushTimerRef.current = setTimeout(applyLeftState, 120);
        return;
      }
    } catch {
      /* ignore */
    }
    applyLeftState();
  }, [cleanupMedia]);

  const retryPermissions = useCallback(() => {
    cleanupMedia();
    setState((s) => ({
      ...s,
      status: "connecting",
      error: null,
      permissionHelp: null,
      localStream: null,
      remoteParticipants: [],
      banner: null,
      canSwitchCamera: false,
      screenSharing: false,
      cameraSoftFailed: false,
      waitingForPeerInRoom: false,
      connectionPhase: null,
    }));
    setPermissionRetryKey((k) => k + 1);
  }, [cleanupMedia]);

  const setMuted = useCallback((muted: boolean) => {
    setState((s) => {
      const ls = s.localStream;
      ls?.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
      return { ...s, muted };
    });
    const applyAudio = (pc: RTCPeerConnection) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === "audio") sender.track.enabled = !muted;
      });
    };
    pcRef.current && applyAudio(pcRef.current);
    for (const [, b] of peerMapRef.current) applyAudio(b.pc);
  }, []);

  const setVideoMuted = useCallback(
    (wantMuted: boolean) => {
      if (!wantMuted && !audioOnly) {
        const ls = localStreamRef.current;
        const vt = ls?.getVideoTracks()[0];
        if (vt?.readyState === "ended") {
          void (async () => {
            try {
              const prefer1080 =
                !isMobileDevice() && typeof window !== "undefined" && window.innerWidth >= 1200;
              let video: MediaTrackConstraints = getVideoConstraints(prefer1080);
              if (isMobileDevice()) {
                video = { ...video, facingMode: { ideal: facingModeRef.current } };
              }
              const cam = await navigator.mediaDevices.getUserMedia({ audio: false, video });
              const newVt = cam.getVideoTracks()[0];
              const stream = localStreamRef.current;
              if (!stream || wsRef.current?.readyState !== WebSocket.OPEN) {
                newVt.stop();
                return;
              }
              stream.getVideoTracks().forEach((t) => {
                try {
                  stream.removeTrack(t);
                  t.stop();
                } catch {
                  /* ignore */
                }
              });
              stream.addTrack(newVt);
              attachLocalVideoEndedOnce(newVt);
              const pcs = [
                ...(pcRef.current ? [pcRef.current] : []),
                ...[...peerMapRef.current.values()].map((b) => b.pc),
              ];
              const cfg = getWebrtcPublicConfig();
              const maxBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
              for (const pc of pcs) {
                const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                if (sender) {
                  try {
                    await sender.replaceTrack(newVt);
                  } catch {
                    /* ignore */
                  }
                }
              }
              setState((s) => ({
                ...s,
                videoMuted: false,
                localStream: stream,
                banner: null,
              }));
              await negotiateRef.current?.();
              maxVideoBpsCapRef.current = maxBps;
              adaptiveVideoBpsRef.current = Math.min(adaptiveVideoBpsRef.current, maxBps);
              for (const pc of pcs) {
                await setMaxBitrate(pc, adaptiveVideoBpsRef.current);
              }
            } catch {
              setState((s) => ({
                ...s,
                videoMuted: true,
                banner: "Nu am putut reporni camera. Verifică permisiunile browserului.",
              }));
            }
          })();
          return;
        }
      }

      setState((s) => {
        const ls = s.localStream;
        ls?.getVideoTracks().forEach((t) => {
          if (t.readyState === "live") t.enabled = !wantMuted;
        });
        return { ...s, videoMuted: wantMuted };
      });
      const applyVideo = (pc: RTCPeerConnection) => {
        pc.getSenders().forEach((sender) => {
          if (sender.track?.kind === "video" && sender.track.readyState === "live") {
            sender.track.enabled = !wantMuted;
          }
        });
      };
      pcRef.current && applyVideo(pcRef.current);
      for (const [, b] of peerMapRef.current) applyVideo(b.pc);
    },
    [audioOnly, attachLocalVideoEndedOnce]
  );

  const restoreCameraAfterScreen = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream || audioOnly) return;
    const pcs = [
      ...(pcRef.current ? [pcRef.current] : []),
      ...[...peerMapRef.current.values()].map((b) => b.pc),
    ];
    if (pcs.length === 0) return;
    const firstSender = pcs[0].getSenders().find((s) => s.track?.kind === "video");
    if (!firstSender) return;
    screenStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    screenStreamRef.current = null;
    try {
      const prefer1080 = !isMobileDevice() && typeof window !== "undefined" && window.innerWidth >= 1200;
      let video: MediaTrackConstraints = getVideoConstraints(prefer1080);
      if (isMobileDevice()) {
        video = { ...video, facingMode: { ideal: facingModeRef.current } };
      }
      const cam = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      const vt = cam.getVideoTracks()[0];
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(vt);
      attachLocalVideoEndedOnce(vt);
      for (const pc of pcs) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (!sender) continue;
        const old = sender.track;
        await sender.replaceTrack(vt);
        old?.stop();
      }
      setState((s) => ({ ...s, screenSharing: false, localStream: stream }));
      await negotiateRef.current?.();
      const cfg = getWebrtcPublicConfig();
      const maxBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      maxVideoBpsCapRef.current = maxBps;
      adaptiveVideoBpsRef.current = Math.min(adaptiveVideoBpsRef.current, maxBps);
      for (const pc of pcs) {
        await setMaxBitrate(pc, adaptiveVideoBpsRef.current);
      }
    } catch {
      /* ignore */
    }
  }, [audioOnly, attachLocalVideoEndedOnce]);

  const toggleScreenShare = useCallback(async () => {
    if (!isScreenshareFeatureEnabled() || audioOnly) return;
    const stream = localStreamRef.current;
    const pcs = [
      ...(pcRef.current ? [pcRef.current] : []),
      ...[...peerMapRef.current.values()].map((b) => b.pc),
    ];
    if (!stream || pcs.length === 0) return;
    const firstSender = pcs[0].getSenders().find((s) => s.track?.kind === "video");
    if (!firstSender) return;

    if (screenStreamRef.current) {
      await restoreCameraAfterScreen();
      return;
    }

    try {
      const dm = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 24, max: 30 } },
        audio: false,
      });
      const vt = dm.getVideoTracks()[0];
      vt.onended = () => {
        void restoreCameraAfterScreen();
      };
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(vt);
      for (const pc of pcs) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (!sender) continue;
        const old = sender.track;
        await sender.replaceTrack(vt);
        old?.stop();
      }
      screenStreamRef.current = dm;
      setState((s) => ({ ...s, screenSharing: true, localStream: stream }));
      await negotiateRef.current?.();
      const cfg = getWebrtcPublicConfig();
      const maxBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      maxVideoBpsCapRef.current = maxBps;
      adaptiveVideoBpsRef.current = Math.min(adaptiveVideoBpsRef.current, maxBps);
      for (const pc of pcs) {
        await setMaxBitrate(pc, adaptiveVideoBpsRef.current);
      }
    } catch {
      /* utilizator a anulat sau eroare */
    }
  }, [audioOnly, restoreCameraAfterScreen]);

  const switchCamera = useCallback(async () => {
    if (audioOnly || screenStreamRef.current) return;
    const stream = localStreamRef.current;
    const pcs = [
      ...(pcRef.current ? [pcRef.current] : []),
      ...[...peerMapRef.current.values()].map((b) => b.pc),
    ];
    if (!stream || pcs.length === 0) return;
    const firstSender = pcs[0].getSenders().find((s) => s.track?.kind === "video");
    if (!firstSender?.track) return;
    const prefer1080 = !isMobileDevice() && typeof window !== "undefined" && window.innerWidth >= 1200;
    const baseVc = getVideoConstraints(prefer1080);
    const vids = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");

    let videoConstraints: MediaTrackConstraints = baseVc;
    if (vids.length >= 2) {
      const currentId = firstSender.track.getSettings().deviceId;
      const idx = Math.max(0, vids.findIndex((d) => d.deviceId === currentId));
      const next = vids[(idx + 1) % vids.length];
      videoConstraints = { ...baseVc, deviceId: { exact: next.deviceId } };
    } else if (isMobileDevice()) {
      facingModeRef.current = facingModeRef.current === "user" ? "environment" : "user";
      videoConstraints = { ...baseVc, facingMode: { ideal: facingModeRef.current } };
    } else {
      return;
    }

    try {
      const ns = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });
      const vt = ns.getVideoTracks()[0];
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(vt);
      attachLocalVideoEndedOnce(vt);
      for (const pc of pcs) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (!sender?.track) continue;
        const old = sender.track;
        await sender.replaceTrack(vt);
        old.stop();
      }
      ns.getAudioTracks().forEach((t) => t.stop());
      setState((s) => ({ ...s, localStream: stream }));
      await negotiateRef.current?.();
      const cfg = getWebrtcPublicConfig();
      const maxBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      maxVideoBpsCapRef.current = maxBps;
      adaptiveVideoBpsRef.current = Math.min(adaptiveVideoBpsRef.current, maxBps);
      for (const pc of pcs) {
        await setMaxBitrate(pc, adaptiveVideoBpsRef.current);
      }
    } catch {
      /* ignore */
    }
  }, [audioOnly, attachLocalVideoEndedOnce]);

  const flushIceQueue = useCallback((pc: RTCPeerConnection) => {
    flushIceQueueOnPeer(pc, iceQueueRef);
  }, []);

  useEffect(() => {
    syncFromLegacy(
      { status: state.status },
      { isCaller, isConference }
    );
  }, [state.status, isCaller, isConference, syncFromLegacy]);

  useEffect(() => {
    if (!roomId || !userId || typeof window === "undefined") return;

    let cancelled = false;

    /** Conferință mesh (fără SFU): câte un RTCPeerConnection per participant. */
    const runConference = async (signalingBaseUrl: string) => {
      const cfg = getWebrtcPublicConfig();
      maxMinutesRef.current = cfg.CALL_MAX_MINUTES;
      const maxVideoBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      setState((s) => ({
        ...s,
        status: "connecting",
        error: null,
        permissionHelp: null,
        banner: null,
        canSwitchCamera: false,
        screenSharing: false,
        remoteParticipants: [],
        cameraSoftFailed: false,
        waitingForPeerInRoom: false,
        connectionPhase: null,
      }));

      for (const [, b] of peerMapRef.current) {
        try {
          b.pc.close();
        } catch {
          /* ignore */
        }
      }
      peerMapRef.current.clear();
      meshRemoteStreamsRef.current.clear();

      let localStream: MediaStream;
      let cameraUnavailable = false;
      try {
        const acquired = await acquireCallMediaStream(audioOnly);
        localStream = acquired.stream;
        cameraUnavailable = acquired.cameraUnavailable;
      } catch (e) {
        if (!cancelled) {
          const help = formatMediaPermissionHelp(e);
          setState((s) => ({
            ...s,
            status: "permission_help",
            error: null,
            permissionHelp: help,
            cameraSoftFailed: false,
          }));
        }
        return;
      }
      if (cancelled) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = localStream;
      const videoMutedNow = audioOnly || cameraUnavailable;
      const softFail = !audioOnly && cameraUnavailable;
      setState((s) => ({
        ...s,
        localStream,
        videoMuted: videoMutedNow,
        cameraSoftFailed: softFail,
        banner:
          cameraUnavailable && !audioOnly
            ? "Camera nu e activă — auzi și vorbești normal. Permite camera din setările browserului pentru acest site dacă vrei imagine."
            : s.banner,
      }));

      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const n = devs.filter((d) => d.kind === "videoinput").length;
        if (!cancelled) {
          const mobile = isMobileDevice();
          setState((s) => ({
            ...s,
            canSwitchCamera: !audioOnly && !cameraUnavailable && (n >= 2 || mobile),
          }));
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, canSwitchCamera: false }));
      }

      let iceServers: RTCIceServer[];
      try {
        iceServers = await fetchRtcIceServers(getAuthHeaders);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: msg.includes("TURN_REQUIRED") ? msg : `TURN_REQUIRED: ${msg}`,
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const rtcPcConfig = buildRtcPeerConnectionConfig(iceServers);

      const meshTok = await fetchCallSignalingToken(getAuthHeaders, false);
      if (!meshTok.ok) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: meshTok.message,
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const token = meshTok.token;

      const base = signalingBaseUrl.trim();
      if (!base) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: "NEXT_PUBLIC_SIGNALING_WS_URL lipsă.",
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (cancelled) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      const maxWsAttempts = process.env.NODE_ENV === "development" ? 8 : 2;
      const meshWsRes = await openSignalingWebSocketWithRetry({
        baseUrl: signalingBaseUrl,
        initialToken: token,
        getAuthHeaders,
        cancelled: () => cancelled,
        maxWsAttempts,
        logLabel: "mesh",
        finalConnectErrorMessage:
          "Nu mă pot conecta la serverul WebSocket de semnalizare. Verifică că rulează `npm run dev:lan`, firewall și NEXT_PUBLIC_SIGNALING_WS_URL (LAN).",
        onAbortLocalStream: () => localStream.getTracks().forEach((t) => t.stop()),
      });
      if (!meshWsRes.ok) {
        if (meshWsRes.reason === "ws_exhausted" && !cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error:
              "Nu mă pot conecta la serverul WebSocket de semnalizare. Verifică că rulează `npm run dev:lan`, firewall și NEXT_PUBLIC_SIGNALING_WS_URL (LAN).",
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ws = meshWsRes.ws;
      wsRef.current = ws;
      ws.addEventListener("close", (ev) => {
        console.info("[SIGNALING][mesh] WS closed", { code: ev.code, reason: ev.reason });
      });
      ws.addEventListener("error", () => {
        console.info("[SIGNALING][mesh] WS error");
      });

      negotiateRef.current = async () => {
        const w = wsRef.current;
        if (!w || w.readyState !== WebSocket.OPEN || cancelled) return;
        for (const [peerId, bundle] of peerMapRef.current) {
          if (userId >= peerId) continue;
          const { pc, withNegotiationLock } = bundle;
          await withNegotiationLock(async () => {
            try {
              if (pc.signalingState !== "stable") return;
              const skipRecv = ensureRecvOnlyVideoIfNoLocalVideo(pc, audioOnly, localStream);
              const offer = await pc.createOffer(
                rtcOfferOptionsWithRecvFallback(pc, audioOnly, skipRecv)
              );
              await pc.setLocalDescription(offer);
              w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to: peerId }));
            } catch {
              /* ignore */
            }
          });
        }
      };

      const ensurePeer = async (remoteUserId: string, shouldOffer: boolean) => {
        if (peerMapRef.current.has(remoteUserId)) return;
        const pc = new RTCPeerConnection(rtcPcConfig);
        localStream.getTracks().forEach((track) => {
          if (track.kind === "video") {
            try {
              track.contentHint = "motion";
            } catch {
              /* ignore */
            }
          }
          pc.addTrack(track, localStream);
          attachLocalVideoEndedOnce(track);
        });
        const withNegotiationLock = createNegotiationMutex();
        const glare = emptyGlareMetrics();
        peerMapRef.current.set(remoteUserId, {
          pc,
          iceQueue: [],
          withNegotiationLock,
          glare,
          deferredRemoteOfferSdp: null,
        });
        void (async () => {
          await setMaxBitrate(pc, maxVideoBps);
          await applyVideoDegradationPreference(pc, "maintain-framerate");
        })();

        pc.addEventListener("signalingstatechange", () => {
          if (pc.signalingState !== "stable") return;
          const b = peerMapRef.current.get(remoteUserId);
          const sdpDeferred = b?.deferredRemoteOfferSdp;
          if (!b || !sdpDeferred || cancelled) return;
          b.deferredRemoteOfferSdp = null;
          void b.withNegotiationLock(async () => {
            try {
              void ensureRecvOnlyVideoIfNoLocalVideo(b.pc, audioOnly, localStream);
              await b.pc.setRemoteDescription({ type: "offer", sdp: sdpDeferred });
              flushPeerBundleIce(b);
              const answer = await b.pc.createAnswer();
              await b.pc.setLocalDescription(answer);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "", to: remoteUserId }));
              }
              if (!cancelled) setState((s) => ({ ...s, status: "connected" }));
            } catch (e) {
              if (!cancelled) {
                const detail = formatRtcNegotiationErrorSuffix(e);
                setState((s) => ({ ...s, error: `Nu am putut negocia conexiunea (offer amânat).${detail}` }));
              }
            }
          });
        });

        pc.ontrack = (ev) => {
          if (cancelled) return;
          applyInboundAudioPlayoutHint(ev.receiver);
          const prev = meshRemoteStreamsRef.current.get(remoteUserId);
          const stream = mergeRemoteTrackIntoMediaStream(prev, ev);
          meshRemoteStreamsRef.current.set(remoteUserId, stream);
          if (prev === stream && prev != null) return;
          setState((s) => {
            const others = s.remoteParticipants.filter((p) => p.id !== remoteUserId);
            return {
              ...s,
              status: "connected",
              remoteParticipants: [
                ...others,
                {
                  id: remoteUserId,
                  displayName: `Participant ${remoteUserId.slice(0, 8)}`,
                  stream,
                },
              ],
            };
          });
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ t: "ice", candidate: ev.candidate.toJSON(), to: remoteUserId }));
          }
        };

        /** Perfect negotiation (minimal): renegociere doar în `stable`, serializată — evită offer-collision cu mutex + `resolveOfferGlare` pe inbound. */
        pc.onnegotiationneeded = () => {
          void withNegotiationLock(async () => {
            if (cancelled || ws.readyState !== WebSocket.OPEN) return;
            if (pc.signalingState !== "stable") return;
            try {
              applyCodecPreferencesIfSupported(pc);
              const skipRecv = ensureRecvOnlyVideoIfNoLocalVideo(pc, audioOnly, localStream);
              const offer = await pc.createOffer(
                rtcOfferOptionsWithRecvFallback(pc, audioOnly, skipRecv)
              );
              await pc.setLocalDescription(offer);
              ws.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to: remoteUserId }));
            } catch {
              /* ignore */
            }
          });
        };

        const detachMesh = attachHostileNetworkGuards({
          label: `mesh:${remoteUserId}`,
          pc,
          getAuthHeaders,
          isCancelled: () => cancelled,
          onHardFail: (msg) => {
            if (cancelled) return;
            console.error("[HOSTILE_ICE][mesh]", remoteUserId, msg);
            setState((s) => ({ ...s, error: msg, banner: msg }));
          },
          onBanner: (m) => {
            if (cancelled) return;
            if (m != null && isHostileIceBannerSuppressedFromUi(m)) {
              console.debug("[Align][callBanner suppressed]", m);
              return;
            }
            setState((s) => ({ ...s, banner: m }));
          },
          publishIceRestartOffer: (sdp) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ t: "offer", sdp, to: remoteUserId }));
            }
          },
          createIceRestartOffer: async (p) => {
            return withNegotiationLock(async () => {
              applyCodecPreferencesIfSupported(p);
              const skipRecv = ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
              const offer = await p.createOffer({
                ...rtcOfferOptionsWithRecvFallback(p, audioOnly, skipRecv),
                iceRestart: true,
              });
              await p.setLocalDescription(offer);
              return offer.sdp ?? null;
            });
          },
        });
        const meshBundle = peerMapRef.current.get(remoteUserId);
        if (meshBundle) meshBundle.detachHostileGuards = detachMesh;

        if (shouldOffer) {
          void withNegotiationLock(async () => {
            try {
              if (pc.signalingState !== "stable") return;
              applyCodecPreferencesIfSupported(pc);
              const skipRecv = ensureRecvOnlyVideoIfNoLocalVideo(pc, audioOnly, localStream);
              const offer = await pc.createOffer(
                rtcOfferOptionsWithRecvFallback(pc, audioOnly, skipRecv)
              );
              await pc.setLocalDescription(offer);
              ws.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to: remoteUserId }));
            } catch {
              if (!cancelled) setState((s) => ({ ...s, error: "Nu am putut porni oferta WebRTC." }));
            }
          });
        }
      };

      const applyMeshPeers = async (
        peers: Array<{ remoteUserId?: string; shouldOffer?: boolean }>
      ) => {
        const valid = peers.filter(
          (p): p is { remoteUserId: string; shouldOffer: boolean } =>
            typeof p.remoteUserId === "string" && typeof p.shouldOffer === "boolean"
        );
        if (valid.length > 4) {
          pushCallDebug({
            kind: "mesh_limit",
            detail: { reason: "MESH_LIMIT_EXCEEDED", count: valid.length },
          });
          if (!cancelled) {
            setState((s) => ({
              ...s,
              status: "error",
              error:
                "Conferința permite maximum 4 participanți (MESH_LIMIT_EXCEEDED). Lasă câțiva să iasă sau începe o cameră nouă.",
              connectionPhase: null,
              waitingForPeerInRoom: false,
            }));
          }
          return;
        }
        const targetIds = new Set(valid.map((p) => p.remoteUserId));
        for (const id of [...peerMapRef.current.keys()]) {
          if (!targetIds.has(id)) {
            const rm = peerMapRef.current.get(id);
            rm?.detachHostileGuards?.();
            rm?.pc.close();
            peerMapRef.current.delete(id);
            meshRemoteStreamsRef.current.delete(id);
            if (!cancelled) {
              setState((s) => ({
                ...s,
                remoteParticipants: s.remoteParticipants.filter((p) => p.id !== id),
              }));
            }
          }
        }
        for (const p of valid) {
          if (!peerMapRef.current.has(p.remoteUserId)) {
            await ensurePeer(p.remoteUserId, p.shouldOffer);
          }
        }
      };

      /** După `await` pe deschiderea WS, socketul e deja OPEN — `ws.onopen` nu s-ar mai apela. */
      const onConferenceWsReady = () => {
        clearConnectWatchdog();
        connectWatchdogRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (peerMapRef.current.size > 0) return;
          setState((s) => {
            if (s.status !== "connecting") return s;
            return {
              ...s,
              waitingForPeerInRoom: true,
              banner:
                "Nu s-a alăturat nimeni la conferință. Trimite linkul „Invită” sau asigură-te că ceilalți deschid aceeași cameră. Timer oprit automat ca să nu rămâi blocat.",
            };
          });
        }, 90_000);
        ws.send(JSON.stringify({ t: "join", roomId, userId, isCaller: false }));
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "heartbeat" }));
        }, HEARTBEAT_MS);
        callStartRef.current = Date.now();
      };

      ws.onmessage = async (ev) => {
        if (cancelled) return;
        const msg = parseSignalingIncoming(String(ev.data));
        if (!msg || typeof msg !== "object" || !("t" in msg)) return;
        const m = msg as {
          t: string;
          sdp?: string;
          candidate?: RTCIceCandidateInit;
          from?: string;
          peers?: Array<{ remoteUserId?: string; shouldOffer?: boolean }> | string[];
        };

        if (m.t === "joined" && Array.isArray(m.peers)) {
          const raw = m.peers;
          const idList = raw.length === 0 || typeof raw[0] === "string" ? (raw as string[]) : null;
          if (idList && !cancelled) {
            setState((s) => ({ ...s, waitingForPeerInRoom: idList.length < 2 }));
          }
          return;
        }

        if (m.t === "mesh-peers" && Array.isArray(m.peers)) {
          const meshList = m.peers as Array<{ remoteUserId?: string; shouldOffer?: boolean }>;
          if (meshList.length > 0) clearConnectWatchdog();
          if (!cancelled) {
            setState((s) => ({ ...s, waitingForPeerInRoom: meshList.length === 0 }));
          }
          await applyMeshPeers(meshList);
          return;
        }

        if (m.t === "offer" && typeof m.sdp === "string" && typeof m.from === "string") {
          const offerFrom = m.from;
          const offerSdp = m.sdp;
          let bundle = peerMapRef.current.get(offerFrom);
          if (!bundle) {
            await ensurePeer(offerFrom, false);
            bundle = peerMapRef.current.get(offerFrom);
          }
          if (!bundle || cancelled) return;
          const { pc, withNegotiationLock, glare } = bundle;
          await withNegotiationLock(async () => {
            try {
              const polite = userId < offerFrom;
              const glareRes = await resolveOfferGlare(pc, polite, glare);
              if (glareRes === "ignore_incoming") return;
              if (glareRes === "defer_incoming") {
                bundle.deferredRemoteOfferSdp = offerSdp;
                patchHostileIceCallQualityOverlay({
                  glareDetectedCount: glare.glareDetectedCount,
                  rollbackAttemptedCount: glare.rollbackAttemptedCount,
                  rollbackFailedCount: glare.rollbackFailedCount,
                });
                return;
              }
              void ensureRecvOnlyVideoIfNoLocalVideo(pc, audioOnly, localStream);
              await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
              flushPeerBundleIce(bundle);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "", to: offerFrom }));
              setState((s) => ({ ...s, status: "connected" }));
              patchHostileIceCallQualityOverlay({
                glareDetectedCount: bundle.glare.glareDetectedCount,
                rollbackAttemptedCount: bundle.glare.rollbackAttemptedCount,
                rollbackFailedCount: bundle.glare.rollbackFailedCount,
              });
            } catch (e) {
              if (!cancelled) {
                const detail = formatRtcNegotiationErrorSuffix(e);
                setState((s) => ({ ...s, error: `Nu am putut negocia conexiunea (offer).${detail}` }));
              }
            }
          });
          return;
        }

        if (m.t === "answer" && typeof m.sdp === "string" && typeof m.from === "string") {
          const bundle = peerMapRef.current.get(m.from);
          if (!bundle) return;
          const { pc, withNegotiationLock } = bundle;
          /** Al doilea `answer` (rețea / server) ajunge după ce PC e deja `stable` — îl ignorăm în loc să aruncăm eroare. */
          if (pc.signalingState === "stable") {
            console.info("[SIGNALING] mesh: duplicate answer ignored", { from: m.from });
            return;
          }
          await withNegotiationLock(async () => {
            try {
              await pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
              flushPeerBundleIce(bundle);
              setState((s) => ({ ...s, status: "connected" }));
            } catch (e) {
              if (!cancelled) {
                const detail = formatRtcNegotiationErrorSuffix(e);
                console.warn("[SIGNALING] mesh: setRemoteDescription(answer) failed", e);
                setState((s) => ({
                  ...s,
                  error: `Nu am putut negocia conexiunea (answer).${detail}`,
                }));
              }
            }
          });
          return;
        }

        if (m.t === "ice" && m.candidate && typeof m.from === "string") {
          const bundle = peerMapRef.current.get(m.from);
          if (!bundle) return;
          const { pc, iceQueue } = bundle;
          if (!pc.remoteDescription) {
            iceQueue.push(m.candidate);
            return;
          }
          try {
            await pc.addIceCandidate(m.candidate);
          } catch {
            /* ignore */
          }
          return;
        }

        if (m.t === "call-end" && typeof m.from === "string" && m.from !== userId) {
          const endBundle = peerMapRef.current.get(m.from);
          endBundle?.detachHostileGuards?.();
          endBundle?.pc.close();
          peerMapRef.current.delete(m.from);
          meshRemoteStreamsRef.current.delete(m.from);
          const noRemotesLeft = peerMapRef.current.size === 0;
          if (noRemotesLeft && !cancelled) {
            cleanupMedia();
            setState((s) => ({
              ...s,
              status: "left",
              localStream: null,
              remoteParticipants: [],
              screenSharing: false,
              canSwitchCamera: false,
              permissionHelp: null,
              cameraSoftFailed: false,
              waitingForPeerInRoom: false,
              connectionPhase: null,
            }));
            onAutoEndedRef.current?.();
          } else if (!cancelled) {
            setState((s) => ({
              ...s,
              remoteParticipants: s.remoteParticipants.filter((p) => p.id !== m.from),
            }));
          }
          return;
        }
      };

      ws.onerror = () => {
        console.info("[SIGNALING][mesh] WS error");
        clearConnectWatchdog();
        if (!cancelled) {
          setState((s) => ({
            ...s,
            error: "Eroare WebSocket semnalizare — verifică URL-ul WS și firewall.",
            connectionPhase: null,
          }));
        }
      };

      if (ws.readyState === WebSocket.OPEN) {
        onConferenceWsReady();
      } else {
        ws.addEventListener("open", () => onConferenceWsReady(), { once: true });
      }
    };

    const run = async (signalingBaseUrl: string) => {
      const cfg = getWebrtcPublicConfig();
      maxMinutesRef.current = cfg.CALL_MAX_MINUTES;
      const maxVideoBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      setState((s) => ({
        ...s,
        status: "connecting",
        error: null,
        permissionHelp: null,
        banner: null,
        canSwitchCamera: false,
        screenSharing: false,
        cameraSoftFailed: false,
        waitingForPeerInRoom: false,
        connectionPhase: null,
      }));

      let localStream: MediaStream;
      let cameraUnavailable = false;
      try {
        const acquired = await acquireCallMediaStream(audioOnly);
        localStream = acquired.stream;
        cameraUnavailable = acquired.cameraUnavailable;
      } catch (e) {
        if (!cancelled) {
          const help = formatMediaPermissionHelp(e);
          setState((s) => ({
            ...s,
            status: "permission_help",
            error: null,
            permissionHelp: help,
            cameraSoftFailed: false,
            connectionPhase: null,
          }));
        }
        return;
      }
      if (cancelled) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = localStream;
      const videoMutedNow = audioOnly || cameraUnavailable;
      const softFail = !audioOnly && cameraUnavailable;
      const cameraBanner =
        cameraUnavailable && !audioOnly
          ? "Camera nu e activă — auzi și vorbești normal. Permite camera din setările browserului pentru acest site dacă vrei imagine."
          : null;
      setState((s) => ({
        ...s,
        localStream,
        videoMuted: videoMutedNow,
        cameraSoftFailed: softFail,
        banner: cameraBanner ?? s.banner,
      }));

      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const n = devs.filter((d) => d.kind === "videoinput").length;
        if (!cancelled) {
          const mobile = isMobileDevice();
          setState((s) => ({
            ...s,
            canSwitchCamera: !audioOnly && !cameraUnavailable && (n >= 2 || mobile),
          }));
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, canSwitchCamera: false }));
      }

      let iceServers: RTCIceServer[];
      try {
        iceServers = await fetchRtcIceServers(getAuthHeaders);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: msg.includes("TURN_REQUIRED") ? msg : `TURN_REQUIRED: ${msg}`,
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const rtcPcConfig = buildRtcPeerConnectionConfig(iceServers);
      console.info("[ICE] ice-config OK", {
        iceServerEntries: iceServers.length,
        apiIceServerObjects: iceServers.length,
      });

      const p2pTok = await fetchCallSignalingToken(getAuthHeaders, true);
      if (!p2pTok.ok) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: p2pTok.message,
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const token = p2pTok.token;

      const base = signalingBaseUrl.trim();
      if (!base) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: "NEXT_PUBLIC_SIGNALING_WS_URL lipsă.",
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (cancelled) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!cancelled) {
        setState((s) => ({ ...s, connectionPhase: "signaling_connecting" }));
      }

      const maxWsAttempts = process.env.NODE_ENV === "development" ? 8 : 2;
      const p2pWsRes = await openSignalingWebSocketWithRetry({
        baseUrl: signalingBaseUrl,
        initialToken: token,
        getAuthHeaders,
        cancelled: () => cancelled,
        maxWsAttempts,
        logLabel: "p2p",
        finalConnectErrorMessage:
          "Nu mă pot conecta la serverul WebSocket de semnalizare. Verifică `npm run dev:lan`, firewall (3005/4001) și că ambele dispozitive folosesc același URL LAN.",
        onAbortLocalStream: () => localStream.getTracks().forEach((t) => t.stop()),
      });
      if (!p2pWsRes.ok) {
        if (p2pWsRes.reason === "ws_exhausted" && !cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error:
              "Nu mă pot conecta la serverul WebSocket de semnalizare. Verifică `npm run dev:lan`, firewall (3005/4001) și că ambele dispozitive folosesc același URL LAN.",
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ws = p2pWsRes.ws;
      wsRef.current = ws;
      ws.addEventListener("close", (ev) => {
        console.info("[SIGNALING] WS closed", { code: ev.code, reason: ev.reason });
      });

      p2pRemoteStreamRef.current = null;
      pcRef.current = null;
      negotiateRef.current = null;
      maxVideoBpsCapRef.current = maxVideoBps;
      adaptiveVideoBpsRef.current = maxVideoBps;

      const withP2pNegotiationLock = createNegotiationMutex();
      let p2pDeferredRemoteOfferSdp: string | null = null;
      const p2pGlareMetrics = emptyGlareMetrics();
      let p2pLastQualityChangeAtMs: number | null = null;
      let p2pQualityFrozenUntilMs = 0;
      let p2pQualityState: QualityAdaptState = {
        badStreak: 0,
        goodStreak: 0,
        degradedSteps: 0,
      };
      let qualityStatsCursor = emptyQualityStatsCursor();

      const startStatsMonitor = () => {
        clearStatsMonitor();
        qualityStatsCursor = emptyQualityStatsCursor();
        p2pQualityState = { badStreak: 0, goodStreak: 0, degradedSteps: 0 };
        p2pLastQualityChangeAtMs = null;
        p2pQualityFrozenUntilMs = 0;
        statsTimerRef.current = setInterval(() => {
          void (async () => {
            const p = pcRef.current;
            if (cancelled || !p || p.connectionState !== "connected") return;
            try {
              const report = await p.getStats();
              const { sample, next: nextCursor, uplinkBitrateRawBps } =
                sampleQualityFromPeerConnectionStats(report, qualityStatsCursor);
              qualityStatsCursor = nextCursor;
              const now = Date.now();
              if (now < p2pQualityFrozenUntilMs) {
                patchHostileIceCallQualityOverlay({
                  sampleSource: `${sample.sampleSourceUplink}/${sample.sampleSourceRtt}`,
                  qualityLevel: p2pQualityState.degradedSteps,
                  qualityReason: "ice_recovery_freeze",
                  glareDetectedCount: p2pGlareMetrics.glareDetectedCount,
                  rollbackAttemptedCount: p2pGlareMetrics.rollbackAttemptedCount,
                  rollbackFailedCount: p2pGlareMetrics.rollbackFailedCount,
                  lastQualityChangeAt: p2pLastQualityChangeAtMs,
                });
                return;
              }

              const qo = DEFAULT_QUALITY_OPTS;
              const minBps = isMobileDevice() ? qo.minBitrateBps : Math.max(qo.minBitrateBps, 180_000);
              const decision = decideQualityAdaptation(
                p2pQualityState,
                sample,
                adaptiveVideoBpsRef.current,
                { ...qo, minBitrateBps: minBps }
              );
              const cap = maxVideoBpsCapRef.current;
              const stepBlocked =
                (decision.action === "degrade" || decision.action === "improve") &&
                !canApplyQualityStep(now, p2pLastQualityChangeAtMs, p2pQualityFrozenUntilMs);

              if (stepBlocked) {
                patchHostileIceCallQualityOverlay({
                  sampleSource: `${sample.sampleSourceUplink}/${sample.sampleSourceRtt}`,
                  qualityLevel: p2pQualityState.degradedSteps,
                  qualityReason: "cooldown",
                  glareDetectedCount: p2pGlareMetrics.glareDetectedCount,
                  rollbackAttemptedCount: p2pGlareMetrics.rollbackAttemptedCount,
                  rollbackFailedCount: p2pGlareMetrics.rollbackFailedCount,
                  lastQualityChangeAt: p2pLastQualityChangeAtMs,
                });
                return;
              }

              p2pQualityState = decision.next;
              if (decision.action === "degrade" || decision.action === "improve") {
                p2pLastQualityChangeAtMs = now;
              }

              if (decision.action === "degrade") {
                adaptiveVideoBpsRef.current = Math.max(
                  minBps,
                  Math.floor(adaptiveVideoBpsRef.current * decision.bitrateMultiplier)
                );
                await setMaxBitrate(p, adaptiveVideoBpsRef.current);
                if (!audioOnly) {
                  const ok = await applyVideoSenderScaleAndBitrate(
                    p,
                    p2pQualityState.degradedSteps,
                    adaptiveVideoBpsRef.current
                  );
                  if (!ok) {
                    const vt = localStream.getVideoTracks()[0];
                    if (vt) await applyLocalVideoSendDownscale(vt, p2pQualityState.degradedSteps);
                  }
                  await applyVideoDegradationPreferenceSafe(
                    p,
                    p2pQualityState.degradedSteps >= 1 ? "maintain-framerate" : "balanced"
                  );
                }
                setState((s) => ({
                  ...s,
                  banner: "Rețea slabă — reduc rezoluția și debitul video pentru continuitate.",
                }));
              } else if (decision.action === "improve") {
                adaptiveVideoBpsRef.current = Math.min(
                  cap,
                  Math.floor(adaptiveVideoBpsRef.current * decision.bitrateMultiplier)
                );
                await setMaxBitrate(p, adaptiveVideoBpsRef.current);
                if (!audioOnly) {
                  const ok = await applyVideoSenderScaleAndBitrate(
                    p,
                    p2pQualityState.degradedSteps,
                    adaptiveVideoBpsRef.current
                  );
                  if (!ok) {
                    const vt = localStream.getVideoTracks()[0];
                    if (vt) await applyLocalVideoSendDownscale(vt, p2pQualityState.degradedSteps);
                  }
                  await applyVideoDegradationPreferenceSafe(
                    p,
                    p2pQualityState.degradedSteps >= 1 ? "maintain-framerate" : "balanced"
                  );
                }
                if (adaptiveVideoBpsRef.current >= cap * 0.97 && p2pQualityState.degradedSteps === 0) {
                  setState((s) => ({ ...s, banner: null }));
                }
              } else if (sample.uplinkLostDelta > 12 && sample.uplinkLostDelta <= 28) {
                setState((s) => ({ ...s, banner: "Rețea variabilă — optimizare conexiune." }));
              } else if (!isMobileDevice() && uplinkBitrateRawBps > 0 && uplinkBitrateRawBps < 70_000) {
                setState((s) => ({ ...s, banner: "Debit video scăzut — verifică rețeaua." }));
              }

              patchHostileIceCallQualityOverlay({
                sampleSource: `${sample.sampleSourceUplink}/${sample.sampleSourceRtt}`,
                qualityLevel: p2pQualityState.degradedSteps,
                qualityReason: decision.reason,
                glareDetectedCount: p2pGlareMetrics.glareDetectedCount,
                rollbackAttemptedCount: p2pGlareMetrics.rollbackAttemptedCount,
                rollbackFailedCount: p2pGlareMetrics.rollbackFailedCount,
                lastQualityChangeAt: p2pLastQualityChangeAtMs,
              });
            } catch {
              /* ignore */
            }
          })();
        }, 6_000);
      };

      /** P2P: după `ensureRecvOnlyVideoIfNoLocalVideo` — nu dublăm `offerToReceiveVideo` la createOffer. */
      let p2pSkipOfferRecvVideo = false;

      const setupP2pAfterSession = (cursorChannelOfferer: boolean) => {
        if (pcRef.current) return;
        const pc = new RTCPeerConnection(rtcPcConfig);
        pcRef.current = pc;
        console.info("[RTC] RTCPeerConnection created (după ce amândoi sunteți în cameră)");

        bindP2pCursorDataChannel({
          pc,
          cursorChannelOfferer,
          refs: { p2pCursorDcRef },
          setCursorDataChannel,
        });

        localStream.getTracks().forEach((track) => {
          if (track.kind === "video") {
            try {
              track.contentHint = "motion";
            } catch {
              /* ignore */
            }
          }
          pc.addTrack(track, localStream);
          attachLocalVideoEndedOnce(track);
        });
        /** `ensureRecvOnlyVideoIfNoLocalVideo`: înainte de fiecare `createOffer` (caller) și după `setRemoteDescription(offer)` (callee) — vezi sendOffer / handler offer. */
        /** Nu apelăm `applyCodecPreferencesIfSupported` aici: pe cel care răspunde la ofertă, transceiverele
         *  nu sunt încă aliniate cu SDP-ul distant — ordinea VP8/H264 înainte de `setRemoteDescription(offer)`
         *  poate duce la `setRemoteDescription(answer)` invalid pe celălalt capăt. Preferințele se aplică
         *  doar imediat înainte de `createOffer` (inițiator / iceRestart). */
        void (async () => {
          await setMaxBitrate(pc, adaptiveVideoBpsRef.current);
          await applyVideoDegradationPreference(pc, "maintain-framerate");
        })();

        pc.addEventListener("signalingstatechange", () => {
          if (pc.signalingState !== "stable") return;
          if (!p2pDeferredRemoteOfferSdp) return;
          void withP2pNegotiationLock(async () => {
            if (cancelled || pcRef.current !== pc) return;
            const sdp = p2pDeferredRemoteOfferSdp;
            if (!sdp || pc.signalingState !== "stable") return;
            p2pDeferredRemoteOfferSdp = null;
            const answerTo = typeof remoteIdRef.current === "string" ? remoteIdRef.current : null;
            try {
              void ensureRecvOnlyVideoIfNoLocalVideo(pc, audioOnly, localStream);
              await pc.setRemoteDescription({ type: "offer", sdp });
              flushIceQueue(pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (answerTo && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "", to: answerTo }));
              } else if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "" }));
              }
              if (!cancelled) setState((s) => ({ ...s, status: "connected" }));
            } catch (e) {
              if (!cancelled) {
                const detail = formatRtcNegotiationErrorSuffix(e);
                setState((s) => ({ ...s, error: `Nu am putut negocia conexiunea (offer amânat).${detail}` }));
              }
            }
          });
        });

        negotiateRef.current = async () => {
          const p = pcRef.current;
          const w = wsRef.current;
          const to = remoteIdRef.current;
          if (!p || !w || w.readyState !== WebSocket.OPEN || cancelled || !to) return;
          await withP2pNegotiationLock(async () => {
            try {
              if (p.signalingState !== "stable") return;
              applyCodecPreferencesIfSupported(p);
              p2pSkipOfferRecvVideo = ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
              const offer = await p.createOffer(rtcOfferOptionsWithRecvFallback(p, audioOnly, p2pSkipOfferRecvVideo));
              await p.setLocalDescription(offer);
              console.info("[SIGNALING] outbound offer");
              w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
            } catch {
              /* ignore */
            }
          });
        };

        pc.ontrack = (ev) => {
          if (cancelled) return;
          applyInboundAudioPlayoutHint(ev.receiver);
          const rid = remoteIdRef.current ?? "remote";
          const prev = p2pRemoteStreamRef.current ?? undefined;
          const stream = mergeRemoteTrackIntoMediaStream(prev, ev);
          p2pRemoteStreamRef.current = stream;
          if (prev === stream && prev != null) return;
          setState((s) => ({
            ...s,
            status: "connected",
            connectionPhase: null,
            remoteParticipants: [
              {
                id: rid,
                displayName: "Interlocutor",
                stream,
              },
            ],
          }));
        };

        pc.onicecandidate = (ev) => {
          const to = remoteIdRef.current;
          if (ev.candidate && ws.readyState === WebSocket.OPEN && to) {
            console.info("[ICE] sending local candidate via signaling", {
              type: ev.candidate.type,
              protocol: ev.candidate.protocol,
            });
            ws.send(JSON.stringify({ t: "ice", candidate: ev.candidate.toJSON(), to }));
          } else if (!ev.candidate) {
            console.info("[ICE] local ICE gathering complete (null candidate)");
          }
        };

        pc.onnegotiationneeded = () => {
          void withP2pNegotiationLock(async () => {
            if (cancelled || pcRef.current !== pc) return;
            const w = wsRef.current;
            const to = remoteIdRef.current;
            if (!w || w.readyState !== WebSocket.OPEN || !to) return;
            if (pc.signalingState !== "stable") return;
            try {
              applyCodecPreferencesIfSupported(pc);
              p2pSkipOfferRecvVideo = ensureRecvOnlyVideoIfNoLocalVideo(pc, audioOnly, localStream);
              const offer = await pc.createOffer(rtcOfferOptionsWithRecvFallback(pc, audioOnly, p2pSkipOfferRecvVideo));
              await pc.setLocalDescription(offer);
              w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
            } catch {
              /* ignore */
            }
          });
        };

        pc.oniceconnectionstatechange = () => {
          if (cancelled) return;
          const pIce = pcRef.current;
          if (!pIce) return;
          const ice = pIce.iceConnectionState;
          console.info("[RTC] iceConnectionState", ice);
          pushCallDebug({ kind: "ice_connection_state", detail: { p2p: true, ice } });
          if (p2pIceStuckHintTimerRef.current != null) {
            clearTimeout(p2pIceStuckHintTimerRef.current);
            p2pIceStuckHintTimerRef.current = null;
          }
          if (ice === "checking") {
            p2pIceStuckHintTimerRef.current = window.setTimeout(() => {
              p2pIceStuckHintTimerRef.current = null;
              const cur = pcRef.current;
              if (cancelled || !cur || cur.iceConnectionState !== "checking") return;
              setState((s) => {
                if (s.status !== "connecting" && s.status !== "connected") return s;
                return {
                  ...s,
                  banner:
                    "TURN_REQUIRED: ICE încă în verificare — pe 4G / Wi‑Fi corporativ verifică coturn, porturi și NEXT_PUBLIC_TURN_URLS. PHYSICAL NETWORK LIMITATION – NOT FIXABLE IN CODE dacă tot traficul UDP/TLS e blocat la nivel de rețea.",
                };
              });
            }, 20_000);
          }
        };

        pc.onconnectionstatechange = () => {
          if (cancelled) return;
          const pConn = pcRef.current;
          if (!pConn) return;
          const st = pConn.connectionState;
          console.info("[RTC] connectionState", st);
          pushCallDebug({ kind: "peer_connection_state", detail: { p2p: true, state: st } });
          if (st === "connected") {
            applyPlayoutHintsForAllReceivers(pConn);
            setState((s) => ({ ...s, banner: null, connectionPhase: null }));
            startStatsMonitor();
          }
        };

        p2pHostileDetachRef.current?.();
        p2pHostileDetachRef.current = attachHostileNetworkGuards({
          label: "p2p",
          pc,
          getAuthHeaders,
          isCancelled: () => cancelled,
          onHardFail: (msg) => {
            if (cancelled) return;
            setState((s) => ({
              ...s,
              status: "error",
              error: msg,
              connectionPhase: null,
            }));
            localStream.getTracks().forEach((t) => t.stop());
          },
          onBanner: (m) => {
            if (cancelled) return;
            if (m != null && isHostileIceBannerSuppressedFromUi(m)) {
              console.debug("[Align][callBanner suppressed]", m);
              return;
            }
            setState((s) => ({ ...s, banner: m }));
          },
          publishIceRestartOffer: (sdp) => {
            const to = remoteIdRef.current;
            if (ws.readyState === WebSocket.OPEN && to) {
              ws.send(JSON.stringify({ t: "offer", sdp, to }));
            }
          },
          createIceRestartOffer: async (p) => {
            return withP2pNegotiationLock(async () => {
              applyCodecPreferencesIfSupported(p);
              p2pSkipOfferRecvVideo = ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
              const offer = await p.createOffer({
                ...rtcOfferOptionsWithRecvFallback(p, audioOnly, p2pSkipOfferRecvVideo),
                iceRestart: true,
              });
              await p.setLocalDescription(offer);
              return offer.sdp ?? null;
            });
          },
          onRecoveryPublished: () => {
            p2pQualityFrozenUntilMs = Date.now() + QUALITY_POST_ICE_RECOVERY_FREEZE_MS;
          },
        });

        if (iceQueueRef.current.length) flushIceQueue(pc);
      };

      const sendOffer = async () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const to = remoteIdRef.current;
        const p = pcRef.current;
        if (!to || !p) return;
        await withP2pNegotiationLock(async () => {
          try {
            if (p.signalingState !== "stable") return;
            applyCodecPreferencesIfSupported(p);
            p2pSkipOfferRecvVideo = ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
            const offer = await p.createOffer(rtcOfferOptionsWithRecvFallback(p, audioOnly, p2pSkipOfferRecvVideo));
            await p.setLocalDescription(offer);
            console.info("[SIGNALING] outbound offer (initial)");
            ws.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
          } catch {
            if (!cancelled) setState((s) => ({ ...s, error: "Nu am putut porni oferta WebRTC." }));
          }
        });
      };

      /** După `await` pe deschiderea WS, socketul e deja OPEN — `ws.onopen` nu s-ar mai apela. */
      const onP2pWsReady = () => {
        console.info("[SIGNALING] WebSocket open, join room", { roomId, isCaller });
        if (!cancelled) {
          setState((s) => ({ ...s, connectionPhase: "signaling_connected" }));
        }
        clearConnectWatchdog();
        connectWatchdogRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (remoteIdRef.current) return;
          setState((s) => {
            if (s.status !== "connecting") return s;
            return {
              ...s,
              waitingForPeerInRoom: true,
              connectionPhase: "waiting_peer",
              banner:
                "Nu apare al doilea participant în apel (de obicei după ~1 minut înseamnă că nu e nimeni în cameră). Verifică: celălalt a acceptat apelul sau a deschis același apel din chat; folosiți două conturi diferite (același user în două taburi nu formează o pereche); închide Zoom. Ieși și încearcă din nou.",
            };
          });
        }, 70_000);
        ws.send(JSON.stringify({ t: "join", roomId, userId, isCaller }));
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "heartbeat" }));
        }, HEARTBEAT_MS);
      };

      ws.onmessage = async (ev) => {
        if (cancelled) return;
        const msg = parseSignalingIncoming(String(ev.data));
        if (!msg || typeof msg !== "object" || !("t" in msg)) return;
        const m = msg as {
          t: string;
          sdp?: string;
          candidate?: RTCIceCandidateInit;
          remoteUserId?: string;
          shouldOffer?: boolean;
          from?: string;
        };

        if (m.t !== "pong" && m.t !== "heartbeat") {
          console.info("[SIGNALING] inbound", m.t);
        }

        if (m.t === "joined" && Array.isArray((msg as Record<string, unknown>).peers)) {
          const peersRaw = (msg as Record<string, unknown>).peers;
          const peers = (Array.isArray(peersRaw) ? peersRaw : []).filter(
            (x): x is string => typeof x === "string"
          );
          if (!cancelled) {
            const waiting = peers.length < 2;
            setState((s) => ({
              ...s,
              waitingForPeerInRoom: waiting,
              connectionPhase: waiting ? "waiting_peer" : "peer_joined",
            }));
          }
          return;
        }

        if (m.t === "session") {
          clearConnectWatchdog();
          if (pcRef.current) {
            console.info("[SIGNALING] p2p: duplicate session ignored");
            return;
          }
          if (!cancelled) {
            setState((s) => ({
              ...s,
              waitingForPeerInRoom: false,
              connectionPhase: "negotiating",
            }));
          }
          remoteIdRef.current = typeof m.remoteUserId === "string" ? m.remoteUserId : null;
          setupP2pAfterSession(Boolean(m.shouldOffer));
          if (m.shouldOffer) {
            await sendOffer();
          }
          return;
        }

        if (m.t === "offer" && typeof m.sdp === "string") {
          const offerSdp = m.sdp;
          const p = pcRef.current;
          if (!p) {
            console.warn("[SIGNALING] offer primit înainte de sesiunea P2P — ignorat");
            return;
          }
          const answerTo = typeof m.from === "string" ? m.from : remoteIdRef.current;
          const remotePeer = answerTo ?? "";
          await withP2pNegotiationLock(async () => {
            try {
              const polite = remotePeer.length > 0 && userId < remotePeer;
              const glareRes = await resolveOfferGlare(p, polite, p2pGlareMetrics);
              if (glareRes === "ignore_incoming") return;
              if (glareRes === "defer_incoming") {
                p2pDeferredRemoteOfferSdp = offerSdp;
                patchHostileIceCallQualityOverlay({
                  glareDetectedCount: p2pGlareMetrics.glareDetectedCount,
                  rollbackAttemptedCount: p2pGlareMetrics.rollbackAttemptedCount,
                  rollbackFailedCount: p2pGlareMetrics.rollbackFailedCount,
                });
                return;
              }
              void ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
              await p.setRemoteDescription({ type: "offer", sdp: offerSdp });
              flushIceQueue(p);
              const answer = await p.createAnswer();
              await p.setLocalDescription(answer);
              console.info("[SIGNALING] outbound answer");
              if (answerTo) {
                ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "", to: answerTo }));
              } else {
                ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "" }));
              }
              setState((s) => ({ ...s, status: "connected" }));
              patchHostileIceCallQualityOverlay({
                glareDetectedCount: p2pGlareMetrics.glareDetectedCount,
                rollbackAttemptedCount: p2pGlareMetrics.rollbackAttemptedCount,
                rollbackFailedCount: p2pGlareMetrics.rollbackFailedCount,
              });
            } catch (e) {
              if (!cancelled) {
                const detail = formatRtcNegotiationErrorSuffix(e);
                console.warn("[SIGNALING] p2p: create/set answer after offer failed", e);
                setState((s) => ({ ...s, error: `Nu am putut negocia conexiunea (offer).${detail}` }));
              }
            }
          });
          return;
        }

        if (m.t === "answer" && typeof m.sdp === "string") {
          const p = pcRef.current;
          if (!p) return;
          if (p.signalingState === "stable") {
            console.info("[SIGNALING] p2p: duplicate answer ignored");
            return;
          }
          await withP2pNegotiationLock(async () => {
            try {
              await p.setRemoteDescription({ type: "answer", sdp: m.sdp });
              flushIceQueue(p);
              setState((s) => ({ ...s, status: "connected" }));
            } catch (e) {
              if (!cancelled) {
                const detail = formatRtcNegotiationErrorSuffix(e);
                console.warn("[SIGNALING] p2p: setRemoteDescription(answer) failed", e);
                setState((s) => ({
                  ...s,
                  error: `Nu am putut negocia conexiunea (answer).${detail}`,
                }));
              }
            }
          });
          return;
        }

        if (m.t === "ice" && m.candidate) {
          console.info("[ICE] remote candidate received via signaling");
          const p = pcRef.current;
          if (!p) {
            iceQueueRef.current.push(m.candidate);
            return;
          }
          if (!p.remoteDescription) {
            iceQueueRef.current.push(m.candidate);
            return;
          }
          try {
            await p.addIceCandidate(m.candidate);
          } catch {
            /* ignore */
          }
          return;
        }

        if (m.t === "call-end") {
          if (leaveFlushTimerRef.current != null) {
            clearTimeout(leaveFlushTimerRef.current);
            leaveFlushTimerRef.current = null;
          }
          cleanupMedia();
          if (!cancelled) {
            setState((s) => ({
              ...s,
              status: "left",
              localStream: null,
              remoteParticipants: [],
              banner: null,
              screenSharing: false,
              canSwitchCamera: false,
              permissionHelp: null,
              cameraSoftFailed: false,
              waitingForPeerInRoom: false,
              connectionPhase: null,
            }));
            onAutoEndedRef.current?.();
          }
        }
      };

      ws.onerror = () => {
        console.info("[SIGNALING] WS error");
        clearConnectWatchdog();
        if (!cancelled) {
          setState((s) => ({
            ...s,
            error: "Eroare WebSocket semnalizare — verifică URL-ul WS, firewall și că serverul de semnalizare rulează.",
            connectionPhase: null,
          }));
        }
      };

      if (ws.readyState === WebSocket.OPEN) {
        onP2pWsReady();
      } else {
        ws.addEventListener("open", () => onP2pWsReady(), { once: true });
      }

      callStartRef.current = Date.now();
    };

    void (async () => {
      let signalingBase = getPublicSignalingWsBaseUrl()?.trim() ?? "";
      try {
        const r = await fetch("/api/webrtc-env-check", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (r.ok) {
          const d = (await r.json()) as {
            serverIsWebrtcConfigured?: boolean;
            signalingWsBaseUrl?: string | null;
            nextPublicWebRtcEnabledRaw?: string | null;
          };
          const fromApi = d.signalingWsBaseUrl?.trim() ?? "";
          if (fromApi) signalingBase = fromApi;
          if (
            (d.nextPublicWebRtcEnabledRaw === "false" || d.serverIsWebrtcConfigured === false) &&
            !fromApi
          ) {
            if (!cancelled) {
              setState((s) => ({
                ...s,
                status: "error",
                error:
                  "WebRTC este dezactivat sau lipsește URL semnalizare pe server. Verifică Vercel (NEXT_PUBLIC_*).",
                connectionPhase: null,
              }));
            }
            return;
          }
        }
      } catch {
        /* păstrăm signalingBase din bundle dacă există */
      }
      if (cancelled) return;
      if (!signalingBase.trim()) {
        setState((s) => ({
          ...s,
          status: "error",
          error:
            "WebRTC nu e configurat: setează NEXT_PUBLIC_SIGNALING_WS_URL și rulează serverul de semnalizare (vezi docs/calls.md).",
          connectionPhase: null,
        }));
        return;
      }

      signalingBase = coerceSignalingWsBaseForSecureContext(signalingBase);

      if (isConference) {
        void runConference(signalingBase);
      } else {
        void run(signalingBase);
      }
    })();

    let limitHit = false;
    const limitTimer = setInterval(() => {
      if (limitHit) return;
      const maxMin = maxMinutesRef.current;
      if (callStartRef.current && Date.now() - callStartRef.current > maxMin * 60_000) {
        limitHit = true;
        clearInterval(limitTimer);
        setState((s) => ({ ...s, banner: `Limită apel (${maxMin} min) — apelul se închide.` }));
        try {
          const w = wsRef.current;
          if (w && w.readyState === WebSocket.OPEN) {
            w.send(JSON.stringify({ t: "call-end" }));
            if (leaveFlushTimerRef.current != null) clearTimeout(leaveFlushTimerRef.current);
            leaveFlushTimerRef.current = setTimeout(() => {
              leaveFlushTimerRef.current = null;
              cleanupMedia();
              setState((s) => ({
                ...s,
                status: "left",
                localStream: null,
                remoteParticipants: [],
                screenSharing: false,
                cameraSoftFailed: false,
                waitingForPeerInRoom: false,
                connectionPhase: null,
              }));
              onAutoEndedRef.current?.();
            }, 120);
            return;
          }
        } catch {
          /* ignore */
        }
        cleanupMedia();
        setState((s) => ({
          ...s,
          status: "left",
          localStream: null,
          remoteParticipants: [],
          screenSharing: false,
          cameraSoftFailed: false,
          waitingForPeerInRoom: false,
          connectionPhase: null,
        }));
        onAutoEndedRef.current?.();
      }
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(limitTimer);
      if (leaveFlushTimerRef.current != null) {
        clearTimeout(leaveFlushTimerRef.current);
        leaveFlushTimerRef.current = null;
      }
      cleanupMedia();
    };
  }, [
    roomId,
    userId,
    audioOnly,
    isCaller,
    isConference,
    flushIceQueue,
    cleanupMedia,
    clearStatsMonitor,
    permissionRetryKey,
    attachLocalVideoEndedOnce,
  ]);

  return {
    status: state.status,
    callState,
    error: state.error,
    permissionHelp: state.permissionHelp,
    remoteParticipants: state.remoteParticipants,
    muted: state.muted,
    videoMuted: state.videoMuted,
    cameraSoftFailed: state.cameraSoftFailed,
    setMuted,
    setVideoMuted,
    leave,
    localStream: state.localStream,
    banner: state.banner,
    canSwitchCamera: state.canSwitchCamera,
    screenSharing: state.screenSharing,
    switchCamera,
    toggleScreenShare,
    retryPermissions,
    waitingForPeerInRoom: state.waitingForPeerInRoom,
    connectionPhase: state.connectionPhase,
    cursorDataChannel,
  };
}
