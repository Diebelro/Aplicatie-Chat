/**
 * Logică internă pentru GET /api/webrtc-full-check — fără expunere de token sau secrete.
 */

import { findUserOrPrisma } from "@/lib/repo-prisma";
import { getSignalingSecretForWsToken } from "@/lib/env/webrtcConfig";
import { createSignalingToken } from "@/lib/signalingToken";
import { iceUrlScheme, isNonRelayIceScheme } from "@/lib/webrtc/iceUrlScheme";
import {
  parseNextPublicTurnUrlsStrict,
  validateTurnUrlsForIceConfig,
} from "@/lib/webrtc/turnEnv";

const SIGNALING_TOKEN_TTL_MS = 10 * 60 * 1000;

export function getTurnSecretsPresence(): {
  turnStaticSecretSet: boolean;
  turnAuthSecretSet: boolean;
  secretsConsistent: boolean;
} {
  const turnStaticSecretSet = !!process.env.TURN_STATIC_SECRET?.trim();
  const turnAuthSecretSet = !!process.env.TURN_AUTH_SECRET?.trim();
  return {
    turnStaticSecretSet,
    turnAuthSecretSet,
    secretsConsistent: turnStaticSecretSet && turnAuthSecretSet,
  };
}

function classifyUrls(urls: string[]): { hasStun: boolean; hasTurn: boolean } {
  let hasStun = false;
  let hasTurn = false;
  for (const u of urls) {
    const sch = iceUrlScheme(u);
    if (isNonRelayIceScheme(sch)) hasStun = true;
    if (sch === "turn" || sch === "turns") hasTurn = true;
  }
  return { hasStun, hasTurn };
}

export type SignalingTokenCheckResult =
  | { ok: true; status: 200 }
  | { ok: false; status: number; error: string };

export async function runSignalingTokenForCheck(userId: string): Promise<SignalingTokenCheckResult> {
  const user = await findUserOrPrisma(userId);
  if (!user) {
    return { ok: false, status: 404, error: "USER_NOT_FOUND" };
  }

  const secrets = getSignalingSecretForWsToken();
  if (!secrets.ok) {
    return {
      ok: false,
      status: 503,
      error: secrets.error || "SIGNALING_SECRETS_MISSING",
    };
  }

  const token = createSignalingToken(userId, secrets.signalingSecret, SIGNALING_TOKEN_TTL_MS);
  if (!token || typeof token !== "string" || token.length < 8) {
    return { ok: false, status: 500, error: "TOKEN_GENERATION_FAILED" };
  }

  return { ok: true, status: 200 };
}

export type IceConfigCheckResult =
  | {
      ok: true;
      status: 200;
      hasTurn: boolean;
      hasStun: boolean;
      iceServerCount: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
      hasTurn: boolean;
      hasStun: boolean;
      iceServerCount: number;
    };

export async function runIceConfigForCheck(userId: string): Promise<IceConfigCheckResult> {
  const emptyIce = {
    hasTurn: false as boolean,
    hasStun: false as boolean,
    iceServerCount: 0,
  };

  const user = await findUserOrPrisma(userId);
  if (!user) {
    return {
      ok: false,
      status: 404,
      error: "USER_NOT_FOUND",
      ...emptyIce,
    };
  }

  const parsed = parseNextPublicTurnUrlsStrict(process.env.NEXT_PUBLIC_TURN_URLS);
  const urlList = parsed.ok ? parsed.urls : [];
  const { hasStun } = classifyUrls(urlList);

  const realm = process.env.TURN_REALM?.trim();
  const secret = process.env.TURN_STATIC_SECRET?.trim();

  if (!realm) {
    return {
      ok: false,
      status: 500,
      error: "TURN_REQUIRED: TURN_REALM is missing.",
      hasTurn: false,
      hasStun,
      iceServerCount: 0,
    };
  }
  if (!secret) {
    return {
      ok: false,
      status: 500,
      error: "TURN_REQUIRED: TURN_STATIC_SECRET is missing.",
      hasTurn: false,
      hasStun,
      iceServerCount: 0,
    };
  }

  const urlsV = validateTurnUrlsForIceConfig(process.env.NEXT_PUBLIC_TURN_URLS);
  if (!urlsV.ok) {
    return {
      ok: false,
      status: 500,
      error: urlsV.error,
      hasTurn: false,
      hasStun,
      iceServerCount: 0,
    };
  }

  return {
    ok: true,
    status: 200,
    hasTurn: true,
    hasStun,
    iceServerCount: 1,
  };
}
