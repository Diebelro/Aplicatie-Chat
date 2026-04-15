/**
 * Snapshot operațional pentru panoul admin („bord”).
 */

import { prisma } from "@/lib/db";
import { isPrismaAvailable } from "@/lib/repo-prisma";
import { getAdminProductHealth, productHealthShortStrip } from "@/lib/adminProductHealth";
import { getSecurityThreatsSnapshot } from "@/lib/securityThreats";
import { getServerErrorStats } from "@/lib/serverErrorRing";
import { getLatestVitals } from "@/lib/vitalsStore";
import { getRateLimitBucketApproxSize } from "@/lib/rateLimit";
import { maybeNotifyOpsCritical } from "@/lib/opsCriticalNotify";

const MB = 1024 * 1024;

export type DbStatus = "up" | "down" | "skipped";

export async function getAdminSystemSnapshot(): Promise<{
  generatedAt: string;
  environment: string;
  nodeVersion: string;
  uptimeSec: number;
  memory: { heapUsedMb: number; rssMb: number; heapTotalMb: number };
  db: { status: DbStatus; latencyMs?: number; detail?: string };
  security: ReturnType<typeof getSecurityThreatsSnapshot> & { windowMinutes: number };
  errors: ReturnType<typeof getServerErrorStats> & { windowMinutes: number };
  errors1h: { count: number };
  vitals: ReturnType<typeof getLatestVitals>;
  rateLimitBucketsApprox: number;
  /** Apeluri (WebRTC), semnalizare /health, mesaje în DB */
  product: Awaited<ReturnType<typeof getAdminProductHealth>> & { shortStrip: string };
  /** Rezumat pentru UI: verde / galben / roșu */
  overall: "ok" | "warn" | "critical";
  overallReasons: string[];
}> {
  const generatedAt = new Date().toISOString();
  const mem = process.memoryUsage();
  const env = process.env.NODE_ENV ?? "unknown";
  const security = getSecurityThreatsSnapshot(15 * 60 * 1000);
  const errors15 = getServerErrorStats(15 * 60 * 1000);
  const errors1h = getServerErrorStats(60 * 60 * 1000);
  const vitals = getLatestVitals();

  let db: { status: DbStatus; latencyMs?: number; detail?: string };
  if (!process.env.DATABASE_URL || !isPrismaAvailable()) {
    db = {
      status: "skipped",
      detail: "DATABASE_URL / Prisma indisponibil — mod demo sau env lipsă",
    };
  } else {
    const t0 = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const ms = Date.now() - t0;
      db = { status: "up", latencyMs: ms };
    } catch (e) {
      db = {
        status: "down",
        latencyMs: Date.now() - t0,
        detail: e instanceof Error ? e.message.slice(0, 500) : "Eroare DB",
      };
    }
  }

  const reasons: string[] = [];
  let overall: "ok" | "warn" | "critical" = "ok";

  if (db.status === "down") {
    overall = "critical";
    reasons.push("Baza de date nu răspunde");
  }
  if (errors15High(errors15.count)) {
    overall = bump(overall, errors15.count >= 8 ? "critical" : "warn");
    if (errors15.count >= 8) reasons.push("Multe erori server în ultimele 15 min");
    else reasons.push("Erori server în ultimele 15 min");
  }
  if (security.shouldAlert || security.highCount > 0) {
    overall = bump(overall, security.highCount >= 3 ? "critical" : "warn");
    reasons.push("Activitate securitate ridicată (vezi Securitate)");
  }
  if (db.status === "up" && db.latencyMs != null && db.latencyMs > 800) {
    overall = bump(overall, "warn");
    reasons.push("Latentă DB ridicată");
  }
  /** Pe Vercel serverless, Next + Prisma depășesc des ~500 MB fără leak; praguri mai realiste ca să nu fie mereu galben. */
  const heapMb = mem.heapUsed / MB;
  if (heapMb > 700) {
    overall = bump(overall, heapMb > 1100 ? "critical" : "warn");
    reasons.push("Memorie heap ridicată");
  }
  const avgLcp = vitals.avgLcpLast20;
  if (avgLcp != null && avgLcp > 3500) {
    overall = bump(overall, "warn");
    reasons.push("LCP mediu lent (experiență în browser)");
  }

  const dbUp = db.status === "up";
  const product = await getAdminProductHealth({ dbUp });
  const shortStrip = productHealthShortStrip(product);

  if (!product.webrtc.envLayerCompleteForCalls) {
    overall = bump(overall, "warn");
    reasons.push("Apeluri (video/voce): variabile lipsă sau incomplete — vezi bord „Apeluri & mesaje”");
  }
  if (product.signalingHealth.checked && product.signalingHealth.ok === false) {
    overall = bump(overall, "warn");
    reasons.push(
      `Semnalizare apeluri: ${product.signalingHealth.error ?? "fără răspuns"} (${product.signalingHealth.url ?? "?"})`
    );
  }
  if (!product.messages.skipped && !product.messages.ok) {
    overall = bump(overall, "critical");
    reasons.push("Mesaje: citire din baza de date eșuată");
  }

  maybeNotifyOpsCritical({
    overall,
    overallReasons: reasons,
    generatedAt,
    source: "snapshot",
  });

  return {
    generatedAt,
    environment: env,
    nodeVersion: process.version,
    uptimeSec: Math.floor(process.uptime()),
    memory: {
      heapUsedMb: Math.round((mem.heapUsed / MB) * 10) / 10,
      rssMb: Math.round((mem.rss / MB) * 10) / 10,
      heapTotalMb: Math.round((mem.heapTotal / MB) * 10) / 10,
    },
    db,
    security: { ...security, windowMinutes: 15 },
    errors: { ...errors15, windowMinutes: 15 },
    errors1h: { count: errors1h.count },
    vitals,
    rateLimitBucketsApprox: getRateLimitBucketApproxSize(),
    product: { ...product, shortStrip },
    overall,
    overallReasons: reasons,
  };
}

function errors15High(n: number): boolean {
  return n >= 3;
}

function bump(
  current: "ok" | "warn" | "critical",
  next: "ok" | "warn" | "critical"
): "ok" | "warn" | "critical" {
  const rank = { ok: 0, warn: 1, critical: 2 };
  return rank[next] > rank[current] ? next : current;
}
