const STEPS: Array<{ maxW: number; maxH: number }> = [
  { maxW: 1920, maxH: 1080 },
  { maxW: 1280, maxH: 720 },
  { maxW: 960, maxH: 540 },
  { maxW: 640, maxH: 360 },
  { maxW: 480, maxH: 270 },
];

export function clampDownscaleStep(step: number): number {
  return Math.max(0, Math.min(STEPS.length - 1, step));
}

export async function applyLocalVideoSendDownscale(
  track: MediaStreamTrack,
  degradedSteps: number
): Promise<void> {
  if (track.kind !== "video") return;
  const idx = clampDownscaleStep(degradedSteps);
  const { maxW, maxH } = STEPS[idx]!;
  try {
    await track.applyConstraints({
      width: { max: maxW },
      height: { max: maxH },
      frameRate: { max: idx >= 3 ? 24 : 30 },
    });
  } catch {
    /* ignore */
  }
}
