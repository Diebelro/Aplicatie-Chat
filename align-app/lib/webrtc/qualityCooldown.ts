/** Minimum wall time between automatic quality step changes (degrade/improve). */
export const QUALITY_MIN_STEP_MS = 13_000;

/** After a hostile ICE auto-recovery publishes a restart offer, hold quality adaptation. */
export const QUALITY_POST_ICE_RECOVERY_FREEZE_MS = 10_000;

export function canApplyQualityStep(
  nowMs: number,
  lastQualityChangeAtMs: number | null,
  qualityFrozenUntilMs: number
): boolean {
  if (nowMs < qualityFrozenUntilMs) return false;
  if (lastQualityChangeAtMs == null) return true;
  return nowMs - lastQualityChangeAtMs >= QUALITY_MIN_STEP_MS;
}
