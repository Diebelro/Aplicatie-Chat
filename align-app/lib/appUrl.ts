/**
 * Bază URL pentru link-uri puse în email (reset parolă, verificare adresă).
 *
 * Ordinea (server-side):
 * 1. **EMAIL_PUBLIC_APP_URL** — opțional, doar pentru link-uri din email (override clar).
 * 2. **PUBLIC_APP_URL** — recomandat: domeniul public al aplicației (ex. `https://chat.diebel.ro`).
 * 3. **NEXT_PUBLIC_APP_URL** — fallback.
 * 4. `http://localhost:3005` — doar dacă lipsește tot.
 *
 * Dacă baza rezolvată e **`diebel.ro`** sau **`www.diebel.ro`** (apex-ul site-ului firmă — cert greșit
 * pentru app), o înlocuim cu **`https://chat.diebel.ro`**. Regula rulează **mereu** (nu doar la
 * `NODE_ENV=production`), ca să nu depindem de cum setează platforma `NODE_ENV` în serverless.
 * Dezactivezi cu **`DISABLE_DIEBEL_APEX_EMAIL_REDIRECT=1`**.
 *
 * În producție pe Vercel: setează `PUBLIC_APP_URL` și `NEXT_PUBLIC_APP_URL` la același HTTPS al chat-ului.
 */

function trimEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

const CHAT_PUBLIC_FALLBACK = "https://chat.diebel.ro";

/** Apex diebel.ro / www → chat (cert + vhost aplicație). */
function normalizeApexDiebelForEmail(url: string): string {
  if (process.env.DISABLE_DIEBEL_APEX_EMAIL_REDIRECT === "1") return url;

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!u.port && (host === "diebel.ro" || host === "www.diebel.ro")) {
      return CHAT_PUBLIC_FALLBACK;
    }
  } catch {
    return url;
  }
  return url;
}

let loggedPublicUrlOnce = false;

/**
 * EMAIL_PUBLIC_APP_URL → PUBLIC_APP_URL → NEXT_PUBLIC_APP_URL → localhost
 * (fără trailing slash; normalizare apex diebel.ro → chat.diebel.ro)
 */
export function getPublicAppUrl(): string {
  const fromEmail = trimEnv(process.env.EMAIL_PUBLIC_APP_URL);
  const fromPublic = trimEnv(process.env.PUBLIC_APP_URL);
  const fromNext = trimEnv(process.env.NEXT_PUBLIC_APP_URL);
  let resolved =
    fromEmail || fromPublic || fromNext || "http://localhost:3005";

  resolved = normalizeApexDiebelForEmail(resolved);

  if (process.env.NODE_ENV === "development" && !loggedPublicUrlOnce) {
    loggedPublicUrlOnce = true;
    console.info(
      "[appUrl] getPublicAppUrl() =",
      resolved,
      "| EMAIL_PUBLIC_APP_URL=",
      process.env.EMAIL_PUBLIC_APP_URL?.trim() || "(unset)",
      "| PUBLIC_APP_URL=",
      process.env.PUBLIC_APP_URL?.trim() || "(unset)",
      "| NEXT_PUBLIC_APP_URL=",
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "(unset)"
    );
  }

  return resolved;
}
