import { NextRequest, NextResponse } from "next/server";
import { createSignalingToken } from "@/lib/signalingToken";
import { getSignalingSecretForWsToken } from "@/lib/env/webrtcConfig";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { findUserOrPrisma } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";

export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  if (!rateLimitAllow(`sigtok:${userId}`, 20, 60_000)) {
    return NextResponse.json({ error: "Prea multe cereri." }, { status: 429 });
  }

  const user = await findUserOrPrisma(userId);
  if (!user) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }

  const secrets = getSignalingSecretForWsToken();
  if (!secrets.ok) {
    return NextResponse.json(
      {
        error: "Semnalizare neconfigurată.",
        ...(process.env.NODE_ENV === "development" ? { detail: secrets.error } : {}),
      },
      { status: 503 }
    );
  }

  const token = createSignalingToken(userId, secrets.signalingSecret, TOKEN_TTL_MS);
  return NextResponse.json({ token, expiresInMs: TOKEN_TTL_MS });
}
