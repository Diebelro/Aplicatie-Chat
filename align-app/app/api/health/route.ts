import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPrismaAvailable } from "@/lib/repo-prisma";
import { maybeNotifyOpsCritical } from "@/lib/opsCriticalNotify";

/**
 * Health public pentru uptime (UptimeRobot, load balancer). Fără date sensibile.
 * `ok: false` doar dacă DB e configurată dar nu răspunde.
 */
export async function GET() {
  const t0 = Date.now();
  if (!process.env.DATABASE_URL || !isPrismaAvailable()) {
    return NextResponse.json({
      ok: true,
      app: "up",
      database: "skipped",
      ms: Date.now() - t0,
    });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      app: "up",
      database: "up",
      ms: Date.now() - t0,
    });
  } catch {
    maybeNotifyOpsCritical({
      overall: "critical",
      overallReasons: ["Baza de date nu răspunde (health check)"],
      generatedAt: new Date().toISOString(),
      source: "health",
    });
    return NextResponse.json(
      {
        ok: false,
        app: "up",
        database: "down",
        ms: Date.now() - t0,
      },
      { status: 503 }
    );
  }
}
