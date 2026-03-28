import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { findUserOrPrisma } from "@/lib/repo-prisma";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

export async function GET(request: NextRequest) {
  const userId = resolveRequestUserId(request);
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

  const urls = JSON.parse(process.env.NEXT_PUBLIC_TURN_URLS || "[]");
  const realm = process.env.TURN_REALM!;
  const secret = process.env.TURN_STATIC_SECRET!;

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "TURN urls missing" }, { status: 500 });
  }
  if (!realm || !secret) {
    return NextResponse.json({ error: "TURN realm/secret missing" }, { status: 500 });
  }

  const ttlSeconds = 180; // 3 minute
  const username = `${Math.floor(Date.now() / 1000) + ttlSeconds}:align`;
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");

  const iceServers = [{ urls, username, credential }];

  return NextResponse.json(
    { iceServers, ttl: ttlSeconds, realm },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    }
  );
}
