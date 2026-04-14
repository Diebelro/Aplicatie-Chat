import { uriIsRelayIce } from "@/lib/webrtc/iceUrlScheme";

export type ParseTurnUrlsError = "EMPTY" | "INVALID_JSON" | "NOT_JSON_ARRAY" | "NON_STRING_ENTRY";

export type ParseTurnUrlsResult =
  | { ok: true; urls: string[] }
  | { ok: false; error: ParseTurnUrlsError };

export function parseNextPublicTurnUrlsStrict(raw: string | undefined): ParseTurnUrlsResult {
  const s = raw?.trim() ?? "";
  if (!s) return { ok: false, error: "EMPTY" };
  if (s.startsWith("[")) {
    try {
      const v = JSON.parse(s) as unknown;
      if (!Array.isArray(v)) return { ok: false, error: "NOT_JSON_ARRAY" };
      for (const item of v) {
        if (item !== null && typeof item !== "string") {
          return { ok: false, error: "NON_STRING_ENTRY" };
        }
      }
      const urls = v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean);
      return { ok: true, urls };
    } catch {
      return { ok: false, error: "INVALID_JSON" };
    }
  }
  const urls = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return { ok: true, urls };
}

export function parseNextPublicTurnUrls(raw: string | undefined): string[] {
  const r = parseNextPublicTurnUrlsStrict(raw);
  return r.ok ? r.urls : [];
}

export function filterRelayUrlsOnly(urls: string[]): string[] {
  return urls.map((u) => u.trim()).filter(uriIsRelayIce);
}

export function turnUrlListHasRelay(urls: string[]): boolean {
  return filterRelayUrlsOnly(urls).length > 0;
}

export function turnUrlsEnvErrorMessage(parsed: ParseTurnUrlsResult): string | null {
  if (parsed.ok) return null;
  switch (parsed.error) {
    case "EMPTY":
      return "TURN_REQUIRED: NEXT_PUBLIC_TURN_URLS is empty or missing.";
    case "INVALID_JSON":
      return "TURN_REQUIRED: NEXT_PUBLIC_TURN_URLS is not valid JSON.";
    case "NOT_JSON_ARRAY":
      return "TURN_REQUIRED: NEXT_PUBLIC_TURN_URLS must be a JSON array of URI strings when it starts with '['.";
    case "NON_STRING_ENTRY":
      return "TURN_REQUIRED: NEXT_PUBLIC_TURN_URLS JSON array must contain only strings.";
    default:
      return "TURN_REQUIRED: NEXT_PUBLIC_TURN_URLS is invalid.";
  }
}

export type TurnUrlsIceValidation =
  | { ok: true; relayUrls: string[] }
  | { ok: false; error: string };

export function validateTurnUrlsForIceConfig(raw: string | undefined): TurnUrlsIceValidation {
  const parsed = parseNextPublicTurnUrlsStrict(raw);
  if (!parsed.ok) {
    return { ok: false, error: turnUrlsEnvErrorMessage(parsed)! };
  }
  const relayUrls = filterRelayUrlsOnly(parsed.urls);
  if (!relayUrls.length) {
    return {
      ok: false,
      error:
        "TURN_REQUIRED: NEXT_PUBLIC_TURN_URLS must include at least one relay URI (turn or turns scheme); discovery-only lists are rejected.",
    };
  }
  return { ok: true, relayUrls };
}
