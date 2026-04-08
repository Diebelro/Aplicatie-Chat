/**
 * Valori multilinie / PEM din Vercel sau .env: uneori vin cu ghilimele exterioare
 * sau cu `\n` literal în loc de newline. Folosit pentru FIREBASE_PRIVATE_KEY,
 * APNS_PRIVATE_KEY, VAPID_PRIVATE_KEY — fără a loga valori.
 */
export function normalizeMultilineEnv(value: string | undefined): string {
  if (value == null) return "";
  let s = value.trim();
  if (s.length >= 2) {
    const open = s[0];
    const close = s[s.length - 1];
    if ((open === '"' || open === "'") && close === open) {
      s = s.slice(1, -1).trim();
    }
  }
  return s.replace(/\\n/g, "\n");
}
