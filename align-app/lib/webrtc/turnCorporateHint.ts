import { parseNextPublicTurnUrlsStrict, filterRelayUrlsOnly } from "@/lib/webrtc/turnEnv";

/** True if public relay list has no TURNS on port 443 (common corporate egress). */
export function turnUrlsLackTurns443(relayUrls: string[]): boolean {
  const has443Tls = relayUrls.some((u) => {
    const t = u.toLowerCase();
    if (!t.startsWith("turns:")) return false;
    return t.includes(":443") || t.includes("%3a443"); // rare encoded
  });
  return !has443Tls;
}

let lastHintKey = "";

/**
 * One-shot hint when ICE struggles and config looks UDP/TCP-3478-only.
 * Does not change infrastructure; guides operators toward `turns:host:443?transport=tcp`.
 */
export function logTurn443CorporateHintIfApplicable(reason: string): void {
  if (typeof process === "undefined") return;
  const parsed = parseNextPublicTurnUrlsStrict(process.env.NEXT_PUBLIC_TURN_URLS);
  if (!parsed.ok) return;
  const relay = filterRelayUrlsOnly(parsed.urls);
  if (!relay.length) return;
  if (!turnUrlsLackTurns443(relay)) return;
  const key = `${reason}|${relay.join(",")}`;
  if (key === lastHintKey) return;
  lastHintKey = key;
  console.info("[TURN_HINT]", {
    event: "corporate_egress_turns443",
    reason,
    hint:
      "Restrictive networks often block UDP and non-443 TCP. Consider adding turns:your-turn-host:443?transport=tcp (TLS over 443) to NEXT_PUBLIC_TURN_URLS alongside turn:...:3478 — see docs/HOSTILE-NETWORKS-WEBRTC.md.",
  });
}
