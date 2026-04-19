/** Constrângeri implicite: calitate bună, procesare audio activată. */

export function getAudioConstraints(): MediaTrackConstraints {
  const mobile = isMobileDevice();
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    /**
     * `channelCount: 1` (exact) pe mobil dă des OverconstrainedError cu „Permite” deja acordat —
     * browserul nu poate forța mono pe anumite headset-uri / drivere.
     */
    ...(mobile ? { channelCount: { ideal: 1 } } : { channelCount: { ideal: 2 } }),
  };
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  try {
    const p = navigator.platform;
    const touch = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
    if (touch > 1 && /Mac/i.test(p) && !/iPhone|iPod/.test(ua)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function getVideoConstraints(prefer1080: boolean): MediaTrackConstraints {
  const mobile = isMobileDevice();
  if (mobile) {
    /** Ideal mai modest = mai puține pachete pe 4G/Wi‑Fi slab; max rămâne 720p dacă rețeaua ține. */
    return {
      facingMode: "user",
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      return { stream, cameraUnavailable: false };
    } catch (first) {
      const n = first instanceof DOMException ? first.name : "";
      if (n === "OverconstrainedError" || n === "NotReadableError") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        return { stream, cameraUnavailable: false };
      }
      throw first;
    }
  }
  const mobile = isMobileDevice();
  const prefer1080 = !mobile && typeof window !== "undefined" && window.innerWidth >= 1200;
  const video = getVideoConstraints(prefer1080);

  /** Pe desktop, unele camere / drivere (inclusiv cu Zoom în fundal) pică pe width/height „fixe” — mai întâi lăsăm browserul să aleagă. */
  if (!mobile) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: true });
      return { stream, cameraUnavailable: false };
    } catch {
      /* continuă la profil explicit 720p/1080p */
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    return { stream, cameraUnavailable: false };
  } catch (first) {
    const name = first instanceof DOMException ? first.name : "";

    /** Încercări mai permisive înainte de renunțarea la video — altfel apelul video nici nu pornește. */
    if (
      !audioOnly &&
      (name === "OverconstrainedError" ||
        name === "NotReadableError" ||
        (mobile && (name === "AbortError" || name === "TypeError")))
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio,
          video: { facingMode: "user" },
        });
        return { stream, cameraUnavailable: false };
      } catch {
        /* continuă */
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio, video: true });
        return { stream, cameraUnavailable: false };
      } catch {
        /* continuă */
      }
    }

    const maybeOnlyVideoBlocked =
      name === "NotAllowedError" ||
      name === "NotFoundError" ||
      name === "AbortError" ||
      name === "NotReadableError" ||
      name === "OverconstrainedError" ||
      name === "SecurityError" ||
      name === "TypeError";
    if (!maybeOnlyVideoBlocked) throw first;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      return { stream, cameraUnavailable: true };
    } catch (second) {
      throw second;
    }
  }
}

export function isPageLocalhostForMedia(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

