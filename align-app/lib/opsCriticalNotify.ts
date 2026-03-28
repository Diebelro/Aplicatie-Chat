/**
 * Notificare opțională (webhook) când starea operațională e critical.
 * Debounce: același set de motive → max o dată la COOLDOWN_SAME; motive noi → min DIF_GAP între trimiteri.
 */

export type OpsCriticalPayload = {
  overall: "ok" | "warn" | "critical";
  overallReasons: string[];
  generatedAt?: string;
  /** Ex. snapshot | health */
  source?: string;
};

function sameCooldownMs(): number {
  const n = Number(process.env.OPS_CRITICAL_NOTIFY_COOLDOWN_MS);
  return Number.isFinite(n) && n >= 60_000 ? n : 15 * 60 * 1000;
}

let lastSentAt = 0;
let lastFp = "";

function fingerprint(reasons: string[], source?: string): string {
  return [...reasons].sort().join(" | ") + `\n${source ?? ""}`;
}

export function maybeNotifyOpsCritical(payload: OpsCriticalPayload): void {
  if (payload.overall !== "critical") return;

  const url = process.env.OPS_CRITICAL_WEBHOOK_URL?.trim();
  if (!url) return;

  if (process.env.NODE_ENV === "development" && process.env.OPS_CRITICAL_NOTIFY_IN_DEV !== "1") {
    return;
  }

  const fp = fingerprint(payload.overallReasons, payload.source);
  const now = Date.now();
  const sameCooldown = sameCooldownMs();
  const diffGap = Math.max(30_000, Math.min(sameCooldown, 3 * 60 * 1000));
  if (fp === lastFp) {
    if (now - lastSentAt < sameCooldown) return;
  } else if (now - lastSentAt < diffGap) {
    return;
  }

  lastFp = fp;
  lastSentAt = now;

  const secret = process.env.OPS_CRITICAL_WEBHOOK_SECRET?.trim();
  const body = JSON.stringify({
    event: "align_ops_critical",
    overall: payload.overall,
    reasons: payload.overallReasons,
    source: payload.source ?? "app",
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
    app:
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  });

  queueMicrotask(() => {
    void (async () => {
      try {
        await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
          },
          body,
        });
      } catch {
        /* nu blochez runtime-ul */
      }
    })();
  });
}
