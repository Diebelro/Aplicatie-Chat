"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  acquireCallMediaStream,
  formatMediaPermissionHelp,
  getVideoConstraints,
  isMobileDevice,
} from "@/lib/webrtc/mediaConstraints";
import {
  buildIceServers,
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

/** Cerere explicită receive audio+video la ofertă — aliniat cu `ensurePeer` (conferință); fără asta unele browsere negociază incomplet video 1-la-1. */
const P2P_OFFER_MEDIA: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};
import {
  getWebrtcPublicConfig,
  getPublicSignalingWsBaseUrl,
  isScreenshareFeatureEnabled,
} from "@/lib/env/webrtcConfig";
import { getAuthHeaders } from "@/lib/authClient";

export type RemoteParticipant = {
  id: string;
  displayName: string;
  stream: MediaStream | null;
};

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

  onAutoEndedRef.current = onAutoEnded;

  const clearStatsMonitor = useCallback(() => {
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
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
  }, [clearStatsMonitor]);

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
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const iceJson = (await iceRes.json()) as {
        iceServers?: { urls: string[]; username?: string; credential?: string }[];
      };
      const rawServers = iceJson.iceServers;
      if (!rawServers?.length) {
        console.warn("[WebRTC] iceServers from /api/call/ice-config is empty");
      }
      const first = rawServers?.[0];
      const iceServers = first
        ? buildIceServers(
            Array.isArray(first.urls) ? first.urls : [String(first.urls)],
            first.username ?? "",
            first.credential ?? ""
          )
        : [{ urls: "stun:stun.l.google.com:19302" }];

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
            "Semnalizare neconfigurată pe server: pune TURN_AUTH_SECRET (min 16) și SIGNALING_TOKEN_SECRET sau NEXTAUTH_SECRET pe Vercel (Production).";
        }
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: process.env.NODE_ENV === "development" ? `[${tokRes.status}] ${msg}` : msg,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const { token } = (await tokRes.json()) as { token?: string };
      if (!token) {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: "Token semnalizare lipsă." }));
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      const base = signalingBaseUrl.trim();
      if (!base) {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: "NEXT_PUBLIC_SIGNALING_WS_URL lipsă." }));
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (cancelled) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      const wsUrl = signalingWsConnectUrl(base, token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

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
        for (const [peerId, { pc }] of peerMapRef.current) {
          if (userId >= peerId) continue;
          try {
            const offer = await pc.createOffer(P2P_OFFER_MEDIA);
            await pc.setLocalDescription(offer);
            w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to: peerId }));
          } catch {
            /* ignore */
          }
        }
      };

      const ensurePeer = async (remoteUserId: string, shouldOffer: boolean) => {
        if (peerMapRef.current.has(remoteUserId)) return;
        const pc = new RTCPeerConnection(buildRtcPeerConnectionConfig(iceServers));
        peerMapRef.current.set(remoteUserId, { pc, iceQueue: [] });
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
        applyCodecPreferencesIfSupported(pc);
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
            const offer = await pc.createOffer(P2P_OFFER_MEDIA);
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

      ws.onopen = () => {
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
          peers?: Array<{ remoteUserId?: string; shouldOffer?: boolean }>;
        };

        if (m.t === "mesh-peers" && Array.isArray(m.peers)) {
          await applyMeshPeers(m.peers);
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
            await pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
            flushPeerIce(bundle);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "", to: m.from }));
            setState((s) => ({ ...s, status: "connected" }));
          } catch {
            if (!cancelled) setState((s) => ({ ...s, error: "Nu am putut negocia conexiunea (offer)." }));
          }
          return;
        }

        if (m.t === "answer" && typeof m.sdp === "string" && typeof m.from === "string") {
          const bundle = peerMapRef.current.get(m.from);
          if (!bundle) return;
          try {
            await bundle.pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
            flushPeerIce(bundle);
            setState((s) => ({ ...s, status: "connected" }));
          } catch {
            if (!cancelled) setState((s) => ({ ...s, error: "Nu am putut negocia conexiunea (answer)." }));
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
        if (!cancelled) setState((s) => ({ ...s, error: "Eroare WebSocket semnalizare." }));
      };
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
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const iceJson = (await iceRes.json()) as {
        iceServers?: { urls: string[]; username?: string; credential?: string }[];
      };
      const rawServers = iceJson.iceServers;
      if (!rawServers?.length) {
        console.warn("[WebRTC] iceServers from /api/call/ice-config is empty");
      }
      const first = rawServers?.[0];
      /** ICE: URL-uri din env (NEXT_PUBLIC_TURN_URLS), credențiale efemere REST (HMAC-SHA1) de la server — vezi docs/webrtc-turn.md */
      const iceServers = first
        ? buildIceServers(
            Array.isArray(first.urls) ? first.urls : [String(first.urls)],
            first.username ?? "",
            first.credential ?? ""
          )
        : [{ urls: "stun:stun.l.google.com:19302" }];
      console.info("[ICE] ice-config OK", {
        iceServerEntries: iceServers.length,
        turnUrlsFromApi: rawServers?.length ?? 0,
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
            "Semnalizare neconfigurată pe server: pune TURN_AUTH_SECRET (min 16) și SIGNALING_TOKEN_SECRET sau NEXTAUTH_SECRET pe Vercel (Production).";
        } else if (tokRes.status === 404) {
          msg = apiErr || "Utilizator negăsit pentru token semnalizare.";
        }
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error:
              process.env.NODE_ENV === "development" ? `[${tokRes.status}] ${msg}` : msg,
          }));
        }
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const { token } = (await tokRes.json()) as { token?: string };
      if (!token) {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: "Token semnalizare lipsă." }));
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      const base = signalingBaseUrl.trim();
      if (!base) {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: "NEXT_PUBLIC_SIGNALING_WS_URL lipsă." }));
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (cancelled) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      const wsUrl = signalingWsConnectUrl(base, token);
      try {
        const u = new URL(wsUrl);
        u.searchParams.set("token", "<redacted>");
        console.info("[SIGNALING] connecting", u.toString());
      } catch {
        console.info("[SIGNALING] connecting (url parse skipped)");
      }
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      p2pRemoteStreamRef.current = null;
      const pc = new RTCPeerConnection(buildRtcPeerConnectionConfig(iceServers));
      pcRef.current = pc;
      maxVideoBpsCapRef.current = maxVideoBps;
      adaptiveVideoBpsRef.current = maxVideoBps;
      stableNetworkIntervalsRef.current = 0;
      console.info("[RTC] RTCPeerConnection created");
      /* Negociere: createOffer → setLocalDescription → WS; remote offer → setRemoteDescription → createAnswer → setLocalDescription;
       * ICE: onicecandidate trimite candidați prin WS; de la peer → addIceCandidate (coadă până există remoteDescription). */

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
      applyCodecPreferencesIfSupported(pc);
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
          const offer = await p.createOffer(P2P_OFFER_MEDIA);
          await p.setLocalDescription(offer);
          console.info("[SIGNALING] outbound offer");
          w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
        } catch {
          /* ignore */
        }
      };

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

      pc.ontrack = (ev) => {
        if (cancelled) return;
        applyInboundAudioPlayoutHint(ev.receiver);
        const rid = remoteIdRef.current ?? "remote";
        const stream = accumulateRemoteMediaStream(p2pRemoteStreamRef.current ?? undefined, ev);
        p2pRemoteStreamRef.current = stream;
        setState((s) => ({
          ...s,
          status: "connected",
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
            const to = remoteIdRef.current;
            if (cancelled || ws.readyState !== WebSocket.OPEN || !to) return;
            try {
              const offer = await pc.createOffer({ ...P2P_OFFER_MEDIA, iceRestart: true });
              await pc.setLocalDescription(offer);
              console.info("[SIGNALING] outbound offer (iceRestart)");
              ws.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
            } catch {
              /* ignore */
            }
          })();
        }, reconnectAttemptRef.current === 1 ? 500 : 1500);
      };

      pc.onconnectionstatechange = () => {
        if (cancelled) return;
        const st = pc.connectionState;
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
            if (cancelled || pc.connectionState !== "disconnected") return;
            setState((s) => ({ ...s, banner: "Reiau legătura (ICE)…" }));
            tryReconnectIce();
          }, 2800);
        }
        if (st === "connected") {
          if (disconnectRecoverTimerRef.current) {
            clearTimeout(disconnectRecoverTimerRef.current);
            disconnectRecoverTimerRef.current = null;
          }
          applyPlayoutHintsForAllReceivers(pc);
          setState((s) => ({ ...s, banner: null }));
          reconnectAttemptRef.current = 0;
          startStatsMonitor();
        }
      };

      const sendOffer = async () => {
        const to = remoteIdRef.current;
        if (!to) return;
        try {
          const offer = await pc.createOffer(P2P_OFFER_MEDIA);
          await pc.setLocalDescription(offer);
          console.info("[SIGNALING] outbound offer (initial)");
          ws.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "", to }));
        } catch {
          if (!cancelled) setState((s) => ({ ...s, error: "Nu am putut porni oferta WebRTC." }));
        }
      };

      ws.onopen = () => {
        console.info("[SIGNALING] WebSocket open, join room", { roomId, isCaller });
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

        if (m.t === "session") {
          remoteIdRef.current = typeof m.remoteUserId === "string" ? m.remoteUserId : null;
          if (m.shouldOffer) {
            await sendOffer();
          }
          return;
        }

        if (m.t === "offer" && typeof m.sdp === "string") {
          const answerTo = typeof m.from === "string" ? m.from : remoteIdRef.current;
          try {
            await pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
            flushIceQueue(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.info("[SIGNALING] outbound answer");
            if (answerTo) {
              ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "", to: answerTo }));
            } else {
              ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "" }));
            }
            setState((s) => ({ ...s, status: "connected" }));
          } catch {
            if (!cancelled) setState((s) => ({ ...s, error: "Nu am putut negocia conexiunea (offer)." }));
          }
          return;
        }

        if (m.t === "answer" && typeof m.sdp === "string") {
          try {
            await pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
            flushIceQueue(pc);
            setState((s) => ({ ...s, status: "connected" }));
          } catch {
            if (!cancelled) setState((s) => ({ ...s, error: "Nu am putut negocia conexiunea (answer)." }));
          }
          return;
        }

        if (m.t === "ice" && m.candidate) {
          console.info("[ICE] remote candidate received via signaling");
          if (!pc.remoteDescription) {
            iceQueueRef.current.push(m.candidate);
            return;
          }
          try {
            await pc.addIceCandidate(m.candidate);
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
            }));
            onAutoEndedRef.current?.();
          }
        }
      };

      ws.onerror = () => {
        console.info("[SIGNALING] WebSocket error");
        if (!cancelled) setState((s) => ({ ...s, error: "Eroare WebSocket semnalizare." }));
      };

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
  };
}
