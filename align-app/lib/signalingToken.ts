import crypto from "crypto";

export type SignalingTokenPayload = { sub: string; exp: number };

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createSignalingToken(userId: string, secret: string, ttlMs: number): string {
  const payload: SignalingTokenPayload = {
    sub: userId,
    exp: Date.now() + ttlMs,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySignalingToken(token: string, secret: string): SignalingTokenPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = b64url(crypto.createHmac("sha256", secret).update(body).digest());
    const expBuf = Buffer.from(expected);
    const sigBuf = Buffer.from(sig);
    if (expBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expBuf, sigBuf)) {
      return null;
    }
    const json = Buffer.from(body, "base64url").toString("utf8");
    const payload = JSON.parse(json) as SignalingTokenPayload;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
