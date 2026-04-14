/** Maps /api/call/ice-config failures to user-visible messages (always TURN-scoped for config errors). */
export function iceConfigFetchErrorMessage(status: number, apiError: string | undefined): string {
  const t = apiError?.trim();
  if (status === 401) {
    return t && t.length > 0 ? t : "Trebuie să fii autentificat pentru ICE/TURN.";
  }
  if (t && t.includes("TURN_REQUIRED")) return t;
  if (t && t.length > 0) return `TURN_REQUIRED: ${t}`;
  return "TURN_REQUIRED: ICE configuration rejected by server (set TURN_REALM, TURN_STATIC_SECRET, NEXT_PUBLIC_TURN_URLS with turn:/turns: on Vercel or .env.local).";
}

export const ICE_EMPTY_AFTER_PARSE =
  "TURN_REQUIRED: ice-config returned no usable TURN relay servers (missing username, credential, or relay-only URLs).";
