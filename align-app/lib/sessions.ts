/**
 * Sesiuni în memorie: sessionId -> { userId, deviceId, expiresAt }.
 * Cookie-ul align_sid conține sessionId. La request autenticat actualizăm lastUsedAt pe device.
 * Folosim globalThis ca același Map să fie folosit de toate rutele API (login și /api/me).
 */

const SESSION_COOKIE_NAME = "align_sid";
const SESSION_DURATION_MS = 45 * 60 * 1000; // 45 minute
const PERSISTENT_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 zile

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

interface SessionEntry {
  userId: string;
  deviceId: string;
  expiresAt: number;
}

const globalStore = (typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {}) as { __align_sessions?: Map<string, SessionEntry> };
if (!globalStore.__align_sessions) globalStore.__align_sessions = new Map();
const sessions = globalStore.__align_sessions;

function generateSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function createSession(
  userId: string,
  deviceId: string,
  persistent: boolean
): { sessionId: string; maxAgeSeconds: number } {
  const sessionId = generateSessionId();
  const durationMs = persistent ? PERSISTENT_DURATION_MS : SESSION_DURATION_MS;
  sessions.set(sessionId, {
    userId,
    deviceId,
    expiresAt: Date.now() + durationMs,
  });
  const maxAgeSeconds = persistent ? Math.floor(PERSISTENT_DURATION_MS / 1000) : 0; // 0 = session cookie
  return { sessionId, maxAgeSeconds };
}

export function getSession(sessionId: string): SessionEntry | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return entry;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function deleteAllSessionsForUser(userId: string): void {
  for (const [id, entry] of sessions.entries()) {
    if (entry.userId === userId) sessions.delete(id);
  }
}

export function getSessionCookieOptions(maxAgeSeconds: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge?: number;
} {
  const opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    path: string;
    maxAge?: number;
  } = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  };
  if (maxAgeSeconds > 0) opts.maxAge = maxAgeSeconds;
  return opts;
}
