/**
 * Ultimele rapoarte de performanță din browser (LCP, TTFB etc.). In-memory.
 */

export type VitalSample = {
  at: string;
  path: string;
  lcpMs?: number;
  ttfbMs?: number;
  domReadyMs?: number;
};

const samples: VitalSample[] = [];
const MAX = 80;

export function recordVitalSample(sample: Omit<VitalSample, "at"> & { at?: string }): void {
  samples.push({
    ...sample,
    at: sample.at ?? new Date().toISOString(),
  });
  if (samples.length > MAX) samples.splice(0, samples.length - MAX);
}

export function getLatestVitals(): { latest: VitalSample | null; avgLcpLast20: number | null } {
  if (samples.length === 0) return { latest: null, avgLcpLast20: null };
  const latest = samples[samples.length - 1] ?? null;
  const last = samples.slice(-20);
  const lcps = last.map((s) => s.lcpMs).filter((n): n is number => typeof n === "number" && n > 0);
  const avgLcpLast20 =
    lcps.length > 0 ? Math.round(lcps.reduce((a, b) => a + b, 0) / lcps.length) : null;
  return { latest, avgLcpLast20 };
}
