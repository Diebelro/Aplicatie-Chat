/**
 * Ciorne formular în sessionStorage — pierdute la închiderea tab-ului; nu înlocuiesc autentificarea.
 * Nu stocăm parole.
 */

const CHAT_PREFIX = "align_draft_chat:";
const FEEDBACK_KEY = "align_draft_feedback";
/** Email în curs de scris (același tab); login folosește și align_last_email în localStorage la succes */
export const LOGIN_EMAIL_DRAFT_KEY = "align_draft_login_email";

const MAX_CHAT = 12_000;
const MAX_FEEDBACK = 8000;
const MAX_LOGIN_EMAIL = 254;

function safeGet(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readChatDraft(otherUserId: string): string {
  if (!otherUserId) return "";
  return safeGet(CHAT_PREFIX + otherUserId).slice(0, MAX_CHAT);
}

export function writeChatDraft(otherUserId: string, text: string): void {
  if (!otherUserId) return;
  const t = text.slice(0, MAX_CHAT);
  if (t.trim()) safeSet(CHAT_PREFIX + otherUserId, t);
  else safeRemove(CHAT_PREFIX + otherUserId);
}

export function clearChatDraft(otherUserId: string): void {
  if (!otherUserId) return;
  safeRemove(CHAT_PREFIX + otherUserId);
}

export function readFeedbackDraft(): string {
  return safeGet(FEEDBACK_KEY).slice(0, MAX_FEEDBACK);
}

export function writeFeedbackDraft(text: string): void {
  const t = text.slice(0, MAX_FEEDBACK);
  if (t.trim()) safeSet(FEEDBACK_KEY, t);
  else safeRemove(FEEDBACK_KEY);
}

export function clearFeedbackDraft(): void {
  safeRemove(FEEDBACK_KEY);
}

export function readLoginEmailDraft(): string {
  return safeGet(LOGIN_EMAIL_DRAFT_KEY).trim().slice(0, MAX_LOGIN_EMAIL);
}

export function writeLoginEmailDraft(email: string): void {
  const t = email.trim().slice(0, MAX_LOGIN_EMAIL);
  if (t) safeSet(LOGIN_EMAIL_DRAFT_KEY, t);
  else safeRemove(LOGIN_EMAIL_DRAFT_KEY);
}

export function clearLoginEmailDraft(): void {
  safeRemove(LOGIN_EMAIL_DRAFT_KEY);
}
