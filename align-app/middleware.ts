import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  if (!shouldForceHttpsRedirect()) return NextResponse.next();
  const host = request.headers.get("host") ?? "";
  if (isLocalDevHost(host)) return NextResponse.next();
  if (isPrivateOrLocalHostname(hostWithoutPort(host))) return NextResponse.next();
  const proto = request.headers.get("x-forwarded-proto");
  const urlLooksHttp = request.nextUrl.protocol === "http:";
  const forwardedHttp = proto === "http";
  if (forwardedHttp || (proto == null && urlLooksHttp)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

/** Fără /api și asset-uri Next — evită efecte colaterale pe cereri API. */
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|robots.txt|sitemap.xml).*)"],
};
