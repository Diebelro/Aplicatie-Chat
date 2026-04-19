/**
 * Rezolvare mesaje eroare apel: `errorCode` din API, apoi stringuri brute cunoscute, apoi raw (diagnostic).
 * `tStr` — ex. din `useCallRoomTranslate()`.
 */
import { VALID_CALL_API_ERROR_CODES } from "@/lib/call/callErrorCodes";

export function stripDevHttpStatusPrefix(message: string): string {
  return message.replace(/^\s*\[\d{3}\]\s*/, "").trim();
}

export type CallErrorPayload = {
  errorCode?: string;
  error?: string;
  message?: string;
};

export type CallErrorInput = string | CallErrorPayload | null | undefined;

const UNKNOWN_I18N = "pages.callRoom.apiErrors.UNKNOWN";

/** Pentru regex-uri `negotiationFail` / `infraHint` — rămâne pe text brut, fără i18n. */
export function callErrorRawForHints(input: CallErrorInput): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  return [input.error, input.message, input.errorCode].filter(Boolean).join(" ");
}

/** Cheie = mesaj normalizat NFKC după strip pe prefix `[status]` (compat server vechi / client). */
const KNOWN_API_ERROR_TO_I18N: Record<string, string> = {
  "Token semnalizare respins.": "pages.callRoom.apiErrors.SIGNALING_TOKEN_INVALID",
  "Neautorizat la token semnalizare — ieși și intră din nou în cont.":
    "pages.callRoom.apiErrors.SIGNALING_TOKEN_INVALID",
  "Semnalizare neconfigurată: pe server pune SIGNALING_TOKEN_SECRET sau NEXTAUTH_SECRET (min 16), același secret ca pe procesul WS; procesul trebuie să ruleze pe NEXT_PUBLIC_SIGNALING_WS_URL.":
    "pages.callRoom.apiErrors.SIGNALING_NOT_CONFIGURED",
  "Utilizator negăsit pentru token semnalizare.": "pages.callRoom.apiErrors.SIGNALING_TOKEN_INVALID",
  "Token semnalizare lipsă.": "pages.callRoom.apiErrors.SIGNALING_TOKEN_INVALID",
  "Neautorizat.": "pages.callRoom.apiErrors.SIGNALING_TOKEN_INVALID",
  "Prea multe cereri.": "pages.callRoom.apiErrors.SIGNALING_SERVICE_UNAVAILABLE",
  "Utilizator negăsit.": "pages.callRoom.apiErrors.UNKNOWN",
  "Semnalizare neconfigurată.": "pages.callRoom.apiErrors.SIGNALING_NOT_CONFIGURED",
  "Unauthorized.": "pages.callRoom.apiErrors.SIGNALING_TOKEN_INVALID",
  "User not found.": "pages.callRoom.apiErrors.UNKNOWN",
  "No incoming call.": "pages.callRoom.apiErrors.UNKNOWN",
  "Nu ai niciun apel în așteptare.": "pages.callRoom.apiErrors.UNKNOWN",
};

function resolveFromKnownString(raw: string, tStr: (path: string) => string): string | null {
  const normalized = stripDevHttpStatusPrefix(raw).normalize("NFKC");
  if (!normalized) return null;
  const i18nPath = KNOWN_API_ERROR_TO_I18N[normalized];
  if (i18nPath) return tStr(i18nPath);
  return null;
}

export function resolveCallDisplayedError(input: CallErrorInput, tStr: (path: string) => string): string {
  if (input == null) return tStr(UNKNOWN_I18N);

  if (typeof input === "object") {
    const code = input.errorCode?.trim();
    if (code && VALID_CALL_API_ERROR_CODES.has(code)) {
      return tStr(`pages.callRoom.apiErrors.${code}`);
    }
    const nested = input.error?.trim() || input.message?.trim();
    if (nested) {
      const fromKnown = resolveFromKnownString(nested, tStr);
      if (fromKnown) return fromKnown;
      return nested;
    }
    return tStr(UNKNOWN_I18N);
  }

  const s = typeof input === "string" ? input.trim() : "";
  if (!s) return tStr(UNKNOWN_I18N);

  const fromKnown = resolveFromKnownString(s, tStr);
  if (fromKnown) return fromKnown;
  return s;
}
