/**
 * Configurare RTCPeerConnection orientată spre stabilitate pe rețele mobile / NAT / pierderi.
 * Nu înlocuiește TURN bun — doar optimizează modul în care browserul folosește ICE.
 */

export function buildRtcPeerConnectionConfig(iceServers: RTCIceServer[]): RTCConfiguration {
  return {
    iceServers,
    /** Pregătește candidați ICE înainte de start — conectare mai rapidă după ofertă (Chromium, Firefox). */
    iceCandidatePoolSize: 10,
    /** Un singur transport pentru toate mediile — mai puține găuri în firewall, mai stabil. */
    bundlePolicy: "max-bundle",
    /** RTCP multiplexat pe același port ca RTP — standard modern, evită probleme pe rețele stricte. */
    rtcpMuxPolicy: "require",
  };
}

/**
 * Mic buffer de redare pe audio inbound = mai tolerant la jitter pe Wi‑Fi/4G (latență puțin mai mare).
 * Doar unde API-ul există (Chrome și derivate).
 */
const DEFAULT_AUDIO_PLAYOUT_DELAY_S = 0.12;

export function applyInboundAudioPlayoutHint(receiver: RTCRtpReceiver, delaySec = DEFAULT_AUDIO_PLAYOUT_DELAY_S): void {
  try {
    if (receiver.track?.kind !== "audio") return;
    (receiver as RTCRtpReceiver & { playoutDelayHint?: number }).playoutDelayHint = delaySec;
  } catch {
    /* ignore */
  }
}

export function applyPlayoutHintsForAllReceivers(pc: RTCPeerConnection, delaySec = DEFAULT_AUDIO_PLAYOUT_DELAY_S): void {
  for (const t of pc.getTransceivers()) {
    if (t.receiver?.track?.kind === "audio") {
      applyInboundAudioPlayoutHint(t.receiver, delaySec);
    }
  }
}
