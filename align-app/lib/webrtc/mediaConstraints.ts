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

function isPageLocalhostForMedia(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/** Mesaj prietenos după numele erorii getUserMedia (microfon/cameră refuzate). */
export function formatMediaPermissionHelp(err: unknown): { headline: string; lines: string[] } {
  const name = err instanceof DOMException ? err.name : "";

  if (typeof window !== "undefined" && !window.isSecureContext && !isPageLocalhostForMedia()) {
    return {
      headline: "Pagina nu e securizată — fără HTTPS nu poate camera",
      lines: [
        "Pe http:// sau când apare „Not secure”, browserul blochează camera și microfonul. Nu e bug în Align.",
        "Intră pe același site cu https:// și lacăt în bara de adresă, apoi încearcă din nou apelul video.",
        "Dacă ai o „app” pe ecran: șterge iconița, deschide site-ul în browser pe https, apoi adaugă din nou pe ecran.",
      ],
    };
  }

  if (name === "SecurityError") {
    return {
      headline: "Browserul blochează camera sau microfonul (securitate)",
      lines: [
        "Apare des fără https:// sau când site-ul nu are permisiune. Verifică lacătul din adresă.",
        "În Chrome/Edge: lacăt → Permisiuni pentru acest site → Camera și Microfon → Permite.",
        "După schimbare: apasă „Încearcă din nou” sau reia apelul.",
      ],
    };
  }

  if (name === "OverconstrainedError" || name === "NotReadableError") {
    const onLocal = isPageLocalhostForMedia();
    return {
      headline: "Camera sau microfonul sunt ocupate / nu suportă setările cerute",
      lines: [
        "Poate apărea chiar dacă ai apăsat deja „Permite” — nu e mereu un refuz de permisiune.",
        "Închide alte apeluri video, Zoom, Discord sau aplicații care folosesc camera sau microfonul, apoi apasă „Încearcă din nou”.",
        "Pe unele telefoane: repornește pagina după ce ai eliberat camera.",
        onLocal
          ? "Pe http://localhost, mesajul Edge „connection isn’t secure” e despre HTTP; nu înseamnă că lista ta „Microfon: Allowed” e falsă."
          : "Dacă nu ești pe localhost, folosește https:// pentru acest site — altfel browserul poate bloca camera și microfonul.",
      ],
    };
  }

  if (isPageLocalhostForMedia() && name === "NotFoundError") {
    return {
      headline: "Nu s-a găsit microfon sau cameră pe acest PC",
      lines: [
        "În pop-up poate sta „Allowed”, dar sistemul nu expune niciun dispozitiv către browser.",
        "Windows: Setări → Confidențialitate → Microfon → permite accesul pentru aplicații desktop.",
        "În Edge: deschide edge://settings/content/microphone și verifică că microfonul nu e blocat global.",
      ],
    };
  }

  if (isPageLocalhostForMedia() && name === "NotAllowedError") {
    return {
      headline: "Lista zice „Allow”, dar browserul tot refuză microfonul",
      lines: [
        "Pe http://localhost asta NU vine din bannerul roșu „Not secure” — acolo ai voie să ai microfon „Allowed” și în același timp pagina „neprotejată”.",
        "Verifică edge://settings/content/microfon (blocări globale, mod InPrivate, politici firmă).",
        "Încearcă să închizi Teams / Discord / OBS / alte tab-uri cu cameră, apoi „Încearcă din nou”.",
        "Ca test: deschide același URL în Chrome sau într-un profil Edge curat.",
      ],
    };
  }

  if (isPageLocalhostForMedia()) {
    return {
      headline: "Localhost: „Not secure” în Edge ≠ „ți-am blocat microfonul”",
      lines: [
        "La http://localhost:3005 e normal să vezi avertisment de securitate pentru HTTP; totuși Chrome/Edge tratează localhost ca origine unde media API are voie.",
        "Dacă ai Microfon și Camera pe „Allowed” pentru site, următorul pas e să eliberezi dispozitivul: închide alte apeluri sau aplicații care îl folosesc.",
        "Apasă „Încearcă din nou” sau reîncarcă cu Ctrl+F5. Dacă tot nu pornește, notează eroarea din consolă (F12) ca să o putem reproduce.",
        "Test de pe telefon pe același PC: nu folosi http://IP — folosește https pe domeniu sau un tunel (ngrok); pe IP nesecurizat mobilul blochează media.",
      ],
    };
  }

  const headline =
    name === "NotAllowedError"
      ? "Browserul blochează microfonul sau camera"
      : name === "NotFoundError"
        ? "Nu s-a găsit microfon sau cameră"
        : "Nu putem porni microfonul";

  const lines = [
     "Browserul trebuie să permită microfonul și camera pentru acest site (apel 1-la-1 și conferință folosesc aceleași permisiuni).",
    "Desktop: lacăt sau „i” lângă adresă → Microfon și Cameră → „Permite”.",
    "Android (Chrome): meniul site-ului → Permisiuni → Microfon / Cameră.",
    "iPhone (Safari): Setări → Safari → acces microfon / cameră pentru site.",
    "După schimbare: „Încearcă din nou” aici sau reîncepe apelul. Pe producție folosește mereu https://.",
  ];

  return { headline, lines };
}
