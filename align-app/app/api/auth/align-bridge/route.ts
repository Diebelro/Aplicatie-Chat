import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createSessionAsync, SESSION_COOKIE, getSessionCookieOptions } from "@/lib/sessions";
import { isPrismaAvailable, prismaProfileCompleted, prismaUpsertDevice } from "@/lib/repo-prisma";

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

/**
 * După OAuth (NextAuth), creăm sesiunea Align (`align_sid`) folosită de restul API-urilor.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session) {
    return NextResponse.redirect(new URL("/login?reason=oauth_failed", request.url));
  }
  if (!isPrismaAvailable()) {
    return NextResponse.redirect(new URL("/login?reason=oauth_no_db", request.url));
  }
  try {
    const userAgent = request.headers.get("user-agent") ?? "";
    const ip = getClientIp(request);
    const fp = `oauth-nextauth-${userId}`.slice(0, 128);
    const dev = await prismaUpsertDevice({
      userId,
      fingerprint: fp,
      userAgent,
      ip,
      trusted: true,
    });
    const { sessionId, maxAgeSeconds } = await createSessionAsync(userId, dev.id, true);
    const profileComplete = await prismaProfileCompleted(userId);
    const targetPath = profileComplete ? "/app" : "/completeaza-profilul";
    const res = NextResponse.redirect(new URL(targetPath, request.url));
    const opts = getSessionCookieOptions(Math.max(maxAgeSeconds, 60));
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path,
      ...(opts.maxAge != null && { maxAge: opts.maxAge }),
    });
    return res;
  } catch (e) {
    console.error("[align-bridge]", e);
    return NextResponse.redirect(new URL("/login?reason=oauth_failed", request.url));
  }
}
