import { NextResponse } from "next/server";
import { getSignalingSecretForWsToken, isWebrtcConfigured } from "@/lib/env/webrtcConfig";
import { buildWebrtcPublicEnvSnapshot } from "@/lib/webrtcPublicEnvSnapshot";

/**
 * Debug: ce vede serverul (Vercel) pentru WebRTC — fără valori de secrete.
 *
 * `envLayerCompleteForCalls`: true ⇒ env-ul din Vercel pare suficient ca **aplicația** să încerce apelul;
 * **NU** verifică WebSocket VPS, coturn sau firewall (vezi `note` în JSON).
 */
export const dynamic = "force-dynamic";

const SIGNALING_HEALTH_PORT = Number(process.env.SIGNALING_PORT || 4001);

async function signalingHealthOk(): Promise<{ ok: boolean; error: string | null; ms: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 800);
  const started = Date.now();
  try {
    const r = await fetch(`http://127.0.0.1:${SIGNALING_HEALTH_PORT}/health`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const ms = Date.now() - started;
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, ms };
    const text = await r.text();
    if (text.trim() !== "ok") return { ok: false, error: "Unexpected body", ms };
    return { ok: true, error: null, ms };
  } catch (e) {
    clearTimeout(t);
    const ms = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, ms };
  }
}

async function fetchDevRoomSummary(roomId: string | null): Promise<unknown> {
  const base = `http://127.0.0.1:${SIGNALING_HEALTH_PORT}/__align-dev/room-summary`;
  const url = roomId ? `${base}?roomId=${encodeURIComponent(roomId)}` : base;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1200);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
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
  const signalingTokenDev = getSignalingSecretForWsToken();
  const isDev = process.env.NODE_ENV === "development";
  const alignDevLanActive = isDev && process.env.ALIGN_DEV_LAN === "1";
  const alignDevInternetTunnel = isDev && process.env.ALIGN_DEV_INTERNET_TUNNEL === "1";

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");
  const isCallerParam = searchParams.get("isCaller");

  let signalingReachable: boolean | null = null;
  let signalingReachableError: string | null = null;
  let signalingHealthMs: number | null = null;
  let signalingRoomSummary: unknown = null;

  if (isDev) {
    const h = await signalingHealthOk();
    signalingReachable = h.ok;
    signalingReachableError = h.error;
    signalingHealthMs = h.ms;
    if (alignDevLanActive) {
      signalingRoomSummary = await fetchDevRoomSummary(roomId);
    }
  }

  const thisDeviceRole =
    isCallerParam === "true" ? "caller" : isCallerParam === "false" ? "callee" : null;

  return NextResponse.json(
    {
      serverHasSignalingUrl: raw.length > 0,
      signalingUrlHost: host,
      /** Bază WSS publică (aceeași ca NEXT_PUBLIC_*); folosită în browser când bundle-ul nu a primit env la build. */
      signalingWsBaseUrl: raw.length > 0 ? raw : null,
      nextPublicWebRtcEnabledRaw: webRtcFlag ?? null,
      serverIsWebrtcConfigured: isWebrtcConfigured(),
      /** În `next dev`: token WS poate merge doar cu NEXTAUTH_SECRET; ICE cere TURN complet în env. */
      developmentMode: isDev,
      localDevSignalingTokenOk: signalingTokenDev.ok,
      localDevSignalingTokenError: signalingTokenDev.ok ? null : signalingTokenDev.error,
      /** `npm run dev:lan` injectează ALIGN_DEV_LAN=1 + URL-uri LAN pe procesul Next. */
      alignDevLanActive,
      /** `npm run dev:internet` — tuneluri localtunnel + URL-uri HTTPS/WSS injectate. */
      alignDevInternetTunnel,
      /** Doar development: `GET /health` pe procesul de semnalizare local (127.0.0.1:4001). */
      signalingReachable,
      signalingReachableError,
      signalingHealthMs,
      /** Doar când `alignDevLanActive`: rezumat camere de pe serverul de semnalizare (opțional `?roomId=`). */
      signalingRoomSummary,
      /** Din query `?isCaller=true|false` — raportat de clientul care apelează diagnosticul. */
      thisDeviceRole,
      queriedRoomId: roomId,
      ...envSnapshot,
      note:
        "TURN_REQUIRED: iceApiEnvComplete + turnRequiredOk = relay (turn:/turns:), TURN_REALM, TURN_STATIC_SECRET. Apelul real mai cere: semnalizare WSS pe VPS, coturn, firewall, DNS/TLS.",
      hint:
        "Dacă serverHasSignalingUrl e false, variabila nu e pe acest deployment Production. Dacă e true dar apelul tot zice neconfigurat, fă Redeploy (Clear cache) și hard refresh.",
    },
    { headers: { "cache-control": "no-store" } }
  );
}
