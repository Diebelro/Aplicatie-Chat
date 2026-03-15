import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow Next.js internals & static assets
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Public pages
  const PUBLIC_PAGES = new Set([
    "/",
    "/login",
    "/signup",
    "/terms",
    "/privacy",
    "/cookies",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/check-email",
    "/completeaza-profilul",
    "/cont-blocat",
  ]);

  if (PUBLIC_PAGES.has(pathname)) {
    return NextResponse.next();
  }

  // Everything else: pass-through (no auth here)
  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
