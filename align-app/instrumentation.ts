import { logDevPrismaNoticeOnce } from "@/lib/dev-prisma-notice";

/** Rulează o dată la pornirea serverului (Next.js). Fără process.on aici — Turbopack analizează fișierul și pentru Edge. */
export function register() {
  logDevPrismaNoticeOnce();
}
