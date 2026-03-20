/** Rate limit in-memory per cheie (userId); pentru serverless e best-effort per instanță. */

const buckets = new Map<string, number[]>();

export function rateLimitAllow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = buckets.get(key) ?? [];
  const next = prev.filter((t) => t > cutoff);
  if (next.length >= max) {
    buckets.set(key, next);
    return false;
  }
  next.push(now);
  buckets.set(key, next);
  return true;
}
