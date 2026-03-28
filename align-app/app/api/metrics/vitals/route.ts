import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rateLimit";
import { recordVitalSample } from "@/lib/vitalsStore";

const PATH = "/api/metrics/vitals";

function clamp(n: unknown, max: number): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return undefined;
  return Math.min(n, max);
}

/**
 * Beacon anonim de performanță (LCP, TTFB). Fără cookie; rate limit pe IP.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIpForRateLimit(request);
  if (!checkRateLimit(ip, null, PATH)) {
    return NextResponse.json({ error: "Limită" }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const pathRaw = body?.path;
  const path =
    typeof pathRaw === "string"
      ? pathRaw.trim().slice(0, 400)
      : typeof pathRaw === "undefined"
        ? ""
        : "";
  const lcp = body?.lcp ?? body?.lcpMs;
  const ttfb = body?.ttfb ?? body?.ttfbMs;
  const domReady = body?.domReady ?? body?.domReadyMs;
  recordVitalSample({
    path: path || "/",
    lcpMs: clamp(lcp, 120_000),
    ttfbMs: clamp(ttfb, 120_000),
    domReadyMs: clamp(domReady, 120_000),
  });
  return NextResponse.json({ ok: true });
}
