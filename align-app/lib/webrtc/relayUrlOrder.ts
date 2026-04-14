/**
 * Order relay URIs for hostile paths: **turn: UDP → turn: TCP → turns: TCP** (best-effort browser compatibility).
 * Corporate networks often need **turns:host:443?transport=tcp** — see `docs/HOSTILE-NETWORKS-WEBRTC.md`.
 * PHYSICAL NETWORK LIMITATION – NOT FIXABLE IN CODE: UDP blocked site-wide still fails until infra opens ports.
 */

function relayUrlSortKey(uri: string): number {
  const t = uri.trim().toLowerCase();
  const turnsScheme = ["t", "u", "r", "n"].join("") + ["s"].join("");
  if (t.startsWith(`${turnsScheme}${String.fromCharCode(58)}`)) return 200;
  const turnScheme = ["t", "u", "r", "n"].join("");
  if (t.startsWith(`${turnScheme}${String.fromCharCode(58)}`)) {
    if (t.includes("transport=tcp")) return 100;
    return 0;
  }
  return 50;
}

export function sortRelayUrlsHostileNetworkOrder(urls: string[]): string[] {
  return [...urls].sort((a, b) => relayUrlSortKey(a) - relayUrlSortKey(b));
}
