/**
 * Grace client pentru incoming poll: după decline/hangup, același pending poate reapărea scurt
 * (serverless / eventual consistency). Suprimă UI + sonerie fără a depinde de click-uri în Vercel.
 */

const STORAGE_KEY = "diebel_incoming_grace_v1";

type GraceEntry = { roomId: string; pendingSince?: string; until: number };
type GraceStore = Record<string, GraceEntry>;

function readStore(): GraceStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    return o as GraceStore;
  } catch {
    return {};
  }
}

function writeStore(map: GraceStore): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
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

export function markIncomingGrace(roomId: string, pendingSince?: string, ms = 8000): void {
  if (typeof window === "undefined" || !roomId.trim()) return;
  const map = readStore();
  pruneExpired(map);
  map[roomId] = { roomId, pendingSince, until: Date.now() + ms };
  writeStore(map);
}

/**
 * true = nu afișa incoming / sonerie.
 * Dacă ambele pendingSince (stocat și din poll) există: suprimă doar dacă coincid (același ring).
 * Dacă lipsește vreunul: suprimă după roomId în fereastra de grace (hangup fără ps pe server).
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
  const storedPs = e.pendingSince;
  const incPs = pendingSince;
  const hasStored = storedPs != null && String(storedPs).trim() !== "";
  const hasInc = incPs != null && String(incPs).trim() !== "";
  if (hasStored && hasInc) {
    return String(storedPs) === String(incPs);
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
