import crypto from "crypto";

/**
 * Credențiale TURN time-limited (coturn use-auth-secret + static-auth-secret).
 * @see https://github.com/coturn/coturn/blob/master/README.turnserver
 */
export function generateTurnCredentials(
  secret: string,
  ttlSeconds: number,
  sessionKey = "diebel"
): { username: string; credential: string; expiresAt: number } {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:${sessionKey}`;
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
  return { username, credential, expiresAt: expiry };
}
