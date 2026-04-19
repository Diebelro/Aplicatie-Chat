import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { findUserOrPrisma } from "@/lib/repo-prisma";
import { findNonRelayUrlsInList } from "@/lib/webrtc/iceRelayGuards";
import { sortRelayUrlsHostileNetworkOrder } from "@/lib/webrtc/relayUrlOrder";
import { validateTurnUrlsForIceConfig } from "@/lib/webrtc/turnEnv";
import { callApiErrorJson } from "@/lib/call/callApiJsonError";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

const TTL_SECONDS = 24 * 60 * 60;

export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json(
      callApiErrorJson("SIGNALING_TOKEN_INVALID", { error: "Neautorizat." }),
      { status: 401 }
    );
  }

  if (!rateLimitAllow(`icecfg:${userId}`, RATE_MAX, RATE_WINDOW_MS)) {
    return NextResponse.json(
      callApiErrorJson("SIGNALING_SERVICE_UNAVAILABLE", { error: "Prea multe cereri." }),
      { status: 429 }
    );
  }

  const user = await findUserOrPrisma(userId);
  if (!user) {
    return NextResponse.json(callApiErrorJson("UNKNOWN", { error: "Utilizator negăsit." }), { status: 404 });
  }

  const realm = process.env.TURN_REALM?.trim() ?? "";
  if (!realm) {
    return NextResponse.json(
      callApiErrorJson("TURN_NOT_CONFIGURED", {
        error:
          "TURN_REQUIRED: TURN_REALM is missing. Set TURN_REALM to match coturn realm=.",
      }),
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const secret = process.env.TURN_STATIC_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json(
      callApiErrorJson("TURN_NOT_CONFIGURED", {
        error:
          "TURN_REQUIRED: TURN_STATIC_SECRET is missing. Set it to the same value as coturn static-auth-secret.",
      }),
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const urlsCheck = validateTurnUrlsForIceConfig(process.env.NEXT_PUBLIC_TURN_URLS);
  if (!urlsCheck.ok) {
    return NextResponse.json(
      callApiErrorJson("TURN_CONFIG_INVALID", { error: urlsCheck.error }),
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const illegal = findNonRelayUrlsInList(urlsCheck.relayUrls);
  if (illegal.length) {
    console.error(
      "FATAL: TURN IS REQUIRED – ice-config invariant broken (non-relay URL in relayUrls)",
      illegal
    );
    return NextResponse.json(
      callApiErrorJson("TURN_CONFIG_INVALID", {
        error:
          "TURN_REQUIRED: internal ICE relay URL validation failed (non-relay URL in relay list).",
      }),
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const safeUserId = String(userId).replace(/:/g, "_");
  const username = `${expiry}:${safeUserId}`;
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
  const orderedRelay = sortRelayUrlsHostileNetworkOrder(urlsCheck.relayUrls);

  return NextResponse.json(
    {
      iceServers: [{ urls: orderedRelay, username, credential }],
      ttl: TTL_SECONDS,
      realm,
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
