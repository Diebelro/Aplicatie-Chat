/**
 * Sesiuni: memorie (același proces) + PostgreSQL când există Prisma (producție / Vercel).
 * Cookie-ul align_sid conține tokenul sesiunii.
 */

import { randomBytes } from "crypto";
import { isPrismaAvailable } from "@/lib/repo-prisma";

const SESSION_COOKIE_NAME = "align_sid";
const SESSION_DURATION_MS = 45 * 60 * 1000; // 45 minute
const PERSISTENT_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 zile

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

export interface SessionEntry {
  userId: string;
  deviceId: string;
  expiresAt: number;
}

const globalStore = (typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {}) as {
  __align_sessions?: Map<string, SessionEntry>;
};
if (!globalStore.__align_sessions) globalStore.__align_sessions = new Map();
const sessions = globalStore.__align_sessions;

function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}

/** Doar memorie — folosit la clear în store in-memory. */
export function clearSessionFromMemory(sessionId: string): void {
  sessions.delete(sessionId);
}

export function clearAllSessionsForUserInMemory(userId: string): void {
  for (const [id, entry] of sessions.entries()) {
    if (entry.userId === userId) sessions.delete(id);
  }
}

function setMemorySession(sessionId: string, entry: SessionEntry): void {
  sessions.set(sessionId, entry);
}

function getMemorySession(sessionId: string): SessionEntry | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return entry;
}

/**
 * Rezolvă sesiunea: întâi memorie (aceeași instanță), apoi baza de date dacă e configurată.
 */
export async function getSessionAsync(sessionId: string): Promise<SessionEntry | null> {
  const mem = getMemorySession(sessionId);
  if (mem) return mem;
  if (!isPrismaAvailable()) return null;
  const { prismaSessionFind } = await import("./sessionPrisma");
  const row = await prismaSessionFind(sessionId);
  if (!row) return null;
  const entry: SessionEntry = {
    userId: row.userId,
    deviceId: row.deviceId,
    expiresAt: row.expiresAtMs,
  };
  setMemorySession(sessionId, entry);
  return entry;
}

export async function createSessionAsync(
  userId: string,
  deviceId: string,
  persistent: boolean
): Promise<{ sessionId: string; maxAgeSeconds: number }> {
  const sessionId = generateSessionId();
  const durationMs = persistent ? PERSISTENT_DURATION_MS : SESSION_DURATION_MS;
  const expiresAt = Date.now() + durationMs;
  const entry: SessionEntry = { userId, deviceId, expiresAt };
  setMemorySession(sessionId, entry);
  const maxAgeSeconds = persistent ? Math.floor(PERSISTENT_DURATION_MS / 1000) : 0;

  if (isPrismaAvailable()) {
    try {
      const { prismaSessionCreate } = await import("./sessionPrisma");
      await prismaSessionCreate({
        token: sessionId,
        userId,
        deviceId,
        expiresAt: new Date(expiresAt),
      });
    } catch (e) {
      console.error("[sessions] prisma create failed", e);
      if (process.env.NODE_ENV === "production") {
        throw e;
      }
    }
  }

  return { sessionId, maxAgeSeconds };
}

export async function deleteSessionAsync(sessionId: string): Promise<void> {
  sessions.delete(sessionId);
  if (isPrismaAvailable()) {
    try {
      const { prismaSessionDelete } = await import("./sessionPrisma");
      await prismaSessionDelete(sessionId);
    } catch {
      /* ignore */
    }
  }
}

export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  clearAllSessionsForUserInMemory(userId);
  if (isPrismaAvailable()) {
    try {
      const { prismaSessionDeleteAllForUser } = await import("./sessionPrisma");
      await prismaSessionDeleteAllForUser(userId);
    } catch (e) {
      console.error("[sessions] prisma deleteAllForUser failed", e);
    }
  }
}

export function getSessionCloudOptions(maxAgeSeconds: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge?: number;
} {
  const opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge?: number;
  } = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    /** Lax: același comportament ca majoritatea app-urilor web; Strict poate tăia cookie-ul la navigări între domenii/subdomenii. */
    sameSite: "lax",
    path: "/",
  };
  if (maxAgeSeconds > 0) opts.maxAge = maxAgeSeconds;
  return opts;
}

/** @deprecated alias — folosește getSessionCookieOptions din apeluri vechi */
export function getSessionCookieOptions(maxAgeSeconds: number) {
  return getSessionCloudOptions(maxAgeSeconds);
}
