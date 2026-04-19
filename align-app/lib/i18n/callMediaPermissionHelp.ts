import { isPageLocalhostForMedia } from "@/lib/webrtc/mediaConstraints";

type CallI18nPick = {
  tStr: (path: string) => string;
  tArray: (path: string) => string[];
};

function lines(i18n: CallI18nPick, basePath: string): string[] {
  const got = i18n.tArray(`${basePath}.lines`);
  return got.length ? got : [i18n.tStr(`${basePath}.fallback`)].filter(Boolean);
}

/**
 * Ghid permisiuni media pentru UI-ul de apel — texte din `messages/*` (`pages.callRoom.mediaHelp.*`).
 */
export function formatCallMediaPermissionHelp(err: unknown, i18n: CallI18nPick): { headline: string; lines: string[] } {
  const name = err instanceof DOMException ? err.name : "";
  const p = "pages.callRoom.mediaHelp";

  if (typeof window !== "undefined" && !window.isSecureContext && !isPageLocalhostForMedia()) {
    return {
      headline: i18n.tStr(`${p}.insecureContext.headline`),
      lines: lines(i18n, `${p}.insecureContext`),
    };
  }

  if (name === "SecurityError") {
    return {
      headline: i18n.tStr(`${p}.securityError.headline`),
      lines: lines(i18n, `${p}.securityError`),
    };
  }

  if (name === "OverconstrainedError" || name === "NotReadableError") {
    const onLocal = isPageLocalhostForMedia();
    const base = `${p}.overconstrained`;
    const arr = onLocal ? i18n.tArray(`${base}.linesLocalhost`) : i18n.tArray(`${base}.linesRemote`);
    return {
      headline: i18n.tStr(`${base}.headline`),
      lines: arr.length ? arr : lines(i18n, base),
    };
  }

  if (isPageLocalhostForMedia() && name === "NotFoundError") {
    return {
      headline: i18n.tStr(`${p}.notFoundLocalhost.headline`),
      lines: lines(i18n, `${p}.notFoundLocalhost`),
    };
  }

  if (isPageLocalhostForMedia() && name === "NotAllowedError") {
    return {
      headline: i18n.tStr(`${p}.notAllowedLocalhost.headline`),
      lines: lines(i18n, `${p}.notAllowedLocalhost`),
    };
  }

  if (isPageLocalhostForMedia()) {
    return {
      headline: i18n.tStr(`${p}.localhostGeneric.headline`),
      lines: lines(i18n, `${p}.localhostGeneric`),
    };
  }

  const headlineKey =
    name === "NotAllowedError"
      ? "notAllowedHeadline"
      : name === "NotFoundError"
        ? "notFoundHeadline"
        : "genericHeadline";
  return {
    headline: i18n.tStr(`${p}.default.${headlineKey}`),
    lines: lines(i18n, `${p}.default`),
  };
}
