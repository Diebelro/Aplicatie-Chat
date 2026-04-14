import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { rateLimitAllow } from "@/lib/callRateLimit";
import {
  getTurnSecretsPresence,
  runIceConfigForCheck,
  runSignalingTokenForCheck,
} from "@/lib/webrtcFullCheck";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;

/**
 * Agregator verificări WebRTC (Vercel / Next) — necesită sesiune validă.
 * Pentru verdict unic „app gata pentru VPS”, folosește GET /api/webrtc-ready-check.
 * NU returnează token WS sau credențiale; NU loghează secrete.
 */
export async function GET(request: NextRequest) {
  const steps = {
    auth: false,
    signalingToken: false,
    iceConfig: false,
    secretsConsistent: false,
  };

  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        step: "auth",
        error: "NOT_AUTHENTICATED",
        steps,
        summary: "FAILED_AT_AUTH",
      },
      { status: 401 }
    );
  }

  steps.auth = true;

  if (!rateLimitAllow(`wrtcfc:${userId}`, RATE_MAX, RATE_WINDOW_MS)) {
    return NextResponse.json(
      {
        ok: false,
        step: "rate-limit",
        error: "RATE_LIMITED",
        steps,
        summary: "FAILED_AT_RATE_LIMIT",
      },
      { status: 429, headers: { "cache-control": "no-store" } }
    );
  }

  const secretPresence = getTurnSecretsPresence();
  steps.secretsConsistent = secretPresence.secretsConsistent;

  const sigResult = await runSignalingTokenForCheck(userId);
  steps.signalingToken = sigResult.ok;

  const iceResult = await runIceConfigForCheck(userId);
  steps.iceConfig = iceResult.ok;

  const details = {
    turnStaticSecretSet: secretPresence.turnStaticSecretSet,
    turnAuthSecretSet: secretPresence.turnAuthSecretSet,
    signalingStatus: sigResult.ok ? 200 : sigResult.status,
    iceStatus: iceResult.ok ? 200 : iceResult.status,
    hasTurn: iceResult.hasTurn,
    hasStun: iceResult.hasStun,
    iceServerCount: iceResult.iceServerCount,
  };

  const ok =
    steps.auth &&
    steps.signalingToken &&
    steps.iceConfig &&
    steps.secretsConsistent;

  if (!ok) {
    let step: string;
    let error: string;

    if (!steps.signalingToken) {
      step = "signaling-token";
      error = "error" in sigResult && !sigResult.ok ? sigResult.error : "SIGNALING_CHECK_FAILED";
    } else if (!steps.iceConfig) {
      step = "ice-config";
      error = !iceResult.ok ? iceResult.error : "ICE_CHECK_FAILED";
    } else if (!steps.secretsConsistent) {
      step = "secrets";
      error = "TURN_SECRETS_INCONSISTENT";
    } else {
      step = "unknown";
      error = "CHECK_FAILED";
    }

    const summary =
      step === "signaling-token"
        ? "FAILED_AT_SIGNALING_TOKEN"
        : step === "ice-config"
          ? "FAILED_AT_ICE_CONFIG"
          : step === "secrets"
            ? "FAILED_AT_SECRETS"
            : "FAILED_AT_UNKNOWN";

    return NextResponse.json(
      {
        ok: false,
        step,
        error,
        steps,
        summary,
        details,
        hint:
          step === "secrets"
            ? "Set both TURN_STATIC_SECRET (ICE) and TURN_AUTH_SECRET (signaling); only one may cause partial call failures."
            : step === "signaling-token"
              ? "Verify TURN_AUTH_SECRET (min 16) and SIGNALING_TOKEN_SECRET or NEXTAUTH_SECRET (min 16) on Vercel Production."
              : step === "ice-config"
                ? "TURN_REQUIRED: set NEXT_PUBLIC_TURN_URLS (comma-separated or JSON array) with at least one turn:/turns: URI, plus TURN_REALM and TURN_STATIC_SECRET (coturn static-auth-secret). STUN-only is rejected."
                : undefined,
        note:
          "This check validates Vercel/Next configuration only — it does not verify that coturn or the signaling VPS process are running or reachable.",
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      steps,
      summary: "ALL_OK",
      details,
      note:
        "This check validates Vercel/Next configuration only — it does not verify that coturn or the signaling VPS process are running or reachable on the network.",
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
