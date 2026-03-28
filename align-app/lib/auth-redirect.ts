/**
 * Logica callback-ului NextAuth `redirect` — extrasă pentru teste fără Prisma/DB.
 */
export function resolveNextAuthRedirect(url: string, baseUrl: string): string {
  const u = url.startsWith("/") ? new URL(url, baseUrl) : new URL(url);
  if (u.origin !== baseUrl) return baseUrl;
  const path = u.pathname;
  if (path === "/api/auth/signin" || path === "/login" || path === "/signup") {
    return `${baseUrl}/descopera`;
  }
  return url;
}
