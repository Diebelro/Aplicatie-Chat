import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/sessionAuth";
import { getSessionAsync, SESSION_COOKIE, getSessionCookieOptions } from "@/lib/sessions";

/**
 * Repune cookie-ul httpOnly `align_sid` când clientul are doar token în storage
 * (WebView / sesiune fără cookie). Fără asta, middleware-ul de la /admin refuză accesul
 * deși /api/me merge cu x-session-token.
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const sessionToken =
    request.headers.get("x-session-token")?.trim() || cookieMatch?.[1]?.trim() || null;

  if (!sessionToken) {
    return NextResponse.json({ error: "Lipsește sesiunea." }, { status: 401 });
  }

  const entry = await getSessionAsync(sessionToken);
  if (!entry || entry.userId !== auth.userId) {
    return NextResponse.json({ error: "Sesiune invalidă." }, { status: 401 });
  }

  const maxAgeSeconds = Math.max(60, Math.floor((entry.expiresAt - Date.now()) / 1000));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken, getSessionCookieOptions(maxAgeSeconds));
  return res;
}
