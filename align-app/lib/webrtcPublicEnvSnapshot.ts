/**
 * Snapshot public (fără secrete) pentru `/api/webrtc-env-check`.
 * Orice `true` aici e doar stratul Vercel — nu înseamnă că VPS/coturn rulează.
 */

import { getSignalingSecretForWsToken } from "@/lib/env/webrtcConfig";
import { iceUrlScheme, isNonRelayIceScheme } from "@/lib/webrtc/iceUrlScheme";
import {
  parseNextPublicTurnUrlsStrict,
  validateTurnUrlsForIceConfig,
} from "@/lib/webrtc/turnEnv";

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
  iceApiEnvComplete: boolean;
  envLayerCompleteForCalls: boolean;
  turnRequiredOk: boolean;
  turnRequiredError: string | null;
};

export function buildWebrtcPublicEnvSnapshot(): WebrtcPublicEnvSnapshot {
  const parsed = parseNextPublicTurnUrlsStrict(process.env.NEXT_PUBLIC_TURN_URLS);
  const urlList = parsed.ok ? parsed.urls : [];
  let turnUrlsHasStun = false;
  let turnUrlsHasTurn = false;
  for (const u of urlList) {
    const sch = iceUrlScheme(u);
    if (isNonRelayIceScheme(sch)) turnUrlsHasStun = true;
    if (sch === "turn" || sch === "turns") turnUrlsHasTurn = true;
  }

  const turnRealmSet = !!process.env.TURN_REALM?.trim();
  const turnStaticSecretSet = !!process.env.TURN_STATIC_SECRET?.trim();
  const turnAuthSecretSet = !!process.env.TURN_AUTH_SECRET?.trim();

  const tokenSecrets = getSignalingSecretForWsToken();
  const signalingSecretsOk = tokenSecrets.ok;
  const signalingSecretsError = tokenSecrets.ok ? null : tokenSecrets.error;

  const urlsV = validateTurnUrlsForIceConfig(process.env.NEXT_PUBLIC_TURN_URLS);
  const nextPublicTurnUrlsParseOk = parsed.ok && urlList.length > 0;
  const nextPublicTurnUrlCount = urlsV.ok ? urlsV.relayUrls.length : 0;

  const turnRequiredError = (() => {
    if (!urlsV.ok) return urlsV.error;
    if (!turnRealmSet) return "TURN_REQUIRED: TURN_REALM is missing.";
    if (!turnStaticSecretSet) return "TURN_REQUIRED: TURN_STATIC_SECRET is missing.";
    return null;
  })();
  const turnRequiredOk = turnRequiredError === null;

  const iceApiEnvComplete = turnRequiredOk;

  const envLayerCompleteForCalls =
    !!process.env.NEXT_PUBLIC_SIGNALING_WS_URL?.trim() &&
    signalingSecretsOk &&
    iceApiEnvComplete;

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
    turnRequiredOk,
    turnRequiredError,
  };
}
