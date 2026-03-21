import { NextResponse } from "next/server";
import { isWebrtcConfigured } from "@/lib/env/webrtcConfig";

/**
 * Debug: ce vede serverul (Vercel) pentru WebRTC public env.
 * Dacă `serverHasSignalingUrl` e true dar în apel tot vezi „WebRTC nu e configurat”,
 * clientul folosește un build vechi → Redeploy + golire cache.
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
  return NextResponse.json(
    {
      serverHasSignalingUrl: raw.length > 0,
      signalingUrlHost: host,
      nextPublicWebRtcEnabledRaw: webRtcFlag ?? null,
      serverIsWebrtcConfigured: isWebrtcConfigured(),
      hint:
        "Dacă serverHasSignalingUrl e false, variabila nu e pe acest deployment Production. Dacă e true dar apelul tot zice neconfigurat, fă Redeploy (Clear cache) și hard refresh.",
    },
    { headers: { "cache-control": "no-store" } }
  );
}
