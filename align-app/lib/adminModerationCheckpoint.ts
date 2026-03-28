/** Punctul de referință „am verificat moderarea” — doar în browserul tău (localStorage). */

export const ADMIN_MODERATION_CHECKPOINT_KEY = "align_admin_moderation_checkpoint";

export const ADMIN_CHECKPOINT_UPDATED_EVENT = "align-admin-checkpoint-updated";

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

export function markModerationReviewedNow(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_MODERATION_CHECKPOINT_KEY, new Date().toISOString());
  window.dispatchEvent(new Event(ADMIN_CHECKPOINT_UPDATED_EVENT));
}
