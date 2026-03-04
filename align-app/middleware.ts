/**
 * Middleware: header-e obligatorii pentru API-uri protejate (x-user-id, x-session-token, x-device-id).
 * Rutele publice (login, signup, reset password, etc.) sunt exceptate.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_API_PREFIXES = [
  "/api/media", // acces doar cu URL semnat (s=)
  "/api/admin/setup-status",
  "/api/admin/setup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/validate-reset-token",
  "/api/auth/reset-password",
  "/api/auth/reset-password-via-scan",
  "/api/auth/recovery-session",
  "/api/auth/recovery-status",
  "/api/auth/recovery-confirm",
  "/api/auth/logout-all",
  "/api/check-username",
  "/api/subscription/plans",
  "/api/rewarded",
];
const AUTH_PROVIDER = "/api/auth/";

function isPublicApi(pathname: string): boolean {
  if (pathname.startsWith("/api/ads/")) return true;
  for (const p of PUBLIC_API_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + "/")) return true;
  }
  if (pathname.startsWith(AUTH_PROVIDER)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }
  const userId = request.headers.get("x-user-id");
  const sessionToken = request.headers.get("x-session-token");
  const deviceId = request.headers.get("x-device-id");
  if (!userId?.trim() || !sessionToken?.trim() || !deviceId?.trim()) {
    return NextResponse.json(
      { error: "Lipsesc header-ele de autentificare (x-user-id, x-session-token, x-device-id)." },
      { status: 401 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
