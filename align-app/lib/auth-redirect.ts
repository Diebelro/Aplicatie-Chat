import { normalizeMarketingApexToChat } from "./appUrl";

/**
 * Logica callback-ului NextAuth `redirect` — extrasă pentru teste fără Prisma/DB.
 */
export function resolveNextAuthRedirect(url: string, baseUrl: string): string {
  const base = normalizeMarketingApexToChat(baseUrl.replace(/\/$/, ""));
  const baseOrigin = new URL(`${base}/`).origin;
  const u = url.startsWith("/") ? new URL(url, `${base}/`) : new URL(url);
  if (u.origin !== baseOrigin) return base;
  const path = u.pathname;
  if (path === "/api/auth/signin" || path === "/login" || path === "/signup") {
    return `${base}/descopera`;
  }
  return url;
}
