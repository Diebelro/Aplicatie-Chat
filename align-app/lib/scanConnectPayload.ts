/**
 * Payload QR „Conectare rapidă” / Scan & Connect.
 * Format: https://…/app/scan?u=<userId> (sau doar userId).
 */

const USER_ID_RE = /^[a-z0-9]{20,40}$/i;

export function isPlausibleUserId(id: string): boolean {
  return USER_ID_RE.test(id.trim());
}

/** URL de afișat în QR pentru un user. */
export function buildScanConnectUrl(origin: string, userId: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/app/scan?u=${encodeURIComponent(userId.trim())}`;
}

/** Extrage userId din textul citit de scanner (URL, query, sau id gol). */
export function parseScanConnectPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (isPlausibleUserId(text)) return text;

  try {
    const u = new URL(text);
    const fromQuery = u.searchParams.get("u") || u.searchParams.get("user") || u.searchParams.get("id");
    if (fromQuery && isPlausibleUserId(fromQuery)) return fromQuery.trim();
    const pathMatch = u.pathname.match(/\/app\/(?:scan|user)\/([a-z0-9]+)/i);
    if (pathMatch?.[1] && isPlausibleUserId(pathMatch[1])) return pathMatch[1];
  } catch {
    /* nu e URL absolut */
  }

  const q = text.match(/[?&]u=([a-z0-9]+)/i);
  if (q?.[1] && isPlausibleUserId(q[1])) return q[1];

  return null;
}
