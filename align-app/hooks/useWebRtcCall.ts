"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  acquireCallMediaStream,
  formatMediaPermissionHelp,
  getVideoConstraints,
  isMobileDevice,
} from "@/lib/webrtc/mediaConstraints";
import {
  iceServersFromIceConfigResponse,
  applyCodecPreferencesIfSupported,
  setMaxBitrate,
  applyVideoDegradationPreference,
} from "@/lib/webrtc/connection";
import {
  buildRtcPeerConnectionConfig,
  applyInboundAudioPlayoutHint,
  applyPlayoutHintsForAllReceivers,
} from "@/lib/webrtc/rtcConfig";
import {
  signalingWsConnectUrl,
  parseSignalingIncoming,
  coerceSignalingWsBaseForSecureContext,
} from "@/lib/webrtc/signaling";
import {
  getWebrtcPublicConfig,
  getPublicSignalingWsBaseUrl,
  isScreenshareFeatureEnabled,
} from "@/lib/env/webrtcConfig";
import { getAuthHeaders } from "@/lib/authClient";

/**
 * Opțiuni pentru `createOffer` după `addTrack`: NU folosi `offerToReceive*` dacă trimitem deja
 * audio+video — în Unified Plan duce la m-lines / SDP incompatibile și `setRemoteDescription(answer)` eșuează.
 * Pentru `iceRestart`, suficient `{ iceRestart: true }` când transceiverele există deja.
 */
function rtcOfferOptionsWithRecvFallback(
  pc: RTCPeerConnection,
  audioOnlyCall: boolean,
  /** true când am adăugat deja `addTransceiver(video, recvonly)` — altfel `offerToReceiveVideo` dublează m-line-ul. */
  skipOfferToReceiveVideo?: boolean
): RTCOfferOptions {
  const sendsVideo = pc.getSenders().some((s) => s.track?.kind === "video");
  const sendsAudio = pc.getSenders().some((s) => s.track?.kind === "audio");
  if (sendsVideo && sendsAudio) return {};
  const o: RTCOfferOptions = {};
  if (!sendsAudio) o.offerToReceiveAudio = true;
  if (!sendsVideo && !audioOnlyCall && !skipOfferToReceiveVideo) o.offerToReceiveVideo = true;
  return o;
}

/**
 * Apel video dar fără track video local (camera refuzată / indisponibilă): fără asta, SDP-ul poate fi
 * incompatibil → `setRemoteDescription(answer)` eșuează pe ofertant.
 * Idempotent: nu adaugă al doilea transceiver video dacă există deja (ex. după `setRemoteDescription(offer)`).
 */
function ensureRecvOnlyVideoIfNoLocalVideo(
  pc: RTCPeerConnection,
  audioOnlyCall: boolean,
  stream: MediaStream
): boolean {
  if (audioOnlyCall) return false;
  if (stream.getVideoTracks().length > 0) return false;
  const hasVideoTransceiver = pc.getTransceivers().some((t) => {
    const k = t.sender.track?.kind ?? t.receiver.track?.kind;
    return k === "video";
  });
  /** După ofertă, browserul mapează de obicei m-line video — nu mai adăugăm recvonly duplicat. */
  if (hasVideoTransceiver) return true;
  try {
    pc.addTransceiver("video", { direction: "recvonly" });
    return true;
  } catch {
    return false;
  }
}

/** Sufix scurt pentru UI / log — fără SDP. */
function formatRtcNegotiationErrorSuffix(e: unknown): string {
  if (e instanceof DOMException) {
    const m = e.message.replace(/\s+/g, " ").trim().slice(0, 140);
    return m ? ` (${e.name}: ${m})` : ` (${e.name})`;
  }
  if (e instanceof Error) {
    const m = e.message.replace(/\s+/g, " ").trim().slice(0, 140);
    return m ? ` (${m})` : "";
  }
  return "";
}

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

type CallState = {
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

/**
 * Multe browsere emit `ontrack` separat pentru audio și video, uneori pe MediaStream-uri diferite.
 * Dacă înlocuim tot `stream`-ul la fiecare eveniment cu un singur track, pierdem celălalt.
 * Returnăm mereu un MediaStream **nou** (referință nouă) ca React să refacă srcObject pe <audio>/<video>.
 */
function accumulateRemoteMediaStream(prev: MediaStream | undefined, ev: RTCTrackEvent): MediaStream {
  const t = ev.track;
  const byId = new Map<string, MediaStreamTrack>();
  for (const x of prev?.getTracks() ?? []) byId.set(x.id, x);
  const s0 = ev.streams[0];
  if (s0) {
    for (const x of s0.getTracks()) byId.set(x.id, x);
  }
  byId.set(t.id, t);
  return new MediaStream([...byId.values()]);
}

/** Heartbeat client 15–30s (server TTL ~75s implicit). */
const HEARTBEAT_MS = 25_000;

type PeerBundle = {
  pc: RTCPeerConnection;
  iceQueue: RTCIceCandidateInit[];
};

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

  const [state, setState] = useState<CallState>({
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
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callStartRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxMinutesRef = useRef(30);
  const reconnectAttemptRef = useRef(0);
  const disconnectRecoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Cap bitrate video trimis: coboară la pierderi mari, urcă treptat când e stabil. */
  const adaptiveVideoBpsRef = useRef(2_500_000);
  const maxVideoBpsCapRef = useRef(2_500_000);
  const stableNetworkIntervalsRef = useRef(0);
  const onAutoEndedRef = useRef(onAutoEnded);
  const negotiateRef = useRef<null | (() => Promise<void>)>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  /** Pe mobil: ultima față folosită pentru comutare user ↔ environment. */
  const facingModeRef = useRef<"user" | "environment">("user");
  /** Conferință: stream combinat per participant distant (vezi accumulateRemoteMediaStream). */
  const meshRemoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  /** 1-la-1: același lucru când audio și video nu vin în același eveniment ontrack. */
  const p2pRemoteStreamRef = useRef<MediaStream | null>(null);
  /** Un singur listener `ended` per track video local (mesh adaugă același track în mai multe PC-uri). */
  const localVideoEndedHandledRef = useRef<WeakSet<MediaStreamTrack>>(new WeakSet());
  /** Dacă nu vine `session` (P2P) / peers mesh, după timeout arătăm mesaj clar — evită „se conectează” ore întregi. */
  const connectWatchdogRef = useRef<number | null>(null);
  /** P2P: după ~20s în `iceConnectionState === checking` arătăm un banner (TURN / rețea). */
  const p2pIceStuckHintTimerRef = useRef<number | null>(null);

  onAutoEndedRef.current = onAutoEnded;

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
    if (disconnectRecoverTimerRef.current) {
      clearTimeout(disconnectRecoverTimerRef.current);
      disconnectRecoverTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
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
    reconnectAttemptRef.current = 0;
    stableNetworkIntervalsRef.current = 0;
    localVideoEndedHandledRef.current = new WeakSet();
  }, [clearStatsMonitor, clearConnectWatchdog]);

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
    try {
      wsRef.current?.send(JSON.stringify({ t: "call-end" }));
    } catch {}
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
    const q = iceQueueRef.current;
    iceQueueRef.current = [];
    for (const c of q) {
      pc.addIceCandidate(c).catch(() => {});
    }
  }, []);

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

      const iceRes = await fetch("/api/call/ice-config", {
        cache: "no-store",
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      if (!iceRes.ok) {
        const err = await iceRes.json().catch(() => ({}));
        if (!cancelled) {
          const apiErr = (err as { error?: string }).error?.trim();
          const msg =
            iceRes.status === 401
              ? apiErr || "Trebuie să fii autentificat pentru ICE/TURN."
              : apiErr || "ICE/TURN indisponibil.";
          setState((s) => ({
            ...s,
            status: "error",
            error: msg,
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const iceJson = (await iceRes.json()) as {
        iceServers?: Array<{ urls?: unknown; username?: string; credential?: string }>;
      };
      if (!(iceJson.iceServers?.length ?? 0)) {
        console.warn("[WebRTC] iceServers from /api/call/ice-config is empty");
      }
      const iceServers = iceServersFromIceConfigResponse(iceJson);
      const rtcPcConfig = buildRtcPeerConnectionConfig(iceServers, { mobileLike: isMobileDevice() });

      const tokRes = await fetch("/api/call/signaling-token", {
        headers: getAuthHeaders(),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!tokRes.ok) {
        const errBody = await tokRes.json().catch(() => ({}));
        const apiErr = (errBody as { error?: string }).error?.trim();
        let msg = apiErr || "Token semnalizare respins.";
        if (tokRes.status === 401) {
          msg = apiErr || "Neautorizat la token semnalizare — ieși și intră din nou în cont.";
        } else if (tokRes.status === 503) {
          msg =
            apiErr ||
            "Semnalizare neconfigurată: pe server pune SIGNALING_TOKEN_SECRET sau NEXTAUTH_SECRET (min 16), același secret ca pe procesul WS; procesul trebuie să ruleze pe NEXT_PUBLIC_SIGNALING_WS_URL.";
        }
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: process.env.NODE_ENV === "development" ? `[${tokRes.status}] ${msg}` : msg,
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const { token } = (await tokRes.json()) as { token?: string };
      if (!token) {
        if (!cancelled) {
          setState((s) => ({ ...s, status: "error", error: "Token semnalizare lipsă.", connectionPhase: null }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

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
      let ws: WebSocket | null = null;
      let activeToken = token;
      for (let attempt = 0; attempt < maxWsAttempts; attempt++) {
        if (cancelled) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (attempt > 0) {
          const delay = Math.min(4000, 400 * 2 ** (attempt - 1));
          console.info("[SIGNALING][mesh] WS reconnect scheduled", { attempt, delayMs: delay });
          await new Promise((r) => setTimeout(r, delay));
          const tokRes2 = await fetch("/api/call/signaling-token", {
            headers: getAuthHeaders(),
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!tokRes2.ok) break;
          const j2 = (await tokRes2.json()) as { token?: string };
          if (!j2.token) break;
          activeToken = j2.token;
        }
        const wsUrl = signalingWsConnectUrl(base, activeToken);
        try {
          const u = new URL(wsUrl);
          u.searchParams.set("token", "<redacted>");
          console.info("[SIGNALING][mesh] WS connecting", u.toString());
        } catch {
          console.info("[SIGNALING][mesh] WS connecting");
        }
        try {
          ws = await new Promise<WebSocket>((resolve, reject) => {
            const w = new WebSocket(wsUrl);
            const to = window.setTimeout(() => {
              try {
                w.close();
              } catch {}
              reject(new Error("WS open timeout"));
            }, 20_000);
            w.addEventListener(
              "open",
              () => {
                window.clearTimeout(to);
                console.info("[SIGNALING][mesh] WS connected");
                resolve(w);
              },
              { once: true }
            );
            w.addEventListener(
              "error",
              () => {
                window.clearTimeout(to);
                reject(new Error("ws error"));
              },
              { once: true }
            );
          });
          break;
        } catch (e) {
          console.warn("[SIGNALING][mesh] WS connect failed", attempt + 1, e);
          ws = null;
          if (attempt === maxWsAttempts - 1) {
            if (!cancelled) {
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
        }
      }
      if (!ws) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      wsRef.current = ws;
      ws.addEventListener("close", (ev) => {
        console.info("[SIGNALING][mesh] WS closed", { code: ev.code, reason: ev.reason });
      });
      ws.addEventListener("error", () => {
        console.info("[SIGNALING][mesh] WS error");
      });

      const flushPeerIce = (bundle: PeerBundle) => {
        const q = bundle.iceQueue;
        bundle.iceQueue = [];
        for (const c of q) {
          void bundle.pc.addIceCandidate(c).catch(() => {});
        }
      };

      negotiateRef.current = async () => {
        const w = wsRef.current;
        if (!w || w.readyState !== WebSocket.OPEN || cancelled) return;
        for (const [peerId, bundle] of peerMapRef.current) {
          if (userId >= peerId) continue;
          const { pc } = bundle;
          try {
            const skipRecv = ensureRecvOnlyVideoIfNoLocalVideo(pc, audioOnly, localStream);
            const offer = await pc.createOffer(
              rtcOfferOptionsWithRecvFallback(pc, audioOnly, skipRecv)
            );
            await pc.setLocalDescription(offer);
            w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to: peerId }));
          } catch {
            /* ignore */
          }
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
        peerMapRef.current.set(remoteUserId, {
          pc,
          iceQueue: [],
        });
        void (async () => {
          await setMaxBitrate(pc, maxVideoBps);
          await applyVideoDegradationPreference(pc, "maintain-framerate");
        })();

        pc.ontrack = (ev) => {
          if (cancelled) return;
          applyInboundAudioPlayoutHint(ev.receiver);
          const prev = meshRemoteStreamsRef.current.get(remoteUserId);
          const stream = accumulateRemoteMediaStream(prev, ev);
          meshRemoteStreamsRef.current.set(remoteUserId, stream);
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

        if (shouldOffer) {
          try {
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
        }
      };

      const applyMeshPeers = async (
        peers: Array<{ remoteUserId?: string; shouldOffer?: boolean }>
      ) => {
        const valid = peers.filter(
          (p): p is { remoteUserId: string; shouldOffer: boolean } =>
            typeof p.remoteUserId === "string" && typeof p.shouldOffer === "boolean"
        );
        const targetIds = new Set(valid.map((p) => p.remoteUserId));
        for (const id of [...peerMapRef.current.keys()]) {
          if (!targetIds.has(id)) {
            peerMapRef.current.get(id)?.pc.close();
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
          let bundle = peerMapRef.current.get(m.from);
          if (!bundle) {
            await ensurePeer(m.from, false);
            bundle = peerMapRef.current.get(m.from);
          }
          if (!bundle || cancelled) return;
          const { pc } = bundle;
          try {
            void ensureRecvOnlyVideoIfNoLocalVideo(pc, audioOnly, localStream);
            await pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
            flushPeerIce(bundle);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "", to: m.from }));
            setState((s) => ({ ...s, status: "connected" }));
          } catch (e) {
            if (!cancelled) {
              const detail = formatRtcNegotiationErrorSuffix(e);
              setState((s) => ({ ...s, error: `Nu am putut negocia conexiunea (offer).${detail}` }));
            }
          }
          return;
        }

        if (m.t === "answer" && typeof m.sdp === "string" && typeof m.from === "string") {
          const bundle = peerMapRef.current.get(m.from);
          if (!bundle) return;
          const { pc } = bundle;
          /** Al doilea `answer` (rețea / server) ajunge după ce PC e deja `stable` — îl ignorăm în loc să aruncăm eroare. */
          if (pc.signalingState === "stable") {
            console.info("[SIGNALING] mesh: duplicate answer ignored", { from: m.from });
            return;
          }
          try {
            await pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
            flushPeerIce(bundle);
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
          peerMapRef.current.get(m.from)?.pc.close();
          peerMapRef.current.delete(m.from);
          meshRemoteStreamsRef.current.delete(m.from);
          setState((s) => ({
            ...s,
            remoteParticipants: s.remoteParticipants.filter((p) => p.id !== m.from),
          }));
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

      const iceRes = await fetch("/api/call/ice-config", {
        cache: "no-store",
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      if (!iceRes.ok) {
        const err = await iceRes.json().catch(() => ({}));
        if (!cancelled) {
          const apiErr = (err as { error?: string }).error?.trim();
          const msg =
            iceRes.status === 401
              ? apiErr || "Trebuie să fii autentificat pentru ICE/TURN."
              : apiErr || "ICE/TURN indisponibil.";
          setState((s) => ({
            ...s,
            status: "error",
            error: msg,
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const iceJson = (await iceRes.json()) as {
        iceServers?: Array<{ urls?: unknown; username?: string; credential?: string }>;
      };
      if (!(iceJson.iceServers?.length ?? 0)) {
        console.warn("[WebRTC] iceServers from /api/call/ice-config is empty");
      }
      /** ICE: URL-uri din env (NEXT_PUBLIC_TURN_URLS), credențiale efemere REST (HMAC-SHA1) — vezi docs/webrtc-turn.md */
      const iceServers = iceServersFromIceConfigResponse(iceJson);
      const rtcPcConfig = buildRtcPeerConnectionConfig(iceServers, { mobileLike: isMobileDevice() });
      console.info("[ICE] ice-config OK", {
        iceServerEntries: iceServers.length,
        apiIceServerObjects: iceJson.iceServers?.length ?? 0,
      });

      const tokRes = await fetch("/api/call/signaling-token", {
        headers: getAuthHeaders(),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!tokRes.ok) {
        const errBody = await tokRes.json().catch(() => ({}));
        const apiErr = (errBody as { error?: string }).error?.trim();
        let msg = apiErr || "Token semnalizare respins.";
        if (tokRes.status === 401) {
          msg = apiErr || "Neautorizat la token semnalizare — ieși și intră din nou în cont.";
        } else if (tokRes.status === 503) {
          msg =
            apiErr ||
            "Semnalizare neconfigurată: pe server pune SIGNALING_TOKEN_SECRET sau NEXTAUTH_SECRET (min 16), același secret ca pe procesul WS; procesul trebuie să ruleze pe NEXT_PUBLIC_SIGNALING_WS_URL.";
        } else if (tokRes.status === 404) {
          msg = apiErr || "Utilizator negăsit pentru token semnalizare.";
        }
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error:
              process.env.NODE_ENV === "development" ? `[${tokRes.status}] ${msg}` : msg,
            connectionPhase: null,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const { token } = (await tokRes.json()) as { token?: string };
      if (!token) {
        if (!cancelled) {
          setState((s) => ({ ...s, status: "error", error: "Token semnalizare lipsă.", connectionPhase: null }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

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
      let ws: WebSocket | null = null;
      let activeToken = token;
      for (let attempt = 0; attempt < maxWsAttempts; attempt++) {
        if (cancelled) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (attempt > 0) {
          const delay = Math.min(4000, 400 * 2 ** (attempt - 1));
          console.info("[SIGNALING] WS reconnect scheduled", { attempt, delayMs: delay });
          await new Promise((r) => setTimeout(r, delay));
          const tokRes2 = await fetch("/api/call/signaling-token", {
            headers: getAuthHeaders(),
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!tokRes2.ok) break;
          const j2 = (await tokRes2.json()) as { token?: string };
          if (!j2.token) break;
          activeToken = j2.token;
        }
        const wsUrl = signalingWsConnectUrl(base, activeToken);
        try {
          const u = new URL(wsUrl);
          u.searchParams.set("token", "<redacted>");
          console.info("[SIGNALING] WS connecting", u.toString());
        } catch {
          console.info("[SIGNALING] WS connecting (url parse skipped)");
        }
        try {
          ws = await new Promise<WebSocket>((resolve, reject) => {
            const w = new WebSocket(wsUrl);
            const to = window.setTimeout(() => {
              try {
                w.close();
              } catch {}
              reject(new Error("WS open timeout"));
            }, 20_000);
            w.addEventListener(
              "open",
              () => {
                window.clearTimeout(to);
                console.info("[SIGNALING] WS connected");
                resolve(w);
              },
              { once: true }
            );
            w.addEventListener(
              "error",
              () => {
                window.clearTimeout(to);
                reject(new Error("ws error"));
              },
              { once: true }
            );
          });
          break;
        } catch (e) {
          console.warn("[SIGNALING] WS connect failed", attempt + 1, e);
          ws = null;
          if (attempt === maxWsAttempts - 1) {
            if (!cancelled) {
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
        }
      }
      if (!ws) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      wsRef.current = ws;
      ws.addEventListener("close", (ev) => {
        console.info("[SIGNALING] WS closed", { code: ev.code, reason: ev.reason });
      });

      p2pRemoteStreamRef.current = null;
      pcRef.current = null;
      negotiateRef.current = null;
      maxVideoBpsCapRef.current = maxVideoBps;
      adaptiveVideoBpsRef.current = maxVideoBps;
      stableNetworkIntervalsRef.current = 0;

      let lastStatsBytes = 0;
      let lastStatsTime = Date.now();
      let lastStatsLost = 0;

      const startStatsMonitor = () => {
        clearStatsMonitor();
        lastStatsBytes = 0;
        lastStatsTime = Date.now();
        lastStatsLost = 0;
        statsTimerRef.current = setInterval(() => {
          void (async () => {
            const p = pcRef.current;
            if (cancelled || !p || p.connectionState !== "connected") return;
            try {
              const report = await p.getStats();
              let vBytes = 0;
              let vLost = 0;
              report.forEach((s) => {
                if (s.type === "inbound-rtp" && "kind" in s && s.kind === "video") {
                  const st = s as RTCInboundRtpStreamStats;
                  if (typeof st.bytesReceived === "number") vBytes += st.bytesReceived;
                  if (typeof st.packetsLost === "number") vLost += st.packetsLost;
                }
              });
              const now = Date.now();
              const dt = (now - lastStatsTime) / 1000;
              const bitrate = dt > 0 ? ((vBytes - lastStatsBytes) * 8) / dt : 0;
              lastStatsBytes = vBytes;
              lastStatsTime = now;
              const lostDelta = vLost - lastStatsLost;
              lastStatsLost = vLost;
              const cap = maxVideoBpsCapRef.current;
              const minBps = isMobileDevice() ? 120_000 : 180_000;
              if (lostDelta > 28) {
                stableNetworkIntervalsRef.current = 0;
                adaptiveVideoBpsRef.current = Math.max(minBps, Math.floor(adaptiveVideoBpsRef.current * 0.62));
                await setMaxBitrate(p, adaptiveVideoBpsRef.current);
                setState((s) => ({ ...s, banner: "Rețea slabă — reduc debitul video pentru continuitate." }));
              } else if (lostDelta <= 4 && bitrate > 0) {
                stableNetworkIntervalsRef.current += 1;
                if (stableNetworkIntervalsRef.current >= 3 && adaptiveVideoBpsRef.current < cap * 0.98) {
                  adaptiveVideoBpsRef.current = Math.min(
                    cap,
                    Math.floor(adaptiveVideoBpsRef.current * 1.08)
                  );
                  await setMaxBitrate(p, adaptiveVideoBpsRef.current);
                  stableNetworkIntervalsRef.current = 0;
                  setState((s) => ({ ...s, banner: null }));
                }
              } else if (lostDelta > 12 && lostDelta <= 28) {
                setState((s) => ({ ...s, banner: "Rețea variabilă — optimizare conexiune." }));
              } else if (!isMobileDevice() && bitrate > 0 && bitrate < 70_000) {
                setState((s) => ({ ...s, banner: "Debit video scăzut — verifică rețeaua." }));
              }
            } catch {
              /* ignore */
            }
          })();
        }, 10_000);
      };

      /** P2P: după `ensureRecvOnlyVideoIfNoLocalVideo` — nu dublăm `offerToReceiveVideo` la createOffer. */
      let p2pSkipOfferRecvVideo = false;

      const tryReconnectIce = () => {
        if (cancelled) return;
        const remote = remoteIdRef.current;
        const iSend = remote ? isCaller || userId < remote : isCaller;
        if (!iSend) return;
        if (reconnectAttemptRef.current >= 2) {
          if (!cancelled) setState((s) => ({ ...s, banner: "Rețea instabilă — încearcă să reîncarci pagina." }));
          return;
        }
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          void (async () => {
            const w = wsRef.current;
            const to = remoteIdRef.current;
            const p = pcRef.current;
            if (cancelled || !p || !w || w.readyState !== WebSocket.OPEN || !to) return;
            try {
              applyCodecPreferencesIfSupported(p);
              p2pSkipOfferRecvVideo = ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
              const offer = await p.createOffer({
                ...rtcOfferOptionsWithRecvFallback(p, audioOnly, p2pSkipOfferRecvVideo),
                iceRestart: true,
              });
              await p.setLocalDescription(offer);
              console.info("[SIGNALING] outbound offer (iceRestart)");
              w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
            } catch {
              /* ignore */
            }
          })();
        }, reconnectAttemptRef.current === 1 ? 500 : 1500);
      };

      const setupP2pAfterSession = () => {
        if (pcRef.current) return;
        const pc = new RTCPeerConnection(rtcPcConfig);
        pcRef.current = pc;
        console.info("[RTC] RTCPeerConnection created (după ce amândoi sunteți în cameră)");

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

        negotiateRef.current = async () => {
          const p = pcRef.current;
          const w = wsRef.current;
          const to = remoteIdRef.current;
          if (!p || !w || w.readyState !== WebSocket.OPEN || cancelled || !to) return;
          try {
            applyCodecPreferencesIfSupported(p);
            p2pSkipOfferRecvVideo = ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
            const offer = await p.createOffer(rtcOfferOptionsWithRecvFallback(p, audioOnly, p2pSkipOfferRecvVideo));
            await p.setLocalDescription(offer);
            console.info("[SIGNALING] outbound offer");
            w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
          } catch {
            /* ignore */
          }
        };

        pc.ontrack = (ev) => {
          if (cancelled) return;
          applyInboundAudioPlayoutHint(ev.receiver);
          const rid = remoteIdRef.current ?? "remote";
          const stream = accumulateRemoteMediaStream(p2pRemoteStreamRef.current ?? undefined, ev);
          p2pRemoteStreamRef.current = stream;
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

        pc.oniceconnectionstatechange = () => {
          if (cancelled) return;
          const pIce = pcRef.current;
          if (!pIce) return;
          const ice = pIce.iceConnectionState;
          console.info("[RTC] iceConnectionState", ice);
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
                    "Conexiunea între dispozitive întârzie (ICE). Pe rețele diferite sau 4G e nevoie de TURN (coturn) și firewall deschis — vezi docs/WEBRTC-IMPREUNA.md",
                };
              });
            }, 20_000);
          }
          if (ice === "failed") {
            setState((s) => ({
              ...s,
              banner:
                "ICE eșuat: nu s-a găsit rută audio/video între browsere. Verifică coturn, porturi UDP și TURN_* / NEXT_PUBLIC_TURN_URLS pe Vercel.",
            }));
          }
        };

        pc.onconnectionstatechange = () => {
          if (cancelled) return;
          const pConn = pcRef.current;
          if (!pConn) return;
          const st = pConn.connectionState;
          console.info("[RTC] connectionState", st);
          if (st === "failed") {
            clearStatsMonitor();
            setState((s) => ({ ...s, banner: "Rețea slabă — încerc reconectare…" }));
            tryReconnectIce();
          }
          if (st === "disconnected") {
            setState((s) => ({ ...s, banner: "Conexiune întreruptă momentan…" }));
            if (disconnectRecoverTimerRef.current) clearTimeout(disconnectRecoverTimerRef.current);
            disconnectRecoverTimerRef.current = setTimeout(() => {
              disconnectRecoverTimerRef.current = null;
              const cur = pcRef.current;
              if (cancelled || !cur || cur.connectionState !== "disconnected") return;
              setState((s) => ({ ...s, banner: "Reiau legătura (ICE)…" }));
              tryReconnectIce();
            }, 2800);
          }
          if (st === "connected") {
            if (disconnectRecoverTimerRef.current) {
              clearTimeout(disconnectRecoverTimerRef.current);
              disconnectRecoverTimerRef.current = null;
            }
            applyPlayoutHintsForAllReceivers(pConn);
            setState((s) => ({ ...s, banner: null, connectionPhase: null }));
            reconnectAttemptRef.current = 0;
            startStatsMonitor();
          }
        };

        if (iceQueueRef.current.length) flushIceQueue(pc);
      };

      const sendOffer = async () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const to = remoteIdRef.current;
        const p = pcRef.current;
        if (!to || !p) return;
        try {
          applyCodecPreferencesIfSupported(p);
          p2pSkipOfferRecvVideo = ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
          const offer = await p.createOffer(rtcOfferOptionsWithRecvFallback(p, audioOnly, p2pSkipOfferRecvVideo));
          await p.setLocalDescription(offer);
          console.info("[SIGNALING] outbound offer (initial)");
          ws.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
        } catch {
          if (!cancelled) setState((s) => ({ ...s, error: "Nu am putut porni oferta WebRTC." }));
        }
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
          setupP2pAfterSession();
          if (m.shouldOffer) {
            await sendOffer();
          }
          return;
        }

        if (m.t === "offer" && typeof m.sdp === "string") {
          const p = pcRef.current;
          if (!p) {
            console.warn("[SIGNALING] offer primit înainte de sesiunea P2P — ignorat");
            return;
          }
          const answerTo = typeof m.from === "string" ? m.from : remoteIdRef.current;
          try {
            void ensureRecvOnlyVideoIfNoLocalVideo(p, audioOnly, localStream);
            await p.setRemoteDescription({ type: "offer", sdp: m.sdp });
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
          } catch (e) {
            if (!cancelled) {
              const detail = formatRtcNegotiationErrorSuffix(e);
              console.warn("[SIGNALING] p2p: create/set answer after offer failed", e);
              setState((s) => ({ ...s, error: `Nu am putut negocia conexiunea (offer).${detail}` }));
            }
          }
          return;
        }

        if (m.t === "answer" && typeof m.sdp === "string") {
          const p = pcRef.current;
          if (!p) return;
          if (p.signalingState === "stable") {
            console.info("[SIGNALING] p2p: duplicate answer ignored");
            return;
          }
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
          wsRef.current?.send(JSON.stringify({ t: "call-end" }));
        } catch {}
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
  };
}
