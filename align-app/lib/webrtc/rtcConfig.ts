/**
 * RTCPeerConnection pentru rețele ostile: TURN relay, bundling strict, pool ICE suficient.
 * PHYSICAL NETWORK LIMITATION – NOT FIXABLE IN CODE: pierdere totală de rută sau DPI care blochează TLS nu se rezolvă din browser.
 */

export type RtcPeerConnectionConfigOptions = {
  /** @deprecated ignorat — folosim mereu același profil ostil */
  mobileLike?: boolean;
};

export function buildRtcPeerConnectionConfig(
  iceServers: RTCIceServer[],
  _opts?: RtcPeerConnectionConfigOptions
): RTCConfiguration {
  const pool = Math.max(6, 8);
  const base: RTCConfiguration = {
    iceServers,
    iceTransportPolicy: "all",
    iceCandidatePoolSize: pool,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
  return {
    ...base,
    ...({
      continualGatheringPolicy: "gather_continually",
    } as Partial<RTCConfiguration>),
  } as RTCConfiguration;
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
