/**
 * Bază URL pentru link-uri puse în email (reset parolă, verificare adresă).
 *
 * Ordinea (server-side):
 * 1. **EMAIL_PUBLIC_APP_URL** — opțional, doar pentru link-uri din email (override clar).
 * 2. **PUBLIC_APP_URL** — recomandat: domeniul public al aplicației (ex. `https://chat.diebel.ro`).
 * 3. **NEXT_PUBLIC_APP_URL** — fallback.
 * 4. **`http://localhost:3005`** (doar development dacă lipsește tot) sau **`https://chat.diebel.ro`** în `production`.
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

/**
 * NextAuth `NEXTAUTH_URL` / callback `baseUrl`: dacă în env e apex-ul marketing (`diebel.ro`),
 * autentificarea și SessionProvider pe mobil te duc pe site-ul greșit. Aliniem la hostul chat.
 * (Aceeași regulă ca la email; dezactivare: `DISABLE_DIEBEL_APEX_EMAIL_REDIRECT=1`.)
 */
export function normalizeMarketingApexToChat(url: string): string {
  let t = trimEnv(url);
  if (!t) return t;
  if (!t.includes("://")) t = `https://${t}`;
  return normalizeApexDiebelForEmail(t);
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
  const fallbackBase =
    process.env.NODE_ENV === "production" ? CHAT_PUBLIC_FALLBACK : "http://localhost:3005";
  let resolved = fromEmail || fromPublic || fromNext || fallbackBase;

  resolved = normalizeApexDiebelForEmail(resolved);

  /** Env gol / doar „/” / host fără schemă → `new URL()` pică la `next build` (Vercel Preview fără .env). */
  const t = resolved.trim();
  if (!t || !/^https?:\/\//i.test(t)) {
    return fallbackBase;
  }

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
