/**
 * Ultimele erori neprinse în proces (și opțional din rute). In-memory — per instanță serverless.
 */

export type ServerErrorRecord = {
  at: string;
  source: string;
  message: string;
  stack?: string;
};

const ring: ServerErrorRecord[] = [];
const MAX = 200;

function push(rec: Omit<ServerErrorRecord, "at"> & { at?: string }): void {
  ring.push({
    ...rec,
    at: rec.at ?? new Date().toISOString(),
  });
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);
}

export function recordUncaughtProcessError(source: string, err: Error): void {
  push({
    source,
    message: err.message?.slice(0, 2000) || "Eroare",
    stack: err.stack?.slice(0, 4000),
  });
}

/** Apel manual din try/catch în rute critice (opțional). */
export function recordApiRouteError(route: string, err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  push({
    source: `api:${route}`,
    message: e.message?.slice(0, 2000) || "Eroare",
    stack: e instanceof Error ? e.stack?.slice(0, 4000) : undefined,
  });
}

export function getServerErrorStats(windowMs: number): {
  count: number;
  recent: ServerErrorRecord[];
} {
  const cutoff = Date.now() - windowMs;
  const recent = ring.filter((r) => new Date(r.at).getTime() > cutoff);
  return { count: recent.length, recent: [...recent].reverse().slice(0, 40) };
}
