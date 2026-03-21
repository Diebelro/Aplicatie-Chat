/**
 * Ieșire audio Web: browserul/OS decid adesea implicit difuzorul pe mobil.
 * Unde există setSinkId + dispozitive listate, putem comuta la „difuzor” la cerere.
 */

export function supportsAudioOutputSelection(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof HTMLAudioElement !== "undefined" &&
    "setSinkId" in HTMLAudioElement.prototype
  );
}

/** Gol = implicit browser (uneori apropiat de „telefon”, depinde de OS). */
export const DEFAULT_AUDIO_SINK = "";

export async function listAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === "audiooutput");
  } catch {
    return [];
  }
}

/** Heuristic: difuzor / speaker; dacă etichetele lipsesc dar sunt 2+ ieșiri, a doua e adesea difuzorul. */
export function pickSpeakerLikeSinkId(devices: MediaDeviceInfo[]): string | undefined {
  if (devices.length === 0) return undefined;
  const speakerish = devices.find((d) =>
    /speaker|difuzor|loud|extern|hdmi|display|built[-\s]?in/i.test(d.label)
  );
  if (speakerish) return speakerish.deviceId;
  if (devices.length >= 2) return devices[1]?.deviceId;
  return undefined;
}

export async function applyAudioSinkId(el: HTMLMediaElement | null, sinkId: string): Promise<void> {
  if (!el || !supportsAudioOutputSelection()) return;
  try {
    await (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
  } catch {
    /* permisiuni / dispozitiv invalid */
  }
}
