/**
 * Runtime invariants for TURN-only ICE. REQUIRES MANUAL INFRA TEST (VPS / FIREWALL / 4G):
 * relay candidates and cross-network calls cannot be asserted in CI alone.
 */

import { uriIsRelayIce } from "@/lib/webrtc/iceUrlScheme";

export function findNonRelayUrlsInList(urls: string[]): string[] {
  return urls.filter((u) => !uriIsRelayIce(u));
}
