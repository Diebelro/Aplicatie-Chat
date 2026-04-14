/** Matches downscale steps 0..4 — never shrink encodings[] length. */
const SCALE_RESOLUTION_DOWN_BY: number[] = [1, 1.33, 2, 3, 3];

export function scaleDownByForStep(degradedSteps: number): number {
  const i = Math.max(0, Math.min(SCALE_RESOLUTION_DOWN_BY.length - 1, degradedSteps));
  return SCALE_RESOLUTION_DOWN_BY[i] ?? 1;
}

function videoSender(pc: RTCPeerConnection): RTCRtpSender | null {
  for (const s of pc.getSenders()) {
    if (s.track?.kind === "video") return s;
  }
  return null;
}

export async function applyVideoSenderScaleAndBitrate(
  pc: RTCPeerConnection,
  degradedSteps: number,
  maxVideoBps: number
): Promise<boolean> {
  const sender = videoSender(pc);
  if (!sender) return false;
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    const scale = scaleDownByForStep(degradedSteps);
    const encodings = params.encodings.map((enc, i) => {
      if (i !== 0) return { ...enc };
      return {
        ...enc,
        maxBitrate: maxVideoBps,
        scaleResolutionDownBy: scale,
      } as RTCRtpEncodingParameters;
    });
    await sender.setParameters({ ...params, encodings });
    return true;
  } catch {
    return false;
  }
}

export async function applyVideoDegradationPreferenceSafe(
  pc: RTCPeerConnection,
  preference: "balanced" | "maintain-framerate"
): Promise<void> {
  const sender = videoSender(pc);
  if (!sender) return;
  try {
    const params = sender.getParameters();
    const next = { ...params, degradationPreference: preference } as RTCRtpSendParameters & {
      degradationPreference?: RTCDegradationPreference;
    };
    await sender.setParameters(next);
  } catch {
    /* Safari may reject unknown fields */
  }
}
