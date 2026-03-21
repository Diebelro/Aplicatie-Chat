"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getCallMediaStream,
  getVideoConstraints,
  isMobileDevice,
} from "@/lib/webrtc/mediaConstraints";
import {
  buildIceServers,
  applyCodecPreferencesIfSupported,
  setMaxBitrate,
} from "@/lib/webrtc/connection";
import { signalingWsConnectUrl, parseSignalingIncoming } from "@/lib/webrtc/signaling";
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
  status: "idle" | "connecting" | "connected" | "left" | "error";
  error: string | null;
  remoteParticipants: RemoteParticipant[];
  muted: boolean;
  videoMuted: boolean;
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

/** Heartbeat client 15–30s (server TTL ~75s implicit). */
const HEARTBEAT_MS = 25_000;

export function useWebRtcCall({
  roomId,
  userId,
  displayName: _localDisplayName,
  audioOnly,
  isCaller,
  isConference,
  onAutoEnded,
}: UseWebRtcCallOptions) {
  const [state, setState] = useState<CallState>({
    status: "idle",
    error: null,
    remoteParticipants: [],
    muted: false,
    videoMuted: audioOnly,
    localStream: null,
    banner: null,
    canSwitchCamera: false,
    screenSharing: false,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
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
  const onAutoEndedRef = useRef(onAutoEnded);
  const negotiateRef = useRef<null | (() => Promise<void>)>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  onAutoEndedRef.current = onAutoEnded;

  const clearStatsMonitor = useCallback(() => {
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
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

    const pc = pcRef.current;
    if (pc) {
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
    localStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    localStreamRef.current = null;
  }, [clearStatsMonitor]);

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
    }));
  }, [cleanupMedia]);

  const setMuted = useCallback((muted: boolean) => {
    setState((s) => {
      const ls = s.localStream;
      ls?.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
      return { ...s, muted };
    });
    pcRef.current?.getSenders().forEach((sender) => {
      if (sender.track?.kind === "audio") sender.track.enabled = !muted;
    });
  }, []);

  const setVideoMuted = useCallback((videoMuted: boolean) => {
    setState((s) => {
      const ls = s.localStream;
      ls?.getVideoTracks().forEach((t) => {
        t.enabled = !videoMuted;
      });
      return { ...s, videoMuted };
    });
    pcRef.current?.getSenders().forEach((sender) => {
      if (sender.track?.kind === "video") sender.track.enabled = !videoMuted;
    });
  }, []);

  const restoreCameraAfterScreen = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream || audioOnly) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;
    screenStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    screenStreamRef.current = null;
    try {
      const prefer1080 = !isMobileDevice() && typeof window !== "undefined" && window.innerWidth >= 1200;
      const video = getVideoConstraints(prefer1080);
      const cam = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      const vt = cam.getVideoTracks()[0];
      const old = sender.track;
      await sender.replaceTrack(vt);
      old?.stop();
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(vt);
      setState((s) => ({ ...s, screenSharing: false, localStream: stream }));
      await negotiateRef.current?.();
      const cfg = getWebrtcPublicConfig();
      const maxBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      await setMaxBitrate(pc, maxBps);
    } catch {
      /* ignore */
    }
  }, [audioOnly]);

  const toggleScreenShare = useCallback(async () => {
    if (!isScreenshareFeatureEnabled() || audioOnly) return;
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;

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
      const old = sender.track;
      await sender.replaceTrack(vt);
      old?.stop();
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(vt);
      screenStreamRef.current = dm;
      setState((s) => ({ ...s, screenSharing: true, localStream: stream }));
      await negotiateRef.current?.();
      const cfg = getWebrtcPublicConfig();
      const maxBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      await setMaxBitrate(pc, maxBps);
    } catch {
      /* utilizator a anulat sau eroare */
    }
  }, [audioOnly, restoreCameraAfterScreen]);

  const switchCamera = useCallback(async () => {
    if (audioOnly || screenStreamRef.current) return;
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender?.track) return;
    const vids = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    if (vids.length < 2) return;
    const currentId = sender.track.getSettings().deviceId;
    const idx = Math.max(0, vids.findIndex((d) => d.deviceId === currentId));
    const next = vids[(idx + 1) % vids.length];
    const prefer1080 = !isMobileDevice() && typeof window !== "undefined" && window.innerWidth >= 1200;
    const vc = getVideoConstraints(prefer1080);
    try {
      const ns = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...vc, deviceId: { exact: next.deviceId } },
      });
      const vt = ns.getVideoTracks()[0];
      const old = sender.track;
      await sender.replaceTrack(vt);
      old.stop();
      stream.getVideoTracks().forEach((t) => stream.removeTrack(t));
      stream.addTrack(vt);
      ns.getAudioTracks().forEach((t) => t.stop());
      setState((s) => ({ ...s, localStream: stream }));
      await negotiateRef.current?.();
      const cfg = getWebrtcPublicConfig();
      const maxBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      await setMaxBitrate(pc, maxBps);
    } catch {
      /* ignore */
    }
  }, [audioOnly]);

  const flushIceQueue = useCallback((pc: RTCPeerConnection) => {
    const q = iceQueueRef.current;
    iceQueueRef.current = [];
    for (const c of q) {
      pc.addIceCandidate(c).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!roomId || !userId || typeof window === "undefined") return;

    if (isConference) {
      setState((s) => ({
        ...s,
        status: "error",
        error:
          "Conferința în grup (link deschis) necesită încă un server media (SFU). Folosește apel 1-la-1 din profil sau chat.",
      }));
      return;
    }

    let cancelled = false;

    const run = async (signalingBaseUrl: string) => {
      const cfg = getWebrtcPublicConfig();
      maxMinutesRef.current = cfg.CALL_MAX_MINUTES;
      const maxVideoBps = isMobileDevice() ? cfg.CALL_MAX_BITRATE_MOBILE : cfg.CALL_MAX_BITRATE_DESKTOP;
      setState((s) => ({
        ...s,
        status: "connecting",
        error: null,
        banner: null,
        canSwitchCamera: false,
        screenSharing: false,
      }));

      let localStream: MediaStream;
      try {
        localStream = await getCallMediaStream(audioOnly);
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: "Nu am putut accesa microfonul/camera." }));
        return;
      }
      if (cancelled) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = localStream;
      setState((s) => ({ ...s, localStream }));

      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const n = devs.filter((d) => d.kind === "videoinput").length;
        if (!cancelled) setState((s) => ({ ...s, canSwitchCamera: !audioOnly && n >= 2 }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, canSwitchCamera: false }));
      }

      const iceRes = await fetch("/api/call/ice-config", { cache: "no-store" });
      if (!iceRes.ok) {
        const err = await iceRes.json().catch(() => ({}));
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: (err as { error?: string }).error ?? "ICE/TURN indisponibil.",
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
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: "Token semnalizare respins." }));
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

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      console.info("[RTC] RTCPeerConnection created");
      /* Negociere: createOffer → setLocalDescription → WS; remote offer → setRemoteDescription → createAnswer → setLocalDescription;
       * ICE: onicecandidate trimite candidați prin WS; de la peer → addIceCandidate (coadă până există remoteDescription). */

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
      applyCodecPreferencesIfSupported(pc);
      void setMaxBitrate(pc, maxVideoBps);

      negotiateRef.current = async () => {
        const p = pcRef.current;
        const w = wsRef.current;
        if (!p || !w || w.readyState !== WebSocket.OPEN || cancelled) return;
        try {
          const offer = await p.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await p.setLocalDescription(offer);
          console.info("[SIGNALING] outbound offer");
          w.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "" }));
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
              if (lostDelta > 35) {
                setState((s) => ({ ...s, banner: "Rețea slabă — pierderi de pachete." }));
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
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        const rid = remoteIdRef.current ?? "remote";
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
        if (ev.candidate && ws.readyState === WebSocket.OPEN) {
          console.info("[ICE] sending local candidate via signaling", {
            type: ev.candidate.type,
            protocol: ev.candidate.protocol,
          });
          ws.send(JSON.stringify({ t: "ice", candidate: ev.candidate.toJSON() }));
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
            if (cancelled || ws.readyState !== WebSocket.OPEN) return;
            try {
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              console.info("[SIGNALING] outbound offer (iceRestart)");
              ws.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "" }));
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
        }
        if (st === "connected") {
          setState((s) => ({ ...s, banner: null }));
          reconnectAttemptRef.current = 0;
          startStatsMonitor();
        }
      };

      const sendOffer = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.info("[SIGNALING] outbound offer (initial)");
          ws.send(JSON.stringify({ t: "offer", sdp: offer.sdp ?? "" }));
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
          try {
            await pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
            flushIceQueue(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.info("[SIGNALING] outbound answer");
            ws.send(JSON.stringify({ t: "answer", sdp: answer.sdp ?? "" }));
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
      void run(signalingBase);
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
        }));
        onAutoEndedRef.current?.();
      }
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(limitTimer);
      cleanupMedia();
      setState((s) => ({
        ...s,
        localStream: null,
        remoteParticipants: [],
        canSwitchCamera: false,
        screenSharing: false,
      }));
    };
  }, [roomId, userId, audioOnly, isCaller, isConference, flushIceQueue, cleanupMedia, clearStatsMonitor]);

  return {
    status: state.status,
    error: state.error,
    remoteParticipants: state.remoteParticipants,
    muted: state.muted,
    videoMuted: state.videoMuted,
    setMuted,
    setVideoMuted,
    leave,
    localStream: state.localStream,
    banner: state.banner,
    canSwitchCamera: state.canSwitchCamera,
    screenSharing: state.screenSharing,
    switchCamera,
    toggleScreenShare,
  };
}
