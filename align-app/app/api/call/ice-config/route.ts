import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { findUserOrPrisma } from "@/lib/repo-prisma";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  if (!rateLimitAllow(`icecfg:${userId}`, RATE_MAX, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Prea multe cereri." }, { status: 429 });
  }

  const user = await findUserOrPrisma(userId);
  if (!user) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }

  let urls: unknown;
  try {
    urls = JSON.parse(process.env.NEXT_PUBLIC_TURN_URLS || "[]");
  } catch {
    urls = [];
  }
  const urlList = Array.isArray(urls) ? urls.filter((x): x is string => typeof x === "string") : [];
  const realm = process.env.TURN_REALM?.trim() ?? "";
  const secret = process.env.TURN_STATIC_SECRET?.trim() ?? "";
  const turnReady = urlList.length > 0 && realm.length > 0 && secret.length > 0;

  /**
   * Fără coturn complet: STUN public (200) — merge des pe aceeași Wi‑Fi / NAT favorabil; între rețele
   * diferite pune `NEXT_PUBLIC_TURN_URLS` + `TURN_REALM` + `TURN_STATIC_SECRET` pe Vercel și coturn pe VPS.
   */
  if (!turnReady) {
    const stunIce = {
      iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
      ttl: 180,
    };
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(
        { ...stunIce, realm: "dev-stun-only", devIceFallback: true },
        { status: 200, headers: { "cache-control": "no-store" } }
      );
    }
    return NextResponse.json(
      { ...stunIce, realm: "prod-stun-only-fallback", prodStunOnlyFallback: true },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }

  const ttlSeconds = 180; // 3 minute
  const username = `${Math.floor(Date.now() / 1000) + ttlSeconds}:align`;
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");

  /** STUN separat de TURN — credențialele REST se aplică doar la `turn:`/`turns:`, evită ambiguități pe WebView. */
  const stunOnly = urlList.filter((u) => /^stun:/i.test(u.trim()));
  const turnOnly = urlList.filter((u) => /^turns?:/i.test(u.trim()));
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [];
  if (stunOnly.length) {
    iceServers.push({ urls: stunOnly });
  }
  if (turnOnly.length) {
    iceServers.push({ urls: turnOnly, username, credential });
  }
  if (!iceServers.length && urlList.length) {
    iceServers.push({ urls: urlList, username, credential });
  }

  return NextResponse.json(
    { iceServers, ttl: ttlSeconds, realm },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    }
  );
}
