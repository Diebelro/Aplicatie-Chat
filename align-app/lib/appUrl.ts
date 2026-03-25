/**
 * Bază URL pentru link-uri puse în email (reset parolă, verificare adresă).
 *
 * Ordinea (server-side):
 * 1. **EMAIL_PUBLIC_APP_URL** — opțional, doar pentru link-uri din email (override clar).
 * 2. **PUBLIC_APP_URL** — recomandat: domeniul public al aplicației (ex. `https://chat.diebel.ro`).
 * 3. **NEXT_PUBLIC_APP_URL** — fallback.
 * 4. `http://localhost:3005` — doar dacă lipsește tot.
 *
 * În **production**, dacă URL-ul rezolvat e exact apex **`https://diebel.ro`** (certificatul site-ului
 * firmă de obicei nu acoperă același app ca `chat.diebel.ro`), îl înlocuim automat cu
 * **`https://chat.diebel.ro`** ca să nu se mai trimită linkuri care duc la `NET::ERR_CERT_COMMON_NAME_INVALID`.
 *
 * În producție pe Vercel: setează `PUBLIC_APP_URL` și `NEXT_PUBLIC_APP_URL` la același HTTPS al chat-ului.
 */

function trimEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

const CHAT_PUBLIC_FALLBACK = "https://chat.diebel.ro";

/** În producție: evită linkuri email către apex diebel.ro (TLS greșit / alt vhost). */
function normalizeEmailBaseUrlInProduction(url: string): string {
  if (process.env.NODE_ENV !== "production") return url;
  if (process.env.DISABLE_DIEBEL_APEX_EMAIL_REDIRECT === "1") return url;

  try {
    const u = new URL(url);
    if (u.hostname === "diebel.ro" && !u.port) {
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
 * (fără trailing slash; în production normalizare apex diebel.ro → chat.diebel.ro)
 */
export function getPublicAppUrl(): string {
  const fromEmail = trimEnv(process.env.EMAIL_PUBLIC_APP_URL);
  const fromPublic = trimEnv(process.env.PUBLIC_APP_URL);
  const fromNext = trimEnv(process.env.NEXT_PUBLIC_APP_URL);
  let resolved =
    fromEmail || fromPublic || fromNext || "http://localhost:3005";

  resolved = normalizeEmailBaseUrlInProduction(resolved);

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
