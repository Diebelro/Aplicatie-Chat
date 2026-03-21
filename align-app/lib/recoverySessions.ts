/**
 * Sesiuni de recuperare parolă prin scan QR (în memorie).
 * Producție: înlocuiește cu tabel recovery_sessions în DB.
 */

import crypto from "crypto";

const SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minute

export type RecoveryStatus = "pending" | "confirmed" | "used";

export interface RecoverySession {
  sessionId: string;
  qrToken: string;
  userId: string | null;
  status: RecoveryStatus;
  expiresAt: number;
}

const bySessionId = new Map<string, RecoverySession>();
const byQrToken = new Map<string, RecoverySession>();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function createRecoverySession(): { sessionId: string; qrToken: string } {
  const sessionId = generateToken();
  const qrToken = generateToken();
  const expiresAt = Date.now() + SESSION_EXPIRY_MS;
  const session: RecoverySession = {
    sessionId,
    qrToken,
    userId: null,
    status: "pending",
    expiresAt,
  };
  bySessionId.set(sessionId, session);
  byQrToken.set(qrToken, session);
  return { sessionId, qrToken };
}

function isExpired(s: RecoverySession): boolean {
  return Date.now() > s.expiresAt;
}

export function getRecoverySessionBySessionId(sessionId: string): RecoverySession | null {
  const s = bySessionId.get(sessionId);
  if (!s) return null;
  if (isExpired(s)) {
    bySessionId.delete(sessionId);
    byQrToken.delete(s.qrToken);
    return null;
  }
  return s;
}

export function getRecoverySessionByQrToken(qrToken: string): RecoverySession | null {
  const s = byQrToken.get(qrToken);
  if (!s) return null;
  if (isExpired(s)) {
    bySessionId.delete(s.sessionId);
    byQrToken.delete(qrToken);
    return null;
  }
  return s;
}

export function confirmRecoverySession(qrToken: string, userId: string): boolean {
  const s = byQrToken.get(qrToken);
  if (!s || isExpired(s)) return false;
  if (s.status !== "pending") return false;
  s.userId = userId;
  s.status = "confirmed";
  return true;
}

export function markRecoverySessionUsed(sessionId: string): boolean {
  const s = bySessionId.get(sessionId);
  if (!s || isExpired(s)) return false;
  if (s.status !== "confirmed" || !s.userId) return false;
  s.status = "used";
  return true;
}

/** Spec: confirmRecovery(qrToken, userId). */
export function confirmRecovery(qrToken: string, userId: string): boolean {
  return confirmRecoverySession(qrToken, userId);
}

export type RecoveryStatusResponse = "pending" | "confirmed" | "expired";

/** Spec: getRecoveryStatus(sessionId) – pentru polling; "expired" dacă lipsă sau expirată. */
export function getRecoveryStatus(sessionId: string): RecoveryStatusResponse {
  const s = bySessionId.get(sessionId);
  if (!s) return "expired";
  if (isExpired(s)) {
    bySessionId.delete(sessionId);
    byQrToken.delete(s.qrToken);
    return "expired";
  }
  if (s.status === "used") return "expired";
  if (s.status === "confirmed" && s.userId) return "confirmed";
  return "pending";
}

/**
 * Spec: consumeRecoverySession(sessionId) → userId.
 * Marchează sesiunea ca "used" și returnează userId; null dacă invalid/expirată.
 */
export function consumeRecoverySession(sessionId: string): string | null {
  const s = bySessionId.get(sessionId);
  if (!s || isExpired(s)) return null;
  if (s.status !== "confirmed" || !s.userId) return null;
  const userId = s.userId;
  s.status = "used";
  return userId;
}
