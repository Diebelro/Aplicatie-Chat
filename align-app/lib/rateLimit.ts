/**
 * Rate limiting strict pe IP, userId și endpoint.
 * Store în memorie (pentru producție folosiți Redis sau similar).
 */

const buckets = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000; // 1 minut
const LIMITS: Record<string, number> = {
  default: 120,
  "/api/swipe": 60,
  "/api/feed": 30,
  "/api/auth/login": 3,
  "/api/auth/signup": 3,
  "/api/messages": 100,
  "/api/check-email": 60,
  "/api/check-username": 60,
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
  if (list.length >= limit) return false;
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
