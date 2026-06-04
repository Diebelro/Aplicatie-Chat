"use client";

import type { GlareMetrics } from "@/lib/webrtc/negotiationMutex";

/**
 * WebRTC peer helpers — extras din `useWebRtcCall` (Checkpoint 1).
 * Conectat în useWebRtcCall la Checkpoint 3B; până atunci acest modul nu e importat.
 */

/** Heartbeat client 15–30s (server TTL ~75s implicit). — copie fidelă din useWebRtcCall. */
export const CALL_SIGNALING_HEARTBEAT_MS = 18_000;

export type PeerBundle = {
  pc: RTCPeerConnection;
  iceQueue: RTCIceCandidateInit[];
  detachHostileGuards?: () => void;
  /** Mutex din `createNegotiationMutex()` — aceeași semnătură folosită în useWebRtcCall. */
  withNegotiationLock: (fn: () => Promise<void>) => Promise<void>;
  glare: GlareMetrics;
  deferredRemoteOfferSdp: string | null;
};

/**
 * Opțiuni pentru `createOffer` după `addTrack`: NU folosi `offerToReceive*` dacă trimitem deja
 * audio+video — în Unified Plan duce la m-lines / SDP incompatibile și `setRemoteDescription(answer)` eșuează.
 */
export function rtcOfferOptionsWithRecvFallback(
  pc: RTCPeerConnection,
  audioOnlyCall: boolean,
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
 */
export function ensureRecvOnlyVideoIfNoLocalVideo(
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
  if (hasVideoTransceiver) return true;
  try {
    pc.addTransceiver("video", { direction: "recvonly" });
    return true;
  } catch {
    return false;
  }
}

/** Sufix scurt pentru UI / log — fără SDP. */
export function formatRtcNegotiationErrorSuffix(e: unknown): string {
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

/**
 * Multe browsere emit `ontrack` separat pentru audio și video.
 * Păstrăm **aceeași** instanță MediaStream și adăugăm track-uri.
 */
export function mergeRemoteTrackIntoMediaStream(
  prev: MediaStream | undefined,
  ev: RTCTrackEvent
): MediaStream {
  const out = prev ?? new MediaStream();
  const t = ev.track;
  const sameId = out.getTracks().find((x) => x.id === t.id);
  if (sameId && sameId !== t) {
    try {
      out.removeTrack(sameId);
    } catch {
      /* ignore */
    }
    try {
      sameId.stop();
    } catch {
      /* ignore */
    }
  }
  if (!out.getTracks().some((x) => x === t)) {
    try {
      out.addTrack(t);
    } catch {
      /* duplicate / ended */
    }
  }
  const s0 = ev.streams[0];
  if (s0) {
    for (const x of s0.getTracks()) {
      if (x === t) continue;
      if (out.getTracks().some((y) => y.id === x.id)) continue;
      try {
        out.addTrack(x);
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

export function flushIceQueueOnPeer(
  pc: RTCPeerConnection,
  queueRef: { current: RTCIceCandidateInit[] }
): void {
  const q = queueRef.current;
  queueRef.current = [];
  for (const c of q) {
    pc.addIceCandidate(c).catch(() => {});
  }
}

export function flushPeerBundleIce(bundle: PeerBundle): void {
  const q = bundle.iceQueue;
  bundle.iceQueue = [];
  for (const c of q) {
    void bundle.pc.addIceCandidate(c).catch(() => {});
  }
}

