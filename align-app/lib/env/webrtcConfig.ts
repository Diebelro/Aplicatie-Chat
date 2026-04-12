import { z } from "zod";

const jsonStringArray = z
  .string()
  .optional()
  .transform((s) => {
    if (!s?.trim()) return [] as string[];
    try {
      const v = JSON.parse(s) as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [] as string[];
    }
  });

const wsUrlOptional = z
  .string()
  .min(1)
  .refine((s) => s.startsWith("ws://") || s.startsWith("wss://"), "Trebuie ws:// sau wss://")
  .optional();

/** Variabile publice (browser + server unde e nevoie). */
export const webrtcPublicEnvSchema = z.object({
  NEXT_PUBLIC_TURN_URLS: jsonStringArray,
  NEXT_PUBLIC_SIGNALING_WS_URL: wsUrlOptional,
  /** Dacă lipsește din .env → considerăm activ (când există URL semnalizare). */
  NEXT_PUBLIC_WEBRTC_ENABLED: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return true;
      return v === "true" || v === "1";
    }),
  CALL_MAX_MINUTES: z.coerce.number().min(1).max(480).default(30),
  CALL_MAX_BITRATE_DESKTOP: z.coerce.number().min(200_000).max(8_000_000).default(2_500_000),
  CALL_MAX_BITRATE_MOBILE: z.coerce.number().min(100_000).max(4_000_000).default(1_200_000),
  FEATURE_SCREENSHARE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** Client (Vercel): trebuie setat explicit pentru share în browser; poate fi același intent ca FEATURE_SCREENSHARE. */
  NEXT_PUBLIC_FEATURE_SCREENSHARE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

const webrtcSecretsInput = z.object({
  TURN_AUTH_SECRET: z.string().min(16, "TURN_AUTH_SECRET min 16 caractere"),
  SIGNALING_TOKEN_SECRET: z.string().min(16).optional(),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
});

/** Doar server (API + signaling process). */
export const webrtcServerSecretsSchema = webrtcSecretsInput
  .transform((o) => ({
    turnSecret: o.TURN_AUTH_SECRET,
    signalingSecret: o.SIGNALING_TOKEN_SECRET ?? o.NEXTAUTH_SECRET ?? "",
  }))
  .refine((o) => o.signalingSecret.length >= 16, {
    message: "Setează SIGNALING_TOKEN_SECRET sau NEXTAUTH_SECRET (min 16 caractere).",
  });

export type WebrtcPublicConfig = z.infer<typeof webrtcPublicEnvSchema>;

function readProcessEnv(): Record<string, string | undefined> {
  return process.env as Record<string, string | undefined>;
}

export function getWebrtcPublicConfig(): WebrtcPublicConfig {
  return webrtcPublicEnvSchema.parse(readProcessEnv());
}

export function getTurnUrlsFromEnv(): string[] {
  return getWebrtcPublicConfig().NEXT_PUBLIC_TURN_URLS;
}

/** Validează secretele pentru rutele care emit credențiale TURN / token WS. */
export function parseTurnAndSignalingSecrets():
  | { ok: true; turnSecret: string; signalingSecret: string }
  | { ok: false; error: string } {
  const raw = readProcessEnv();
  const merged = webrtcServerSecretsSchema.safeParse({
    TURN_AUTH_SECRET: raw.TURN_AUTH_SECRET,
    SIGNALING_TOKEN_SECRET: raw.SIGNALING_TOKEN_SECRET,
    NEXTAUTH_SECRET: raw.NEXTAUTH_SECRET,
  });
  if (!merged.success) {
    return { ok: false, error: merged.error.issues.map((e) => e.message).join("; ") };
  }
  return {
    ok: true,
    turnSecret: merged.data.turnSecret,
    signalingSecret: merged.data.signalingSecret,
  };
}

/**
 * Secret pentru `GET /api/call/signaling-token` (HMAC token WS).
 * Dacă `parseTurnAndSignalingSecrets` reușește (TURN_AUTH + semnalizare), folosim acel `signalingSecret`.
 * Altfel: **fallback** cu `SIGNALING_TOKEN_SECRET` sau `NEXTAUTH_SECRET` (≥16) — același secret ca pe
 * `call-signaling-server.mjs` — ca să meargă semnalizarea înainte/după coturn; ICE poate folosi doar STUN
 * (vezi `/api/call/ice-config` când lipsește TURN complet).
 */
export function getSignalingSecretForWsToken():
  | { ok: true; signalingSecret: string }
  | { ok: false; error: string } {
  const full = parseTurnAndSignalingSecrets();
  if (full.ok) return { ok: true, signalingSecret: full.signalingSecret };

  const raw = readProcessEnv();
  const sig = raw.SIGNALING_TOKEN_SECRET?.trim() ?? "";
  const nav = raw.NEXTAUTH_SECRET?.trim() ?? "";
  const secret = sig || nav;
  if (secret.length >= 16) {
    return { ok: true, signalingSecret: secret };
  }
  return { ok: false, error: full.error };
}

export function isWebrtcConfigured(): boolean {
  const c = getWebrtcPublicConfig();
  return Boolean(c.NEXT_PUBLIC_SIGNALING_WS_URL?.trim()) && c.NEXT_PUBLIC_WEBRTC_ENABLED !== false;
}

/**
 * URL de bază pentru WebSocket semnalizare (injectat în client la build din `.env`).
 * Trebuie `ws://` (dev) sau `wss://` (producție). Path final: `/ws` + `?token=` (vezi `signalingWsConnectUrl`).
 *
 * Vercel: **nu** poți folosi același deployment fără proxy — pune un host care rulează
 * `call-signaling-server.mjs` (ex. `wss://ws.diebel.ro/ws` sau `wss://chat.diebel.ro/api/ws`
 * doar dacă nginx pe VPS termină TLS și face upgrade către portul semnalizării).
 */
export function getPublicSignalingWsBaseUrl(): string | undefined {
  const v = getWebrtcPublicConfig().NEXT_PUBLIC_SIGNALING_WS_URL?.trim();
  return v || undefined;
}

/** Partajare ecran în client: NEXT_PUBLIC_* (sau FEATURE_* pe server în API routes). */
export function isScreenshareFeatureEnabled(): boolean {
  const c = getWebrtcPublicConfig();
  return Boolean(c.NEXT_PUBLIC_FEATURE_SCREENSHARE || c.FEATURE_SCREENSHARE);
}
