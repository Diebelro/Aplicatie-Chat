/** Deschide un link Diebel (ads / transfer / anunțuri) din browser sau din app-ul Android. */

declare global {
  interface Window {
    DiebelNative?: {
      openExternal?: (url: string) => void;
      setCallChrome?: (isCall: boolean) => void;
    };
  }
}

export function safeDiebelUrl(raw: string | null | undefined, fallback = "https://ads.diebel.ro/campanie/nou") {
  const value = String(raw || "").trim();
  if (!value) return fallback;
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(value, "https://ads.diebel.ro");
    if (url.protocol !== "https:") return fallback;
    const host = url.hostname.toLowerCase();
    if (host !== "diebel.ro" && !host.endsWith(".diebel.ro")) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function isDiebelAndroidApp() {
  if (typeof navigator === "undefined") return false;
  return /DiebelAndroid/i.test(navigator.userAgent || "");
}

/** Intent URL pe care WebView-ul Android îl trimite la browser (fără a încărca ads în WebView). */
function androidIntentUrl(href: string) {
  const u = new URL(href);
  const fallback = encodeURIComponent(href);
  return (
    `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
    `#Intent;scheme=https;action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${fallback};end`
  );
}

export function openDiebelExternal(raw: string | null | undefined) {
  const href = safeDiebelUrl(raw);

  const native = typeof window !== "undefined" ? window.DiebelNative : undefined;
  if (native && typeof native.openExternal === "function") {
    try {
      native.openExternal(href);
      return;
    } catch {
      /* fallback mai jos */
    }
  }

  if (isDiebelAndroidApp()) {
    try {
      window.location.assign(androidIntentUrl(href));
      return;
    } catch {
      /* fallback */
    }
  }

  try {
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    if (opened) return;
  } catch {
    /* WebView poate bloca window.open */
  }

  // Pe app Android, navigarea https directă e blocată; intent-ul e preferat.
  // Pe web normal, assign e suficient.
  window.location.assign(href);
}
