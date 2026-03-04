/**
 * Rate limiting pentru signup (in-memory).
 * - Per IP: max 1 cont la 10 min, max 5 conturi la 48h
 * - Per device fingerprint: max 5/zi (normal), max 2/zi (device suspect)
 */

const TEN_MIN_MS = 10 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const ipLastSignup = new Map<string, number>();
const ipSignups48h = new Map<string, number[]>();
const fingerprintSignups24h = new Map<string, number[]>();
const fingerprintSuspect = new Map<string, boolean>();
const fingerprintIps = new Map<string, Set<string>>();

function pruneOld(arr: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return arr.filter((t) => t > cutoff);
}

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfterMinutes?: number };

export function checkSignupRateLimit(
  request: Request,
  deviceFingerprint: string | null,
  isSuspectDevice: boolean
): RateLimitResult {
  const ip = getClientIp(request);
  const now = Date.now();

  // 1. Per IP: max 1 la 10 min
  const last = ipLastSignup.get(ip);
  if (last != null && now - last < TEN_MIN_MS) {
    const retryAfter = Math.ceil((TEN_MIN_MS - (now - last)) / 60000);
    return {
      allowed: false,
      reason: "Poți crea un singur cont la 10 minute. Încearcă din nou mai târziu.",
      retryAfterMinutes: retryAfter,
    };
  }

  // 2. Per IP: max 5 la 48h
  let ipList = ipSignups48h.get(ip) ?? [];
  ipList = pruneOld(ipList, FORTY_EIGHT_HOURS_MS);
  if (ipList.length >= 5) {
    return {
      allowed: false,
      reason: "Ai atins limita de 5 conturi în ultimele 48 de ore pentru această conexiune.",
    };
  }

  // 3. Per fingerprint: max 5/zi (normal) sau 2/zi (suspect)
  const fp = deviceFingerprint && deviceFingerprint.length > 0 ? deviceFingerprint : `ip-${ip}`;
  const suspect = isSuspectDevice || fingerprintSuspect.get(fp) === true;
  const maxPerDay = suspect ? 2 : 5;

  let fpList = fingerprintSignups24h.get(fp) ?? [];
  fpList = pruneOld(fpList, TWENTY_FOUR_HOURS_MS);
  if (fpList.length >= maxPerDay) {
    return {
      allowed: false,
      reason: suspect
        ? "Limita de conturi pentru acest dispozitiv a fost atinsă. Încearcă mâine."
        : "Ai atins limita de conturi pentru acest dispozitiv (5/zi). Încearcă mâine.",
    };
  }

  return { allowed: true };
}

export function recordSignup(request: Request, deviceFingerprint: string | null, isSuspectDevice: boolean): void {
  const ip = getClientIp(request);
  const now = Date.now();
  const fp = deviceFingerprint && deviceFingerprint.length > 0 ? deviceFingerprint : `ip-${ip}`;

  ipLastSignup.set(ip, now);

  let ipList = ipSignups48h.get(ip) ?? [];
  ipList = pruneOld(ipList, FORTY_EIGHT_HOURS_MS);
  ipList.push(now);
  ipSignups48h.set(ip, ipList);

  let fpList = fingerprintSignups24h.get(fp) ?? [];
  fpList = pruneOld(fpList, TWENTY_FOUR_HOURS_MS);
  fpList.push(now);
  fingerprintSignups24h.set(fp, fpList);

  if (isSuspectDevice) fingerprintSuspect.set(fp, true);

  const ips = fingerprintIps.get(fp) ?? new Set<string>();
  ips.add(ip);
  fingerprintIps.set(fp, ips);
  if (ips.size > 2) fingerprintSuspect.set(fp, true);
}
