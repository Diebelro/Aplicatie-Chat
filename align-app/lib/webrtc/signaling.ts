/**
 * Client WebSocket pentru semnalizare apel 1-la-1 (mesaje JSON).
 *
 * Server: `align-app/server/call-signaling-server.mjs` — HTTP + `WebSocketServer` pe path **`/ws`**
 * (nu Next.js). Token: query `?token=` (JWT-like HMAC din `GET /api/call/signaling-token`).
 *
 * Env client: **`NEXT_PUBLIC_SIGNALING_WS_URL`**
 * - Dev: `ws://127.0.0.1:4001` → devine `ws://127.0.0.1:4001/ws?token=...`
 * - Prod: `wss://<host>/ws` sau bază fără path (se adaugă `/ws`). Folosește **wss://** în producție.
 * - Pe Vercel fără proxy: setează host-ul unde rulează `npm run signaling` / systemd (ex. `wss://ws.diebel.ro/ws`).
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
