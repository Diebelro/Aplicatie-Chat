import { NextResponse } from "next/server";
import { getPublicSignalingWsBaseUrl } from "@/lib/env/webrtcConfig";

/**
 * Config publică pentru clienți nativi (Android / iOS): aceleași surse ca web-ul,
 * fără secrete. Folosește la verificare / documentație; în producție aliniază
 * build-ul nativ cu valorile de aici.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const apiBase = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  const signalingWsBase = (getPublicSignalingWsBaseUrl() ?? "").trim();

  return NextResponse.json(
    {
      apiBase: apiBase || null,
      signalingWsBase: signalingWsBase || null,
      webConfigured: Boolean(apiBase && signalingWsBase),
      hint:
        "Producție VPS: REST → apiBase (chat.diebel.ro), WebSocket apel → signalingWsBase (ws.diebel.ro/ws). Nu folosi *.vercel.app.",
    },
    { headers: { "cache-control": "no-store" } }
  );
}
