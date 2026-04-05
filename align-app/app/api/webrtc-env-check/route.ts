import { NextResponse } from "next/server";
import { isWebrtcConfigured } from "@/lib/env/webrtcConfig";
import { buildWebrtcPublicEnvSnapshot } from "@/lib/webrtcPublicEnvSnapshot";

/**
 * Debug: ce vede serverul (Vercel) pentru WebRTC — fără valori de secrete.
 *
 * `envLayerCompleteForCalls`: true ⇒ env-ul din Vercel pare suficient ca **aplicația** să încerce apelul;
 * **NU** verifică WebSocket VPS, coturn sau firewall (vezi `note` în JSON).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const raw = process.env.NEXT_PUBLIC_SIGNALING_WS_URL?.trim() ?? "";
  const webRtcFlag = process.env.NEXT_PUBLIC_WEBRTC_ENABLED;
  let host: string | null = null;
  if (raw) {
    try {
      host = new URL(raw).host;
    } catch {
      host = "invalid-url";
    }
  }

  const envSnapshot = buildWebrtcPublicEnvSnapshot();

  return NextResponse.json(
    {
      serverHasSignalingUrl: raw.length > 0,
      signalingUrlHost: host,
      /** Bază WSS publică (aceeași ca NEXT_PUBLIC_*); folosită în browser când bundle-ul nu a primit env la build. */
      signalingWsBaseUrl: raw.length > 0 ? raw : null,
      nextPublicWebRtcEnabledRaw: webRtcFlag ?? null,
      serverIsWebrtcConfigured: isWebrtcConfigured(),
      ...envSnapshot,
      note:
        "envLayerCompleteForCalls verifică doar variabile pe Vercel. Apelul real mai cere: proces semnalizare pe VPS (wss), coturn pornit, porturi/firewall, DNS/TLS corecte.",
      hint:
        "Dacă serverHasSignalingUrl e false, variabila nu e pe acest deployment Production. Dacă e true dar apelul tot zice neconfigurat, fă Redeploy (Clear cache) și hard refresh.",
    },
    { headers: { "cache-control": "no-store" } }
  );
}
