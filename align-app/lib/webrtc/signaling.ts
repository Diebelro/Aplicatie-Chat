/**
 * Client WebSocket pentru semnalizare apel 1-la-1 (mesaje JSON).
 * Server: server/call-signaling-server.mjs — path fix `/ws`.
 */

export function parseSignalingIncoming(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Construiește URL-ul WS final: path `/ws` + `?token=`.
 * Acceptă `wss://ws.diebel.ro`, `wss://ws.diebel.ro/ws` sau `ws://127.0.0.1:4001` (fără dublare `/ws`).
 */
export function signalingWsConnectUrl(baseUrl: string, token: string): string {
  const trimmed = baseUrl.trim();
  const u = new URL(trimmed);
  let path = u.pathname.replace(/\/+$/, "") || "";
  if (!path.endsWith("/ws")) {
    u.pathname = path === "" ? "/ws" : `${path}/ws`;
  } else {
    u.pathname = path;
  }
  u.searchParams.set("token", token);
  return u.toString();
}
