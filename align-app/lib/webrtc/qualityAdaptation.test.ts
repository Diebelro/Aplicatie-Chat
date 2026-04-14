import { describe, expect, it } from "vitest";
import {
  decideQualityAdaptation,
  DEFAULT_QUALITY_OPTS,
  qualitySampleFromUplink,
  type QualityAdaptState,
} from "@/lib/webrtc/qualityAdaptation";

const baseState = (): QualityAdaptState => ({
  badStreak: 0,
  goodStreak: 0,
  degradedSteps: 0,
});

const o = DEFAULT_QUALITY_OPTS;

describe("decideQualityAdaptation", () => {
  it("holds on a single mild bad interval (hysteresis)", () => {
    const sample = qualitySampleFromUplink(o.lostDeltaMild, 0, null, 200_000);
    const d = decideQualityAdaptation(baseState(), sample, 1_000_000, o);
    expect(d.action).toBe("hold");
    if (d.action === "hold") {
      expect(d.next.badStreak).toBeGreaterThan(0);
    }
  });

  it("degrades after sustained bad streak", () => {
    const sample = qualitySampleFromUplink(o.lostDeltaMild, 0, null, 200_000);
    const s1 = decideQualityAdaptation(baseState(), sample, 1_000_000, o);
    expect(s1.action).toBe("hold");
    if (s1.action !== "hold") throw new Error("expected hold");
    const s2 = decideQualityAdaptation(s1.next, sample, 1_000_000, o);
    expect(s2.action).toBe("degrade");
    if (s2.action === "degrade") {
      expect(s2.next.degradedSteps).toBe(1);
      expect(s2.bitrateMultiplier).toBeLessThan(1);
    }
  });

  it("degrades in one interval on severe loss (accelerated bad streak)", () => {
    const severe = qualitySampleFromUplink(o.lostDeltaSevere, 0, null, 200_000);
    const s1 = decideQualityAdaptation(baseState(), severe, 1_000_000, o);
    expect(s1.action).toBe("degrade");
    if (s1.action === "degrade") {
      expect(s1.reason).toBe("severe_loss_jitter_or_rtt");
    }
  });

  it("degrades on sustained high RTT without packet loss", () => {
    const sample = qualitySampleFromUplink(0, 0, o.rttMildMs, 200_000);
    let st = baseState();
    let last = decideQualityAdaptation(st, sample, 1_000_000, o);
    expect(last.action).toBe("hold");
    if (last.action !== "hold") throw new Error("expected hold");
    st = last.next;
    last = decideQualityAdaptation(st, sample, 1_000_000, o);
    expect(last.action).toBe("degrade");
  });

  it("improves gradually after good streak when degraded", () => {
    const good = qualitySampleFromUplink(0, 0, 20, 400_000);
    const degraded: QualityAdaptState = {
      badStreak: 0,
      goodStreak: o.goodStreakToImprove - 1,
      degradedSteps: 2,
    };
    const d = decideQualityAdaptation(degraded, good, 500_000, o);
    expect(d.action).toBe("improve");
    if (d.action === "improve") {
      expect(d.next.degradedSteps).toBe(1);
      expect(d.bitrateMultiplier).toBeGreaterThan(1);
    }
  });

  it("does not improve when still bad", () => {
    const bad = qualitySampleFromUplink(o.lostDeltaMild + 1, 0, null, 200_000);
    const degraded: QualityAdaptState = {
      badStreak: 0,
      goodStreak: 10,
      degradedSteps: 1,
    };
    const d = decideQualityAdaptation(degraded, bad, 500_000, o);
    expect(d.action).not.toBe("improve");
  });
});
