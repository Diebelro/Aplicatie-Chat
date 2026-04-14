import type { QualitySample, QualityUplinkSource } from "@/lib/webrtc/qualityAdaptation";

const EMA_ALPHA = 0.38;

function num(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

function ema(prev: number, next: number, alpha = EMA_ALPHA): number {
  return prev === 0 && next > 0 ? next : alpha * next + (1 - alpha) * prev;
}

function emaNullable(prev: number | null, next: number | null, alpha = EMA_ALPHA): number | null {
  if (next == null) return prev;
  if (prev == null) return next;
  return alpha * next + (1 - alpha) * prev;
}

export type QualityStatsCursor = {
  t: number;
  videoPacketsReceived: number;
  videoPacketsLost: number;
  videoJitter: number;
  audioJitter: number;
  outboundVideoBytesSent: number;
  remoteInboundPacketsLost: number;
  emaUplinkBitrate: number;
  emaUplinkJitter: number;
  emaUplinkRttMs: number | null;
  emaDownlinkJitter: number;
};

export function emptyQualityStatsCursor(): QualityStatsCursor {
  return {
    t: Date.now(),
    videoPacketsReceived: 0,
    videoPacketsLost: 0,
    videoJitter: 0,
    audioJitter: 0,
    outboundVideoBytesSent: 0,
    remoteInboundPacketsLost: 0,
    emaUplinkBitrate: 0,
    emaUplinkJitter: 0,
    emaUplinkRttMs: null,
    emaDownlinkJitter: 0,
  };
}

type StatsRecord = Record<string, unknown>;

function readKind(s: unknown): string {
  if (s && typeof s === "object" && "kind" in s) {
    const k = (s as { kind?: string }).kind;
    return typeof k === "string" ? k : "";
  }
  return "";
}

/**
 * Chrome/Chromium: `remote-inbound-rtp` links to our `outbound-rtp` via `localId`.
 * Safari often omits `remote-inbound-rtp` — caller uses inbound-rtp + candidate-pair fallback.
 */
export function findVideoRemoteInboundForOutbound(
  report: RTCStatsReport,
  outboundStatId: string
): StatsRecord | null {
  let best: StatsRecord | null = null;
  report.forEach((s) => {
    if (s.type !== "remote-inbound-rtp") return;
    if (readKind(s) !== "video") return;
    const o = s as StatsRecord;
    if (o.localId === outboundStatId) {
      best = o;
    }
  });
  return best;
}

export function uplinkBitrateFromOutboundBytes(
  bytesSentNow: number,
  bytesSentPrev: number,
  dtSec: number
): number {
  if (dtSec <= 0) return 0;
  const delta = Math.max(0, bytesSentNow - bytesSentPrev);
  return (delta * 8) / dtSec;
}

export function sampleQualityFromPeerConnectionStats(
  report: RTCStatsReport,
  prev: QualityStatsCursor
): { sample: QualitySample; next: QualityStatsCursor; uplinkBitrateRawBps: number } {
  let vRx = 0;
  let vLost = 0;
  let vJitter = 0;
  let aJitter = 0;
  let rttSec: number | null = null;

  let outboundVideoId: string | null = null;
  let outboundBytesSent = 0;
  let remoteLost = 0;
  let remoteJitter = 0;
  let remoteRttSec: number | null = null;

  report.forEach((s) => {
    if (s.type === "outbound-rtp" && readKind(s) === "video") {
      const o = s as StatsRecord;
      const id = typeof o.id === "string" ? o.id : "";
      if (id) outboundVideoId = id;
      outboundBytesSent += num(o.bytesSent);
    }
    if (s.type === "inbound-rtp") {
      const k = readKind(s);
      if (k === "video") {
        const o = s as StatsRecord;
        vRx += num(o.packetsReceived);
        vLost += num(o.packetsLost);
        vJitter = Math.max(vJitter, num(o.jitter));
      }
      if (k === "audio") {
        const o = s as StatsRecord;
        aJitter = Math.max(aJitter, num(o.jitter));
      }
    }
    if (s.type === "candidate-pair") {
      const p = s as { state?: string; currentRoundTripTime?: number };
      if (p.state === "succeeded" && typeof p.currentRoundTripTime === "number") {
        const v = p.currentRoundTripTime;
        if (rttSec == null || v < rttSec) rttSec = v;
      }
    }
  });

  let uplinkSource: QualityUplinkSource = "none";
  let rttSource: QualitySample["sampleSourceRtt"] = "none";

  if (outboundVideoId) {
    const rim = findVideoRemoteInboundForOutbound(report, outboundVideoId);
    if (rim) {
      uplinkSource = "remote-inbound";
      rttSource = "remote-inbound";
      remoteLost = num(rim.packetsLost);
      remoteJitter = num(rim.jitter);
      const rtt = rim.roundTripTime;
      if (typeof rtt === "number" && Number.isFinite(rtt)) remoteRttSec = rtt;
    }
  }

  const now = Date.now();
  const dt = Math.max(0.25, (now - prev.t) / 1000);

  const downlinkLostDelta = Math.max(0, vLost - prev.videoPacketsLost);
  const uplinkBitrateRaw = uplinkBitrateFromOutboundBytes(
    outboundBytesSent,
    prev.outboundVideoBytesSent,
    dt
  );

  let uplinkLostDelta = 0;
  let uplinkJitterRaw = 0;
  let uplinkRttRawMs: number | null = null;

  if (uplinkSource === "remote-inbound") {
    uplinkLostDelta = Math.max(0, remoteLost - prev.remoteInboundPacketsLost);
    uplinkJitterRaw = remoteJitter;
    uplinkRttRawMs = remoteRttSec != null ? Math.round(remoteRttSec * 1000) : null;
    if (uplinkRttRawMs == null && rttSec != null) {
      uplinkRttRawMs = Math.round(rttSec * 1000);
      rttSource = "candidate-pair";
    }
  } else {
    uplinkSource = "inbound-downlink";
    uplinkLostDelta = downlinkLostDelta;
    uplinkJitterRaw = vJitter;
    uplinkRttRawMs = rttSec != null ? Math.round(rttSec * 1000) : null;
    rttSource = uplinkRttRawMs != null ? "candidate-pair" : "none";
  }

  const emaBitrate = ema(prev.emaUplinkBitrate, uplinkBitrateRaw);
  const emaUj = ema(prev.emaUplinkJitter, uplinkJitterRaw);
  const emaRtt = emaNullable(prev.emaUplinkRttMs, uplinkRttRawMs);
  const emaDj = ema(prev.emaDownlinkJitter, vJitter);

  const next: QualityStatsCursor = {
    t: now,
    videoPacketsReceived: vRx,
    videoPacketsLost: vLost,
    videoJitter: vJitter,
    audioJitter: aJitter,
    outboundVideoBytesSent: outboundBytesSent,
    remoteInboundPacketsLost: remoteLost,
    emaUplinkBitrate: emaBitrate,
    emaUplinkJitter: emaUj,
    emaUplinkRttMs: emaRtt,
    emaDownlinkJitter: emaDj,
  };

  const sample: QualitySample = {
    uplinkLostDelta: uplinkLostDelta,
    uplinkJitterSec: emaUj,
    uplinkRttMs: emaRtt,
    uplinkBitrateBps: emaBitrate,
    downlinkLostDelta,
    downlinkJitterSec: emaDj,
    sampleSourceUplink: uplinkSource,
    sampleSourceRtt: rttSource,
  };

  return { sample, next, uplinkBitrateRawBps: uplinkBitrateRaw };
}
