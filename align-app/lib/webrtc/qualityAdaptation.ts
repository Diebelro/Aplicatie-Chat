export type QualityAdaptState = {
  badStreak: number;
  goodStreak: number;
  degradedSteps: number;
};

/** Where uplink metrics were derived (remote RTCP reports vs Safari-style fallback). */
export type QualityUplinkSource = "remote-inbound" | "inbound-downlink" | "none";

export type QualitySample = {
  uplinkLostDelta: number;
  uplinkJitterSec: number;
  uplinkRttMs: number | null;
  uplinkBitrateBps: number;
  downlinkLostDelta: number;
  downlinkJitterSec: number;
  sampleSourceUplink: QualityUplinkSource;
  /** RTT source when uplink RTT missing (e.g. candidate-pair). */
  sampleSourceRtt: "remote-inbound" | "candidate-pair" | "none";
};

export type QualityAdaptationOpts = {
  badStreakToDegrade: number;
  goodStreakToImprove: number;
  lostDeltaMild: number;
  lostDeltaSevere: number;
  jitterVideoMildSec: number;
  jitterVideoSevereSec: number;
  rttMildMs: number;
  rttSevereMs: number;
  degradeBitrateFactor: number;
  improveBitrateFactor: number;
  minBitrateBps: number;
  maxBitrateBps: number;
};

export const DEFAULT_QUALITY_OPTS: QualityAdaptationOpts = {
  badStreakToDegrade: 2,
  goodStreakToImprove: 4,
  lostDeltaMild: 9,
  lostDeltaSevere: 22,
  jitterVideoMildSec: 0.02,
  jitterVideoSevereSec: 0.042,
  rttMildMs: 240,
  rttSevereMs: 420,
  degradeBitrateFactor: 0.72,
  improveBitrateFactor: 1.06,
  minBitrateBps: 120_000,
  maxBitrateBps: 2_500_000,
};

function isBadSample(s: QualitySample, o: QualityAdaptationOpts): boolean {
  if (s.uplinkLostDelta >= o.lostDeltaMild) return true;
  if (s.uplinkJitterSec >= o.jitterVideoMildSec && s.uplinkLostDelta > 3) return true;
  if (s.downlinkJitterSec >= o.jitterVideoMildSec * 1.2 && s.downlinkLostDelta > 2) return true;
  if (s.uplinkRttMs != null && s.uplinkRttMs >= o.rttMildMs) return true;
  if (s.sampleSourceUplink === "inbound-downlink" && s.downlinkLostDelta >= o.lostDeltaMild + 4) return true;
  return false;
}

function isSevereSample(s: QualitySample, o: QualityAdaptationOpts): boolean {
  if (s.uplinkLostDelta >= o.lostDeltaSevere) return true;
  if (s.uplinkJitterSec >= o.jitterVideoSevereSec) return true;
  if (s.uplinkRttMs != null && s.uplinkRttMs >= o.rttSevereMs) return true;
  return false;
}

export type QualityDecision =
  | { action: "hold"; next: QualityAdaptState; reason: string }
  | {
      action: "degrade";
      next: QualityAdaptState;
      bitrateMultiplier: number;
      downscaleDelta: number;
      reason: string;
    }
  | {
      action: "improve";
      next: QualityAdaptState;
      bitrateMultiplier: number;
      downscaleDelta: number;
      reason: string;
    };

export function decideQualityAdaptation(
  prev: QualityAdaptState,
  sample: QualitySample,
  currentBitrateBps: number,
  o: QualityAdaptationOpts
): QualityDecision {
  const bad = isBadSample(sample, o);
  const severe = isSevereSample(sample, o);

  let badStreak = prev.badStreak;
  let goodStreak = prev.goodStreak;
  let degradedSteps = prev.degradedSteps;

  if (bad) {
    badStreak += severe ? 2 : 1;
    goodStreak = 0;
  } else if (sample.uplinkBitrateBps > 5_000 || sample.uplinkLostDelta === 0) {
    goodStreak += 1;
    badStreak = Math.max(0, badStreak - 1);
  } else {
    goodStreak = Math.max(0, goodStreak - 1);
  }

  const nextBase: QualityAdaptState = { badStreak, goodStreak, degradedSteps };

  if (badStreak >= o.badStreakToDegrade) {
    const mult = severe ? o.degradeBitrateFactor * 0.92 : o.degradeBitrateFactor;
    const capped = Math.max(o.minBitrateBps, Math.floor(currentBitrateBps * mult));
    const ratio = capped / Math.max(1, currentBitrateBps);
    return {
      action: "degrade",
      next: {
        badStreak: 0,
        goodStreak: 0,
        degradedSteps: degradedSteps + 1,
      },
      bitrateMultiplier: ratio,
      downscaleDelta: severe ? 2 : 1,
      reason: severe ? "severe_loss_jitter_or_rtt" : "mild_sustained_bad",
    };
  }

  if (degradedSteps > 0 && goodStreak >= o.goodStreakToImprove && !bad) {
    const target = Math.min(
      o.maxBitrateBps,
      Math.floor(currentBitrateBps * o.improveBitrateFactor)
    );
    const ratio = target / Math.max(1, currentBitrateBps);
    return {
      action: "improve",
      next: {
        badStreak: 0,
        goodStreak: 0,
        degradedSteps: Math.max(0, degradedSteps - 1),
      },
      bitrateMultiplier: ratio,
      downscaleDelta: -1,
      reason: "stable_good_streak",
    };
  }

  return { action: "hold", next: nextBase, reason: bad ? "accumulating_bad" : "stable" };
}

/** Test helper: map legacy uplink-only fields into `QualitySample`. */
export function qualitySampleFromUplink(
  uplinkLostDelta: number,
  uplinkJitterSec: number,
  uplinkRttMs: number | null,
  uplinkBitrateBps: number,
  source: QualityUplinkSource = "remote-inbound"
): QualitySample {
  return {
    uplinkLostDelta,
    uplinkJitterSec,
    uplinkRttMs,
    uplinkBitrateBps,
    downlinkLostDelta: 0,
    downlinkJitterSec: 0,
    sampleSourceUplink: source,
    sampleSourceRtt: uplinkRttMs != null ? "remote-inbound" : "none",
  };
}
