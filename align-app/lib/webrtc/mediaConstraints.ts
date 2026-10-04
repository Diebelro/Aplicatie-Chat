/** Constrângeri implicite: calitate bună, procesare audio activată. */

export function getAudioConstraints(): MediaTrackConstraints {
  const mobile = isMobileDevice();
  const base: MediaTrackConstraints & Record<string, unknown> = {
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
    /**
     * `channelCount: 1` (exact) pe mobil dă des OverconstrainedError cu „Permite” deja acordat —
     * browserul nu poate forța mono pe anumite headset-uri / drivere.
     */
    ...(mobile ? { channelCount: { ideal: 1 } } : { channelCount: { ideal: 2 } }),
  };
  /** Chrome/Android WebView: AEC mai agresiv când e disponibil. */
  if (typeof navigator !== "undefined" && /Chrome/i.test(navigator.userAgent)) {
    base.googEchoCancellation = true;
    base.googNoiseSuppression = true;
    base.googAutoGainControl = true;
    base.googHighpassFilter = true;
  }
  return base;
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
    /**
     * Preferințe, nu max strict — multe telefoane refuză 720p fix (OverconstrainedError).
     * Start mai clar (qHD/HD) + 30fps; adaptarea la semnal slab scade automat rezoluția/bitrate-ul.
     */
    return {
      facingMode: { ideal: "user" },
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
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
  /** Constrângeri video adaptate dispozitivului (mobil = permisiv, desktop = 720p). */
  const video = getVideoConstraints(false);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    return { stream, cameraUnavailable: false };
  } catch (first) {
    const name = first instanceof DOMException ? first.name : "";

    /**
     * Dacă pică combinat audio+video, încercăm mai multe variante ÎNAINTE de a renunța la cameră
     * (valabil ACUM și pe desktop/laptop, nu doar mobil — multe webcam-uri integrate refuză
     * profilul exact dar acceptă unul simplu). Fără asta apelul cade silentios pe audio-only.
     */
    if (!audioOnly) {
      const videoFallbacks: MediaStreamConstraints["video"][] = [
        { facingMode: "user" },
        true,
        { width: { ideal: 640 }, height: { ideal: 480 } },
        { facingMode: "user", width: 320, height: 240 },
      ];
      for (const vf of videoFallbacks) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio, video: vf });
          return { stream, cameraUnavailable: false };
        } catch {
          /* continuă cu următoarea variantă */
        }
      }
      /**
       * Ultima șansă pentru cameră: cere DOAR video (poate constrângerile de microfon stricau
       * cererea combinată), apoi adaugă audio separat dacă merge. Mai bine video fără mic decât deloc.
       */
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
        try {
          const aStream = await navigator.mediaDevices.getUserMedia({ audio });
          aStream.getAudioTracks().forEach((t) => vStream.addTrack(t));
        } catch {
          /* video fără microfon — tot mai bine decât fără cameră */
        }
        return { stream: vStream, cameraUnavailable: false };
      } catch {
        /* camera chiar nu poate fi pornită (permisiune blocată / ocupată / lipsă) */
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

/** Preferință degradare video la start apel — claritate pe mobil, fluiditate pe desktop. */
export function getInitialVideoDegradationPreference(): RTCDegradationPreference {
  return isMobileDevice() ? "balanced" : "maintain-framerate";
}

export function isPageLocalhostForMedia(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

