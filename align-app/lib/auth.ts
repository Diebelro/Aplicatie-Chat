/**
 * Hash și verificare parolă: bcryptjs (nou) + fallback scrypt (legacy).
 * bcryptjs is pure JS, no native build — works on Windows and with Next.js.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";

const KEY_LEN = 64;
const BCRYPT_ROUNDS = 10;

/** Email pentru login/signup: trim, lowercase, Unicode normalizat (evită duplicate „invizibile”). */
export function normalizeAuthEmail(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKC");
}

/** Hash parolă cu bcrypt (folosit la signup și reset). */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Verifică parola: acceptă hash bcrypt ($2...) sau legacy scrypt (salt:hash).
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("$2")) {
    return bcrypt.compareSync(password, stored);
  }
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const computed = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return computed === hash;
}
