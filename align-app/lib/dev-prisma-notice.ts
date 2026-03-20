/**
 * Un singur mesaj în consolă: dev + DATABASE_URL → folosim Prisma (nu memoria).
 * Apelat din instrumentation (boot) și din isPrismaAvailable (fallback dacă lipsește hook-ul).
 */
let devPrismaNoticeShown = false;

export function logDevPrismaNoticeOnce(): void {
  if (devPrismaNoticeShown) return;
  if (process.env.NODE_ENV === "production") return;
  if (!process.env.DATABASE_URL) return;
  devPrismaNoticeShown = true;
  console.warn("[DEV] Using Prisma because DATABASE_URL is set");
}
