/**
 * După conexiune stabilă: limite rezonabile pe sender video (fără crash dacă API lipsește).
 * Complementar la `setMaxBitrate` / adaptare calitate existentă.
 */
const DEFAULT_MAX_BITRATE_BPS = 2_200_000;

export async function applyProCallVideoSenderCaps(pc: RTCPeerConnection): Promise<void> {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (!sender) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    const encodings = params.encodings.map((enc, i) => {
      if (i !== 0) return { ...enc };
      return {
        ...enc,
        maxBitrate: enc.maxBitrate ?? DEFAULT_MAX_BITRATE_BPS,
        maxFramerate: 30,
      } as RTCRtpEncodingParameters;
    });
    await sender.setParameters({ ...params, encodings });
  } catch {
    /* Safari / browsere vechi pot respinge câmpuri */
  }
}

export async function applyProCallVideoSenderCapsAll(pcs: RTCPeerConnection[]): Promise<void> {
  for (const pc of pcs) {
    await applyProCallVideoSenderCaps(pc);
  }
}
