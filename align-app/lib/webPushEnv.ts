/**
 * VAPID pentru Web Push în browser. Generează chei: `npx web-push generate-vapid-keys`
 */

import { normalizeMultilineEnv } from "@/lib/env/normalizeMultilineEnv";

/** Cheie privată VAPID normalizată (aceeași logică la verificare și la trimitere). */
export function getVapidPrivateKey(): string {
  return normalizeMultilineEnv(process.env.VAPID_PRIVATE_KEY);
}

/** Cheie publică VAPID (elimină ghilimele exterioare dacă au fost copiate din Vercel). */
export function getVapidPublicKey(): string {
  return normalizeMultilineEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

export function isWebPushConfigured(): boolean {
  const pub = getVapidPublicKey();
  const priv = getVapidPrivateKey();
  const sub = (process.env.VAPID_SUBJECT ?? process.env.VAPID_CONTACT ?? "mailto:support@example.com").trim();
  return Boolean(pub && priv && sub.length > 3);
}

export function getVapidPublicKeyForClient(): string | undefined {
  const k = getVapidPublicKey();
  return k || undefined;
}

export function getVapidSubject(): string {
  return (
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.VAPID_CONTACT?.trim() ||
    "mailto:support@example.com"
  );
}
