/**
 * Snapshot public (fără secrete) pentru `/api/webrtc-env-check`.
 * Orice `true` aici e doar stratul Vercel — nu înseamnă că VPS/coturn rulează.
 */

import { getSignalingSecretForWsToken } from "@/lib/env/webrtcConfig";

export type WebrtcPublicEnvSnapshot = {
  nextPublicTurnUrlsParseOk: boolean;
  nextPublicTurnUrlCount: number;
  turnUrlsHasStun: boolean;
  turnUrlsHasTurn: boolean;
  turnRealmSet: boolean;
  turnStaticSecretSet: boolean;
  turnAuthSecretSet: boolean;
  signalingSecretsOk: boolean;
  signalingSecretsError: string | null;
  /** Minim pentru ca `GET /api/call/ice-config` să poată răspunde 200 (fără a testa coturn live). */
  iceApiEnvComplete: boolean;
  /**
   * true dacă env-ul public + secretele obligatorii par complete pentru un apel.
   * Nu include: WebSocket VPS, coturn pornit, firewall.
   */
  envLayerCompleteForCalls: boolean;
};

export function buildWebrtcPublicEnvSnapshot(): WebrtcPublicEnvSnapshot {
  let nextPublicTurnUrlsParseOk = false;
  let nextPublicTurnUrlCount = 0;
  let turnUrlsHasStun = false;
  let turnUrlsHasTurn = false;

  try {
    const raw = process.env.NEXT_PUBLIC_TURN_URLS || "[]";
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      nextPublicTurnUrlsParseOk = true;
      nextPublicTurnUrlCount = arr.length;
      for (const u of arr) {
        if (typeof u !== "string") continue;
        const l = u.trim().toLowerCase();
        if (l.startsWith("stun:")) turnUrlsHasStun = true;
        if (l.startsWith("turn:") || l.startsWith("turns:")) turnUrlsHasTurn = true;
      }
    }
  } catch {
    nextPublicTurnUrlsParseOk = false;
  }

  const turnRealmSet = !!process.env.TURN_REALM?.trim();
  const turnStaticSecretSet = !!process.env.TURN_STATIC_SECRET?.trim();
  const turnAuthSecretSet = !!process.env.TURN_AUTH_SECRET?.trim();

  const tokenSecrets = getSignalingSecretForWsToken();
  const signalingSecretsOk = tokenSecrets.ok;
  const signalingSecretsError = tokenSecrets.ok ? null : tokenSecrets.error;

  /** Coturn complet (relay). Fără asta, `/api/call/ice-config` tot răspunde 200 cu STUN public (fallback). */
  const fullTurnIce =
    nextPublicTurnUrlsParseOk &&
    nextPublicTurnUrlCount > 0 &&
    turnUrlsHasTurn &&
    turnRealmSet &&
    turnStaticSecretSet;

  const iceApiEnvComplete = fullTurnIce;

  /** Minim pentru încercare apel: URL semnalizare + secret WS (NEXTAUTH / SIGNALING); ICE poate fi doar STUN. */
  const envLayerCompleteForCalls =
    !!process.env.NEXT_PUBLIC_SIGNALING_WS_URL?.trim() &&
    signalingSecretsOk &&
    nextPublicTurnUrlsParseOk;

  return {
    nextPublicTurnUrlsParseOk,
    nextPublicTurnUrlCount,
    turnUrlsHasStun,
    turnUrlsHasTurn,
    turnRealmSet,
    turnStaticSecretSet,
    turnAuthSecretSet,
    signalingSecretsOk,
    signalingSecretsError,
    iceApiEnvComplete,
    envLayerCompleteForCalls,
  };
}
