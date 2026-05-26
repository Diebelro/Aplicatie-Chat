/**
 * Rate limiting strict pe IP, userId și endpoint.
 * Store în memorie (pentru producție folosiți Redis sau similar).
 */

import { recordRateLimitRejected } from "@/lib/securityThreats";

const buckets = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000; // 1 minut
const LIMITS: Record<string, number> = {
  default: 120,
  "/api/swipe": 60,
  "/api/feed": 30,
  "/api/auth/login": 3,
  "/api/auth/signup": 3,
  "/api/auth/forgot-password": 5,
  "/api/auth/reset-password": 8,
  "/api/auth/reset-password-via-scan": 5,
  "/api/auth/resend-verify": 5,
  "/api/auth/validate-reset-token": 40,
  "/api/auth/align-bridge": 15,
  "/api/auth/recovery-confirm": 20,
  "/api/auth/recovery-session": 10,
  "/api/auth/verify-email": 20,
  "/api/ws": 30,
  "/api/messages": 100,
  "/api/check-email": 60,
  "/api/check-username": 60,
  "/api/admin/moderation-ai-thread": 12,
  "/api/feedback": 12,
  "/api/metrics/vitals": 45,
  "/api/visit": 40,
};

/** IP client pentru rate limit (x-forwarded-for / x-real-ip). */
export function getClientIpForRateLimit(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function getLimit(pathname: string): number {
  for (const [path, limit] of Object.entries(LIMITS)) {
    if (pathname === path || pathname.startsWith(path + "/")) return limit;
  }
  return LIMITS.default;
}

function prune(timestamps: number[]): number[] {
  const cutoff = Date.now() - WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

/** Verifică dacă cheia (ip, userId, path) a depășit limita. Returnează true dacă e OK, false dacă limitat. */
export function checkRateLimit(ip: string, userId: string | null, pathname: string): boolean {
  const key = `${ip}:${userId ?? "anon"}:${pathname}`;
  const limit = getLimit(pathname);
  let list = buckets.get(key) ?? [];
  list = prune(list);
  if (list.length >= limit) {
    recordRateLimitRejected(ip, userId, pathname, limit);
    return false;
  }
  list.push(Date.now());
  buckets.set(key, list);
  return true;
}

export function getRateLimitRemaining(ip: string, userId: string | null, pathname: string): number {
  const key = `${ip}:${userId ?? "anon"}:${pathname}`;
  const limit = getLimit(pathname);
  const list = prune(buckets.get(key) ?? []);
  return Math.max(0, limit - list.length);
}

/** Pentru monitorizare: număr aproximativ de chei active (rate limit). */
export function getRateLimitBucketApproxSize(): number {
  return buckets.size;
}
