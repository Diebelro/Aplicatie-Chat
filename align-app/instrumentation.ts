import { logDevPrismaNoticeOnce } from "@/lib/dev-prisma-notice";
import { recordUncaughtProcessError } from "@/lib/serverErrorRing";

/** Rulează o dată la pornirea serverului Node (Next.js). */
export function register() {
  logDevPrismaNoticeOnce();
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  process.on("uncaughtException", (err) => {
    try {
      recordUncaughtProcessError("uncaughtException", err);
    } catch {
      /* ignore */
    }
  });
  process.on("unhandledRejection", (reason) => {
    try {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      recordUncaughtProcessError("unhandledRejection", err);
    } catch {
      /* ignore */
    }
  });
}
