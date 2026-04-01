/**
 * VAPID pentru Web Push în browser. Generează chei: `npx web-push generate-vapid-keys`
 */

export function isWebPushConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const sub = (process.env.VAPID_SUBJECT ?? process.env.VAPID_CONTACT ?? "mailto:support@example.com").trim();
  return Boolean(pub && priv && sub.length > 3);
}

export function getVapidPublicKeyForClient(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || undefined;
}

export function getVapidSubject(): string {
  return (
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.VAPID_CONTACT?.trim() ||
    "mailto:support@example.com"
  );
}
