/**
 * Jurnal în memorie pentru evenimente de securitate (abuz / recon / brute-force).
 * În producție serverless — vizibilitate per instanță; la scară: Redis + alerte externe.
 */

export type ThreatSeverity = "low" | "medium" | "high";

export interface SecurityThreatEvent {
  at: string;
  severity: ThreatSeverity;
  type: string;
  message: string;
  ip?: string;
  path?: string;
  userId?: string;
  meta?: string;
}

const store: SecurityThreatEvent[] = [];
const MAX_ENTRIES = 2000;
const DEDUP_MS = 4000;
const lastDedup = new Map<string, number>();

function dedupKey(type: string, ip: string, path?: string) {
  return `${type}:${ip}:${path ?? ""}`;
}

export function recordSecurityThreat(e: Omit<SecurityThreatEvent, "at"> & { at?: string }): void {
  const at = e.at ?? new Date().toISOString();
  if (e.severity !== "high") {
    const key = dedupKey(e.type, e.ip ?? "unknown", e.path);
    const now = Date.now();
    const prev = lastDedup.get(key);
    if (prev != null && now - prev < DEDUP_MS) return;
    lastDedup.set(key, now);
  }

  store.push({
    ...e,
    at,
  });
  if (store.length > MAX_ENTRIES) {
    store.splice(0, store.length - MAX_ENTRIES);
  }
}

export function recordRateLimitRejected(ip: string, userId: string | null, pathname: string, limit: number): void {
  const auth =
    pathname.includes("/api/auth/login") ||
    pathname.includes("/api/auth/signup") ||
    pathname.includes("/api/auth/");
  recordSecurityThreat({
    severity: auth ? "high" : "medium",
    type: "rate_limit",
    message: `Cereri peste limită (${limit}/min): ${pathname}`,
    ip,
    path: pathname,
    userId: userId ?? undefined,
  });
}

const WINDOW_15M = 15 * 60 * 1000;

export function getSecurityThreatsSnapshot(windowMs: number = WINDOW_15M): {
  events: SecurityThreatEvent[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  /** Banner roșu + puls în admin */
  shouldAlert: boolean;
} {
  const cutoff = Date.now() - windowMs;
  const recent = store.filter((e) => new Date(e.at).getTime() > cutoff);
  const highCount = recent.filter((e) => e.severity === "high").length;
  const mediumCount = recent.filter((e) => e.severity === "medium").length;
  const lowCount = recent.filter((e) => e.severity === "low").length;
  const shouldAlert = highCount > 0 || mediumCount >= 5;
  return {
    events: [...recent].reverse().slice(0, 100),
    highCount,
    mediumCount,
    lowCount,
    shouldAlert,
  };
}
