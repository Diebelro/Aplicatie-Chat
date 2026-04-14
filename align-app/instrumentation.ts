import { logDevPrismaNoticeOnce } from "@/lib/dev-prisma-notice";
import { runTurnEnvStartupCheck } from "@/lib/webrtc/startupTurnCheck";

/** Rulează o dată la pornirea serverului (Next.js). Fără process.on aici — Turbopack analizează fișierul și pentru Edge. */
export function register() {
  logDevPrismaNoticeOnce();
  if (process.env.NEXT_RUNTIME === "edge") return;
  const turn = runTurnEnvStartupCheck();
  if (!turn.ok) {
    console.error(
      "FATAL: TURN IS REQUIRED – CALLS WILL NOT WORK\n" +
        turn.errors.map((e) => `  • ${e}`).join("\n") +
        "\n  REQUIRES MANUAL INFRA TEST (VPS / FIREWALL / 4G) after env is fixed."
    );
  }
}
