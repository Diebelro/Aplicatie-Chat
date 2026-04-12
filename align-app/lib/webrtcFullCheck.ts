/**
 * Logică internă pentru GET /api/webrtc-full-check — fără expunere de token sau secrete.
 */

import { findUserOrPrisma } from "@/lib/repo-prisma";
import { getSignalingSecretForWsToken } from "@/lib/env/webrtcConfig";
import { createSignalingToken } from "@/lib/signalingToken";

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

function classifyUrls(urls: unknown): { hasStun: boolean; hasTurn: boolean } {
  let hasStun = false;
  let hasTurn = false;
  if (!Array.isArray(urls)) return { hasStun, hasTurn };
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const lower = u.trim().toLowerCase();
    if (lower.startsWith("stun:")) hasStun = true;
    if (lower.startsWith("turn:") || lower.startsWith("turns:")) hasTurn = true;
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

  let urls: unknown;
  try {
    urls = JSON.parse(process.env.NEXT_PUBLIC_TURN_URLS || "[]");
  } catch {
    return {
      ok: false,
      status: 500,
      error: "TURN_URLS_JSON_INVALID",
      ...emptyIce,
    };
  }

  const realm = process.env.TURN_REALM?.trim();
  const secret = process.env.TURN_STATIC_SECRET?.trim();

  if (!Array.isArray(urls)) {
    return {
      ok: false,
      status: 500,
      error: "TURN_URLS_NOT_ARRAY",
      ...emptyIce,
    };
  }

  const urlList = urls.filter((x): x is string => typeof x === "string");
  const { hasStun, hasTurn } = classifyUrls(urlList);
  const turnReady = urlList.length > 0 && Boolean(realm && secret);

  /** Aliniat cu `/api/call/ice-config`: fără coturn complet → STUN public (apel limitat). */
  if (!turnReady) {
    return {
      ok: true,
      status: 200,
      hasTurn: false,
      hasStun: true,
      iceServerCount: 2,
    };
  }

  if (!hasTurn) {
    return {
      ok: true,
      status: 200,
      hasTurn: false,
      hasStun,
      iceServerCount: Math.max(1, urlList.length),
    };
  }

  return {
    ok: true,
    status: 200,
    hasTurn: true,
    hasStun,
    iceServerCount: Math.max(1, urlList.length),
  };
}
