/**
 * Grace client pentru incoming poll: după decline/hangup, același pending poate reapărea scurt
 * (serverless / eventual consistency). Suprimă UI + sonerie fără a depinde de click-uri în Vercel.
 */

/** După încheiere apel: poll-ul poate mai vedea pending 1–15s; fără grace suficient reapare overlay + sonerie de câteva ori pe mobil. */
export const POST_HANGUP_INCOMING_GRACE_MS = 22_000;

const STORAGE_KEY_SESSION = "diebel_incoming_grace_v1";
/** Mirror pentru multi-tab / alt WebView: același JSON ca sessionStorage. */
export const INCOMING_GRACE_LOCAL_STORAGE_KEY = "diebel_incoming_grace_ls_v1";

type GraceEntry = { roomId: string; pendingSince?: string; until: number; markedAt?: number };
type GraceStore = Record<string, GraceEntry>;

function parseGraceStore(raw: string | null): GraceStore {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    return o as GraceStore;
  } catch {
    return {};
  }
}

function preferPendingSince(a?: string, b?: string): string | undefined {
  const ta = a != null && String(a).trim() !== "" ? String(a).trim() : "";
  const tb = b != null && String(b).trim() !== "" ? String(b).trim() : "";
  if (ta) return ta;
  if (tb) return tb;
  return undefined;
}

function mergeGraceStores(a: GraceStore, b: GraceStore): GraceStore {
  const out: GraceStore = { ...a };
  for (const [rid, eb] of Object.entries(b)) {
    const ea = out[rid];
    if (!ea) {
      out[rid] = eb;
      continue;
    }
    if (eb.until > ea.until) {
      out[rid] = eb;
      continue;
    }
    if (eb.until < ea.until) {
      continue;
    }
    out[rid] = {
      ...ea,
      pendingSince: preferPendingSince(ea.pendingSince, eb.pendingSince),
      markedAt: Math.max(ea.markedAt ?? 0, eb.markedAt ?? 0) || undefined,
    };
  }
  return out;
}

function readStore(): GraceStore {
  if (typeof window === "undefined") return {};
  const sess = parseGraceStore(sessionStorage.getItem(STORAGE_KEY_SESSION));
  const loc = parseGraceStore(localStorage.getItem(INCOMING_GRACE_LOCAL_STORAGE_KEY));
  const merged = mergeGraceStores(sess, loc);
  pruneExpired(merged);
  return merged;
}

function writeStore(map: GraceStore): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(map);
  try {
    sessionStorage.setItem(STORAGE_KEY_SESSION, serialized);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(INCOMING_GRACE_LOCAL_STORAGE_KEY, serialized);
  } catch {
    /* ignore */
  }
}

function pruneExpired(map: GraceStore): void {
  const now = Date.now();
  for (const k of Object.keys(map)) {
    const e = map[k];
    if (!e || now > e.until) delete map[k];
  }
}

export function markIncomingGrace(roomId: string, pendingSince?: string, ms = POST_HANGUP_INCOMING_GRACE_MS): void {
  if (typeof window === "undefined" || !roomId.trim()) return;
  const map = readStore();
  pruneExpired(map);
  const prev = map[roomId];
  const previousPendingSince =
    prev?.pendingSince != null && String(prev.pendingSince).trim() !== "" ? prev.pendingSince : undefined;
  map[roomId] = {
    roomId,
    pendingSince: pendingSince ?? previousPendingSince,
    until: Date.now() + ms,
    markedAt: Date.now(),
  };
  writeStore(map);
}

function incomingPendingSinceValid(pendingSince?: string): { ok: false } | { ok: true; trimmed: string; ms: number } {
  if (pendingSince == null) return { ok: false };
  const trimmed = String(pendingSince).trim();
  if (trimmed === "") return { ok: false };
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return { ok: false };
  return { ok: true, trimmed, ms };
}

/**
 * true = nu afișa incoming / sonerie.
 * Dacă serverul trimite `pendingSince`, suprimăm doar același ring (sau stale fără parse valid).
 * Un apel nou în același room după hangup are alt `pendingSince` și trebuie să apară imediat.
 */
export function isIncomingGraced(roomId: string, pendingSince?: string): boolean {
  if (typeof window === "undefined" || !roomId.trim()) return false;
  const map = readStore();
  pruneExpired(map);
  const e = map[roomId];
  if (!e) return false;
  if (Date.now() > e.until) {
    delete map[roomId];
    writeStore(map);
    return false;
  }

  const parsedInc = incomingPendingSinceValid(pendingSince);
  /** Fail-safe: lipsă / blank / NaN → în fereastra de grace nu mai pornim UI/sonerie pentru acel poll. */
  if (!parsedInc.ok) {
    return true;
  }

  const { trimmed: incTrimmed, ms: incMs } = parsedInc;
  const storedPs = e.pendingSince;
  const hasStored = storedPs != null && String(storedPs).trim() !== "";

  if (hasStored) {
    return String(storedPs).trim() === incTrimmed;
  }

  /**
   * Hangup fără pendingSince memorat: suprimăm ring-urile începute înainte de marcaj (+1s toleranță).
   * Apel nou are `pendingSince` mai nou decât markedAt.
   */
  if (typeof e.markedAt === "number") {
    return incMs <= e.markedAt + 1000;
  }

  return true;
}

export function clearIncomingGrace(roomId: string): void {
  if (typeof window === "undefined" || !roomId.trim()) return;
  const map = readStore();
  pruneExpired(map);
  delete map[roomId];
  writeStore(map);
}
