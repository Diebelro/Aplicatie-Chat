import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { rateLimitAllow } from "@/lib/callRateLimit";
import {
  WEBRTC_EXTERNAL_INFRA_CHECKLIST,
  buildWebrtcReadyCheck,
} from "@/lib/webrtcReadyCheck";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;

/**
 * GET /api/webrtc-ready-check — diagnostic FINAL app-side pentru WebRTC.
 *
 * ---------------------------------------------------------------------------------------------
 * `readyFromApp === true` ⇒ aplicația (Vercel/Next + env) este pregătită; NU verifică dacă
 * rulează coturn, procesul WebSocket pe VPS sau firewall-ul. Acela este exclusiv
 * infrastructură — vezi docs/WEBRTC-FINAL.md.
 * ---------------------------------------------------------------------------------------------
 *
 * Fără loguri de secrete; fără token în răspuns.
 */
export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);

  if (!userId) {
    const body = await buildWebrtcReadyCheck(null);
    return NextResponse.json(body, {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }

  if (!rateLimitAllow(`wrtcrc:${userId}`, RATE_MAX, RATE_WINDOW_MS)) {
    return NextResponse.json(
      {
        readyFromApp: false,
        missingFromApp: ["RATE_LIMITED"],
        requiresExternalInfra: true,
        externalInfraChecklist: WEBRTC_EXTERNAL_INFRA_CHECKLIST,
        summary: "APP_NOT_READY" as const,
      },
      { status: 429, headers: { "cache-control": "no-store" } }
    );
  }

  const body = await buildWebrtcReadyCheck(userId);
  return NextResponse.json(body, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
