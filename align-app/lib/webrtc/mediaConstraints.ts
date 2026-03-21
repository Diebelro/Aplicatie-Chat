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
      ? "Acces refuzat la microfon sau cameră"
      : name === "NotFoundError"
        ? "Nu s-a găsit microfon sau cameră"
        : "Nu putem folosi microfonul";

  const lines = [
    "Apasă pe iconița de lacăt sau „i” în bara de adresă a browserului și setează Microfon (și Camera, dacă e apel video) la „Permite”.",
    "Pe Android (Chrome): meniul site-ului → Permisiuni → Microfon / Cameră.",
    "Pe iPhone (Safari): Setări → Safari → Microfon / Cameră și verifică acest site.",
    "După ce permiți, închide apelul și intră din nou — nu e nevoie de mesaj roșu, e doar o setare a telefonului sau browserului.",
  ];

  return { headline, lines };
}
