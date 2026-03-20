/**
 * RTCPeerConnection helpers: ICE servers, codec order, bitrate, ICE restart.
 * Nu logăm SDP/ICE în producție din acest modul.
 */

/** Construiește `iceServers` pentru `new RTCPeerConnection({ iceServers })` — același format ca exemplul TURN multi-URL din spec. */
export function buildIceServers(urls: string[], username: string, credential: string): RTCIceServer[] {
  if (!urls.length) return [{ urls: "stun:stun.l.google.com:19302" }];
  return [{ urls, username, credential }];
}

/** Preferă Opus audio; video VP8 apoi H264 (Safari) apoi VP9. */
export function applyCodecPreferencesIfSupported(pc: RTCPeerConnection): void {
  try {
    const v = pc.getTransceivers().find((t) => t.sender.track?.kind === "video");
    if (!v || typeof v.setCodecPreferences !== "function") return;
    const caps = RTCRtpSender.getCapabilities?.("video");
    if (!caps?.codecs?.length) return;
    const order = ["VP8", "H264", "VP9"];
    const codecs = [...caps.codecs].sort((a, b) => {
      const ia = order.findIndex((x) => a.mimeType.toUpperCase().includes(x));
      const ib = order.findIndex((x) => b.mimeType.toUpperCase().includes(x));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    v.setCodecPreferences(codecs);
  } catch {
    /* ignore */
  }
}

export async function setMaxBitrate(
  pc: RTCPeerConnection,
  maxVideoBps: number,
  maxAudioBps = 128_000
): Promise<void> {
  const senders = pc.getSenders();
  for (const s of senders) {
    const kind = s.track?.kind;
    if (!kind) continue;
    try {
      const params = s.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      const cap = kind === "video" ? maxVideoBps : maxAudioBps;
      for (const enc of params.encodings) {
        enc.maxBitrate = cap;
      }
      await s.setParameters(params);
    } catch {
      /* ignore */
    }
  }
}

export async function restartIce(pc: RTCPeerConnection): Promise<void> {
  try {
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
  } catch {
    /* ignore */
  }
}

export type NetworkStatsSummary = {
  bitrateVideo?: number;
  bitrateAudio?: number;
  packetsLost?: number;
  jitter?: number;
};

/** Agregat minimal din getStats (fără a expune obiecte brute în UI). */
export async function pollInboundStats(pc: RTCPeerConnection): Promise<NetworkStatsSummary> {
  const report = await pc.getStats();
  let bitrateVideo = 0;
  let bitrateAudio = 0;
  let packetsLost = 0;
  let jitter = 0;

  report.forEach((s) => {
    if (s.type === "inbound-rtp") {
      if (s.kind === "video" || ("mimeType" in s && String(s.mimeType).startsWith("video/"))) {
        bitrateVideo += (s as RTCInboundRtpStreamStats).bytesReceived ? 1 : 0;
      }
      if ("packetsLost" in s && typeof s.packetsLost === "number") packetsLost += s.packetsLost;
      if ("jitter" in s && typeof s.jitter === "number") jitter = Math.max(jitter, s.jitter);
    }
  });

  return { bitrateVideo, bitrateAudio, packetsLost, jitter };
}
