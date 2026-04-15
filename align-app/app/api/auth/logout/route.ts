import { NextResponse } from "next/server";
import { deleteSessionAsync, SESSION_COOKIE } from "@/lib/sessions";

/**
 * Închide sesiunea curentă (cookie `align_sid` și/sau token din headere) și șterge cookie-ul.
 */
export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const m = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const cookieSid = m?.[1]?.trim() ?? null;
  const headerToken = request.headers.get("x-session-token")?.trim() || null;
  const token = cookieSid || headerToken;
  if (token) {
    await deleteSessionAsync(token);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
