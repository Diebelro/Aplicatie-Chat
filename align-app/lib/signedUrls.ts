/**
 * URL-uri semnate și expirabile pentru imagini interne și resurse premium.
 * Secretul trebuie setat în SIGNED_URL_SECRET (server-only).
 */

import crypto from "crypto";

const ALGORITHM = "sha256";
const DEFAULT_TTL_SEC = 3600; // 1 oră

function getSecret(): string {
  const secret = process.env.SIGNED_URL_SECRET;
  if (!secret || secret.length < 16) {
    return process.env.NODE_ENV === "production"
      ? crypto.randomBytes(32).toString("hex")
      : "dev-secret-min-16-chars";
  }
  return secret;
}

const DELIM = "|";

/** Generează semnătură HMAC pentru path + expiry. */
export function signPath(path: string, expiresAtMs?: number): string {
  const expiry = expiresAtMs ?? Date.now() + DEFAULT_TTL_SEC * 1000;
  const payload = `${path}${DELIM}${expiry}`;
  const hmac = crypto.createHmac(ALGORITHM, getSecret());
  hmac.update(payload);
  const sig = hmac.digest("hex").slice(0, 32);
  return `${payload}${DELIM}${sig}`;
}

/** Verifică semnătura și că nu e expirat. Returnează path-ul sau null. */
export function verifySignedToken(token: string): { path: string } | null {
  const lastDelim = token.lastIndexOf(DELIM);
  if (lastDelim <= 0) return null;
  const sig = token.slice(lastDelim + 1);
  const rest = token.slice(0, lastDelim);
  const prevDelim = rest.lastIndexOf(DELIM);
  if (prevDelim <= 0) return null;
  const path = rest.slice(0, prevDelim);
  const expiryStr = rest.slice(prevDelim + 1);
  const expiry = parseInt(expiryStr, 10);
  if (Number.isNaN(expiry) || Date.now() > expiry) return null;
  const expected = signPath(path, expiry);
  if (token !== expected) return null;
  return { path };
}

/** Construiește query string pentru URL semnat (path + expiry + sig). */
export function buildSignedQuery(path: string, ttlSec = DEFAULT_TTL_SEC): string {
  const expiresAtMs = Date.now() + ttlSec * 1000;
  const signed = signPath(path, expiresAtMs);
  return `s=${encodeURIComponent(signed)}`;
}
