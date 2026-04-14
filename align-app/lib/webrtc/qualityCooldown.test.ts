import { describe, expect, it } from "vitest";
import {
  canApplyQualityStep,
  QUALITY_MIN_STEP_MS,
  QUALITY_POST_ICE_RECOVERY_FREEZE_MS,
} from "@/lib/webrtc/qualityCooldown";

describe("canApplyQualityStep", () => {
  it("blocks rapid step changes within min interval", () => {
    const t0 = 1_000_000;
    expect(canApplyQualityStep(t0 + 5_000, t0, 0)).toBe(false);
    expect(canApplyQualityStep(t0 + QUALITY_MIN_STEP_MS, t0, 0)).toBe(true);
  });

  it("blocks during post-ICE recovery freeze", () => {
    const freezeUntil = 2_000_000;
    expect(canApplyQualityStep(freezeUntil - 1, null, freezeUntil)).toBe(false);
    expect(canApplyQualityStep(freezeUntil, null, freezeUntil)).toBe(true);
  });

  it("allows first change when never changed", () => {
    expect(canApplyQualityStep(100, null, 0)).toBe(true);
  });
});

describe("constants", () => {
  it("keeps cooldown in 12–15s band", () => {
    expect(QUALITY_MIN_STEP_MS).toBeGreaterThanOrEqual(12_000);
    expect(QUALITY_MIN_STEP_MS).toBeLessThanOrEqual(15_000);
  });

  it("post-ICE freeze is 10s", () => {
    expect(QUALITY_POST_ICE_RECOVERY_FREEZE_MS).toBe(10_000);
  });
});
