/** Constrângeri implicite: calitate bună, procesare audio activată. */

export function getAudioConstraints(): MediaTrackConstraints {
  const mobile = isMobileDevice();
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    /** Mono pe mobil = ~jumătate din bandă audio, mai stabil pe rețea slabă (voce). */
    channelCount: mobile ? 1 : 2,
  };
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function getVideoConstraints(prefer1080: boolean): MediaTrackConstraints {
  const mobile = isMobileDevice();
  if (mobile) {
    /** Ideal mai modest = mai puține pachete pe 4G/Wi‑Fi slab; max rămâne 720p dacă rețeaua ține. */
    return {
      width: { ideal: 960, max: 1280 },
      height: { ideal: 540, max: 720 },
      frameRate: { ideal: 24, max: 30 },
    };
  }
  if (prefer1080) {
    return {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
    };
  }
  return {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 },
  };
}

export async function getCallMediaStream(audioOnly: boolean): Promise<MediaStream> {
  const r = await acquireCallMediaStream(audioOnly);
  return r.stream;
}

export type AcquireCallMediaResult = {
  stream: MediaStream;
  /** Camera indisponibilă / refuzată — apelul poate continua doar cu voce */
  cameraUnavailable: boolean;
};

/**
 * Încearcă video+audio; dacă pică doar partea de cameră (sau întregul bundle), încearcă doar microfon.
 * Nu aruncă pentru „doar cameră blocată” dacă microfonul merge.
 */
export async function acquireCallMediaStream(audioOnly: boolean): Promise<AcquireCallMediaResult> {
  const audio = getAudioConstraints();
  if (audioOnly) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    return { stream, cameraUnavailable: false };
  }
  const prefer1080 = !isMobileDevice() && typeof window !== "undefined" && window.innerWidth >= 1200;
  const video = getVideoConstraints(prefer1080);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    return { stream, cameraUnavailable: false };
  } catch (first) {
    const name = first instanceof DOMException ? first.name : "";
    const maybeOnlyVideoBlocked =
      name === "NotAllowedError" ||
      name === "NotFoundError" ||
      name === "AbortError" ||
      name === "NotReadableError" ||
      name === "OverconstrainedError" ||
      name === "SecurityError";
    if (!maybeOnlyVideoBlocked) throw first;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      return { stream, cameraUnavailable: true };
    } catch (second) {
      throw second;
    }
  }
}

/** Mesaj prietenos după numele erorii getUserMedia (microfon/cameră refuzate). */
export function formatMediaPermissionHelp(err: unknown): { headline: string; lines: string[] } {
  const name = err instanceof DOMException ? err.name : "";
  const headline =
    name === "NotAllowedError"
      ? "Browserul blochează microfonul sau camera"
      : name === "NotFoundError"
        ? "Nu s-a găsit microfon sau cameră"
        : "Nu putem porni microfonul";

  const lines = [
    "Nu e o eroare în Align — Chrome, Safari sau telefonul trebuie să îți permită accesul. E același lucru la apel 1-la-1 și la conferință: o singură dată permis pentru site, apoi merge peste tot aici.",
    "Desktop: iconița de lacăt sau „i” lângă adresa site-ului → Microfon și Camera → „Permite”.",
    "Android (Chrome): meniul site-ului → Permisiuni → Microfon / Cameră.",
    "iPhone (Safari): Setări → Safari → Microfon / Cameră pentru acest site.",
    "După ce modifici permisiunile: închide fereastra de apel și intră din nou (sau reîmprospătează pagina), apoi Acceptă din nou.",
  ];

  return { headline, lines };
}
