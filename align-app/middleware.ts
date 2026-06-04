import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Blochează probe comune fără a lăsa Next să consume cicluri (scanneri, CVE-uri vechi). */
function isKnownMaliciousProbePath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (p === "/.env" || p.startsWith("/.env.")) return true;
  if (p === "/.git" || p.startsWith("/.git/")) return true;
  if (p.includes("wp-admin") || p.includes("wp-login")) return true;
  if (p.includes("phpmyadmin") || p.includes("xmlrpc.php")) return true;
  if (p.includes("vendor/phpunit")) return true;
  return false;
}

/** http→https ca media + WebSocket să nu rămână pe „Not secure”. Dezactivezi cu DISABLE_FORCE_HTTPS_REDIRECT=1. */
function shouldForceHttpsRedirect(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.DISABLE_FORCE_HTTPS_REDIRECT === "1") return false;
  const pub = process.env.PUBLIC_APP_URL?.trim() ?? "";
  const next = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (pub.startsWith("https://") || next.startsWith("https://")) return true;
  return process.env.VERCEL === "1";
}

function hostWithoutPort(host: string): string {
  if (host.startsWith("[") && host.includes("]:")) return host.slice(0, host.indexOf("]:") + 1);
  const i = host.lastIndexOf(":");
  if (i > 0 && /^\d+$/.test(host.slice(i + 1))) return host.slice(0, i);
  return host;
}

function isLocalDevHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.startsWith("localhost:") || h.startsWith("127.0.0.1:") || host.startsWith("[::1]:");
}

/** Evită redirect către https://192.168… când rulezi `next start` pe LAN cu env de producție. */
function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".local")) return true;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Sesiunea app = cookie `align_sid` + `/api/me` (nu JWT NextAuth de la login email/parolă).
 * Folosim fetch intern: matcher-ul exclude `/api/*`, deci request-ul la `/api/me` nu re-intră în middleware.
 */
function resolveMiddlewareMeUrl(request: NextRequest): URL {
  /** Docker/VPS: fetch public URL din container poate eșua; loopback la app e stabil. */
  const internal = process.env.INTERNAL_MIDDLEWARE_ORIGIN?.trim();
  if (internal) return new URL("/api/me", internal.endsWith("/") ? internal : `${internal}/`);
  if (process.env.NODE_ENV === "production") {
    const port = process.env.PORT?.trim() || "3000";
    return new URL(`/api/me`, `http://127.0.0.1:${port}`);
  }
  return new URL("/api/me", request.url);
}

async function adminAccessDecision(request: NextRequest): Promise<"allow" | "login" | "app"> {
  const meUrl = resolveMiddlewareMeUrl(request);
  const publicHost = request.headers.get("host")?.trim();
  let res: Response;
  try {
    const fwd: Record<string, string> = {
      cookie: request.headers.get("cookie") ?? "",
    };
    if (publicHost) {
      fwd.host = publicHost;
      fwd["x-forwarded-host"] = publicHost;
      fwd["x-forwarded-proto"] = request.headers.get("x-forwarded-proto")?.trim() || "https";
    }
    const sessionToken = request.headers.get("x-session-token")?.trim();
    const userId = request.headers.get("x-user-id")?.trim();
    if (sessionToken) fwd["x-session-token"] = sessionToken;
    if (userId) fwd["x-user-id"] = userId;
    res = await fetch(meUrl, {
      headers: fwd,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return "login";
  }
  if (res.status === 401 || res.status === 403) return "login";
  if (!res.ok) return "login";
  let data: { user?: { role?: string } };
  try {
    data = (await res.json()) as { user?: { role?: string } };
  } catch {
    return "login";
  }
  if (!data?.user) return "login";
  const role = data.user.role ?? "USER";
  if (role === "ADMIN" || role === "SUPERADMIN") return "allow";
  return "app";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isKnownMaliciousProbePath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (shouldForceHttpsRedirect()) {
    const host = request.headers.get("host") ?? "";
    if (!isLocalDevHost(host) && !isPrivateOrLocalHostname(hostWithoutPort(host))) {
      const proto = request.headers.get("x-forwarded-proto");
      const urlLooksHttp = request.nextUrl.protocol === "http:";
      const forwardedHttp = proto === "http";
      if (forwardedHttp || (proto == null && urlLooksHttp)) {
        const url = request.nextUrl.clone();
        url.protocol = "https:";
        return NextResponse.redirect(url, 308);
      }
    }
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/setup")) {
    const decision = await adminAccessDecision(request);
    if (decision === "login") {
      const u = new URL("/login", request.url);
      u.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(u);
    }
    if (decision === "app") {
      return NextResponse.redirect(new URL("/app", request.url));
    }
  }

  return NextResponse.next();
}

/** Fără `/api/*` — evită logică pe Route Handlers; exclude și ca fetch din middleware la `/api/me` să nu re-invoce middleware. */
export const config = {
  matcher: [
    "/((?!\\.well-known/|api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|robots.txt|sitemap.xml).*)",
  ],
};
