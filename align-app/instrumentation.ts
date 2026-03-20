import { logDevPrismaNoticeOnce } from "@/lib/dev-prisma-notice";

/** Rulează o dată la pornirea serverului Node (Next.js). */
export function register() {
  logDevPrismaNoticeOnce();
}
