/**
 * Bază URL pentru link-uri puse în email (reset parolă, verificare adresă).
 *
 * Ordinea (server-side):
 * 1. **PUBLIC_APP_URL** — recomandat pentru email: domeniul live (ex. `https://chat.diebel.ro`),
 *    fără să fie neapărat același cu ce folosești în browser la dev.
 * 2. **NEXT_PUBLIC_APP_URL** — fallback (client + server).
 * 3. `http://localhost:3005` — doar dacă lipsește tot.
 *
 * În producție pe Vercel: setează ambele la același URL HTTPS al aplicației.
 */

function trimEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

let loggedPublicUrlOnce = false;

/**
 * PUBLIC_APP_URL → NEXT_PUBLIC_APP_URL → http://localhost:3005
 * (fără trailing slash)
 */
export function getPublicAppUrl(): string {
  const fromPublic = trimEnv(process.env.PUBLIC_APP_URL);
  const fromNext = trimEnv(process.env.NEXT_PUBLIC_APP_URL);
  const resolved =
    fromPublic || fromNext || "http://localhost:3005";

  if (process.env.NODE_ENV === "development" && !loggedPublicUrlOnce) {
    loggedPublicUrlOnce = true;
    console.info(
      "[appUrl] getPublicAppUrl() =",
      resolved,
      "| PUBLIC_APP_URL=",
      process.env.PUBLIC_APP_URL?.trim() || "(unset)",
      "| NEXT_PUBLIC_APP_URL=",
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "(unset)"
    );
  }

  return resolved;
}
