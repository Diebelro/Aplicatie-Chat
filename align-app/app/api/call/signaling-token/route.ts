import { NextRequest, NextResponse } from "next/server";
import { createSignalingToken } from "@/lib/signalingToken";
import { getSignalingSecretForWsToken } from "@/lib/env/webrtcConfig";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { findUserOrPrisma } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { callApiErrorJson } from "@/lib/call/callApiJsonError";

export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json(
      callApiErrorJson("SIGNALING_TOKEN_INVALID", { error: "Neautorizat." }),
      { status: 401 }
    );
  }

  if (!rateLimitAllow(`sigtok:${userId}`, 20, 60_000)) {
    return NextResponse.json(
      callApiErrorJson("SIGNALING_SERVICE_UNAVAILABLE", { error: "Prea multe cereri." }),
      { status: 429 }
    );
  }

  const user = await findUserOrPrisma(userId);
  if (!user) {
    return NextResponse.json(callApiErrorJson("UNKNOWN", { error: "Utilizator negăsit." }), { status: 404 });
  }

  const secrets = getSignalingSecretForWsToken();
  if (!secrets.ok) {
    return NextResponse.json(
      callApiErrorJson("SIGNALING_NOT_CONFIGURED", {
        error: "Semnalizare neconfigurată.",
        message: secrets.error,
      }),
      { status: 503 }
    );
  }

  const token = createSignalingToken(userId, secrets.signalingSecret, TOKEN_TTL_MS);
  return NextResponse.json({ token, expiresInMs: TOKEN_TTL_MS });
}
