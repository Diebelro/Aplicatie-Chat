import { NextResponse } from "next/server";

/**
 * Semnalizarea WebRTC **nu** rulează aici: pe Vercel (serverless) Route Handlers
 * nu pot face upgrade la WebSocket persistent.
 *
 * Setează în browser (Vercel → Env):
 * `NEXT_PUBLIC_SIGNALING_WS_URL` = URL-ul public al procesului Node
 * `server/call-signaling-server.mjs` (path efectiv **`/ws`**, query `?token=`).
 *
 * Producție (recomandat): subdomeniu dedicat + TLS, ex. `wss://ws.diebel.ro/ws`
 * (Nginx/Caddy proxy către `127.0.0.1:SIGNALING_PORT`).
 *
 * Dacă ai **reverse proxy** care mapează `wss://<domeniu>/api/ws` → același backend `/ws`,
 * poți seta `NEXT_PUBLIC_SIGNALING_WS_URL=wss://<domeniu>/api/ws` — dar **nu** pe
 * deployment-ul Vercel standard (fără proxy extern nu există WS la `/api/ws`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const examples: Record<string, string> = {
    productionWss: "wss://ws.diebel.ro/ws",
    note: "În producție folosește wss://; tokenul se pune automat din /api/call/signaling-token.",
  };
  if (process.env.NODE_ENV !== "production") {
    examples.devWs = "ws://127.0.0.1:4001";
  }
  return NextResponse.json(
    {
      ok: true,
      websocketUpgrade: false,
      message:
        "Acest endpoint este HTTP JSON (sanity check). Conexiunile WebSocket WebRTC se deschid către URL-ul din NEXT_PUBLIC_SIGNALING_WS_URL (server/call-signaling-server.mjs, path /ws).",
      requiredEnv: "NEXT_PUBLIC_SIGNALING_WS_URL",
      examples,
      docs: "docs/calls.md",
    },
    { headers: { "cache-control": "no-store" } }
  );
}
