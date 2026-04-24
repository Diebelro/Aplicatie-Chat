/** Punctul de referință „am verificat moderarea” — doar în browserul tău (localStorage). */

export const ADMIN_MODERATION_CHECKPOINT_KEY = "align_admin_moderation_checkpoint";

/** Checkpoint per secțiune (înscrieri vs rapoarte vs feedback app) — badge-uri independente. */
export const ADMIN_MODERATION_CHECKPOINT_V2_KEY = "align_admin_moderation_checkpoint_v2";

export const ADMIN_CHECKPOINT_UPDATED_EVENT = "align-admin-checkpoint-updated";

export type ModerationSectionKind = "users" | "reports" | "feedback";

type CheckpointV2 = Partial<Record<ModerationSectionKind, string>>;

/** Dacă nu există încă checkpoint, folosim ultimele 7 zile ca „ce e nou”. */
export function defaultModerationSince(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export function readModerationSince(): Date {
  if (typeof window === "undefined") return defaultModerationSince();
  const raw = localStorage.getItem(ADMIN_MODERATION_CHECKPOINT_KEY);
  if (!raw) return defaultModerationSince();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? defaultModerationSince() : d;
}

function readCheckpointV2(): CheckpointV2 | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ADMIN_MODERATION_CHECKPOINT_V2_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    return o as CheckpointV2;
  } catch {
    return null;
  }
}

/** `since` folosit la numărătoarea pe o secțiune (badge nav admin). */
export function readSinceFor(kind: ModerationSectionKind): Date {
  const v2 = readCheckpointV2();
  const s = v2?.[kind];
  if (typeof s === "string") {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return readModerationSince();
}

/** Marchează o secțiune ca văzută acum (fără a reseta celelalte). */
export function markSectionReviewed(kind: ModerationSectionKind): void {
  if (typeof window === "undefined") return;
  const iso = new Date().toISOString();
  const base = readModerationSince().toISOString();
  const prev = readCheckpointV2() ?? {};
  const next: CheckpointV2 = {
    users: typeof prev.users === "string" ? prev.users : base,
    reports: typeof prev.reports === "string" ? prev.reports : base,
    feedback: typeof prev.feedback === "string" ? prev.feedback : base,
    [kind]: iso,
  };
  localStorage.setItem(ADMIN_MODERATION_CHECKPOINT_V2_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(ADMIN_CHECKPOINT_UPDATED_EVENT));
}

/** Resetează tot (butonul „Am verificat” din dashboard admin). */
export function markModerationReviewedNow(): void {
  if (typeof window === "undefined") return;
  const iso = new Date().toISOString();
  localStorage.setItem(ADMIN_MODERATION_CHECKPOINT_KEY, iso);
  const v2: CheckpointV2 = { users: iso, reports: iso, feedback: iso };
  localStorage.setItem(ADMIN_MODERATION_CHECKPOINT_V2_KEY, JSON.stringify(v2));
  window.dispatchEvent(new Event(ADMIN_CHECKPOINT_UPDATED_EVENT));
}
