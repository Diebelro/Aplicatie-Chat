/**
 * Token-uri de resetare parolă (în memorie).
 * Producție: înlocuiește cu tabel password_reset_tokens în DB.
 */

import crypto from "crypto";

const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minute

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  used: boolean;
}

const tokensByToken = new Map<string, PasswordResetToken>();
const tokensByUserId = new Map<string, PasswordResetToken[]>();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function createPasswordResetToken(userId: string): { id: string; token: string } {
  const token = generateToken();
  const id = generateId();
  const expiresAt = Date.now() + RESET_TOKEN_EXPIRY_MS;
  const entry: PasswordResetToken = { id, userId, token, expiresAt, used: false };
  tokensByToken.set(token, entry);
  const list = tokensByUserId.get(userId) ?? [];
  list.push(entry);
  tokensByUserId.set(userId, list);
  return { id, token };
}

/** Spec: createResetToken(userId) – returnează token pentru link. */
export function createResetToken(userId: string): { token: string } {
  const { token } = createPasswordResetToken(userId);
  return { token };
}

export function findResetToken(token: string): PasswordResetToken | null {
  const entry = tokensByToken.get(token);
  if (!entry) return null;
  if (entry.used) return null;
  if (Date.now() > entry.expiresAt) {
    tokensByToken.delete(token);
    return null;
  }
  return entry;
}

/** Spec: validateResetToken(token) – true dacă token existent, neexpirat, nefolosit. */
export function validateResetToken(token: string): boolean {
  return findResetToken(token) !== null;
}

export function markResetTokenUsed(token: string): void {
  const entry = tokensByToken.get(token);
  if (entry) entry.used = true;
}

/** Alias pentru markResetTokenUsed (folosit în API). */
export function markTokenUsed(token: string): void {
  markResetTokenUsed(token);
}
