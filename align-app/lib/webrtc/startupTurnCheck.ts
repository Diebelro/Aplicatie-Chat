import { validateTurnUrlsForIceConfig } from "@/lib/webrtc/turnEnv";

export type TurnStartupCheckResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Server-side env self-check (no DB, no request). REQUIRES MANUAL INFRA TEST (VPS / FIREWALL / 4G)
 * for live coturn, DNS, TLS, and relay path verification.
 */
export function runTurnEnvStartupCheck(): TurnStartupCheckResult {
  const errors: string[] = [];
  if (!process.env.TURN_REALM?.trim()) {
    errors.push("TURN_REQUIRED: TURN_REALM is missing.");
  }
  if (!process.env.TURN_STATIC_SECRET?.trim()) {
    errors.push("TURN_REQUIRED: TURN_STATIC_SECRET is missing.");
  }
  const urls = validateTurnUrlsForIceConfig(process.env.NEXT_PUBLIC_TURN_URLS);
  if (!urls.ok) {
    errors.push(urls.error);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
