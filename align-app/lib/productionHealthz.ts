/**
 * Snapshot sanitizat pentru /api/healthz — fără valori de env, fără stack traces.
 */

import { prisma } from "@/lib/db";
import { isPrismaAvailable } from "@/lib/repo-prisma";

const DB_PING_TIMEOUT_MS = 3500;

export const PRODUCTION_REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "EXPECTED_DB_ENV",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

export type ProductionRequiredEnvKey = (typeof PRODUCTION_REQUIRED_ENV_KEYS)[number];

function envSet(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

function safeHostnameFromHttpUrl(raw: string | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) return "";
  try {
    const u = new URL(t);
    return (u.hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

function safeHostnameFromDbUrl(raw: string | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) return "";
  try {
    const normalized = t.replace(/^postgres(ql)?:/i, "http:");
    const u = new URL(normalized);
    return (u.hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

function containsLiteralAmpEntity(raw: string | undefined): boolean {
  if (!raw) return false;
  return raw.includes("&amp;");
}

function isLikelyNeonHost(hostname: string): boolean {
  return hostname.includes("neon.tech");
}

export async function pingDatabase(
  timeoutMs = DB_PING_TIMEOUT_MS
): Promise<{ dbOk: true; ms: number } | { dbOk: false; error: string }> {
  if (!process.env.DATABASE_URL?.trim() || !isPrismaAvailable()) {
    return { dbOk: false, error: "DB_NOT_CONFIGURED" };
  }
  const t0 = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    return { dbOk: true, ms: Date.now() - t0 };
  } catch {
    return { dbOk: false, error: "DB_UNAVAILABLE" };
  }
}

export type ProductionHealthzJson = {
  ok: boolean;
  /** Același lucru ca dbPing.dbOk — comod pentru citire rapidă. */
  dbOk: boolean;
  /** true dacă EXPECTED_DB_ENV (după trim) este exact „prod” (litere mici). */
  expectedDbEnvProd: boolean;
  /** NEXTAUTH_SECRET are cel puțin 32 caractere (recomandare NextAuth). */
  nextAuthSecretMinLengthOk: boolean;
  requiredEnv: { name: ProductionRequiredEnvKey; set: boolean }[];
  urlChecks: {
    nextAuthHostname: string;
    nextPublicAppHostname: string;
    identical: boolean;
  };
  dbChecks: {
    databaseUrlHasPoolerInHostname: boolean;
    directUrlHasPoolerInHostname: boolean;
    databaseUrlContainsAmpEntity: boolean;
    directUrlContainsAmpEntity: boolean;
    /** true dacă ambele URL-uri par Neon și hostul pooled are „-pooler”, iar direct nu */
    neonPoolerShapeOk: boolean | null;
  };
  webrtcChecks: {
    nextPublicSignalingWsUrlSet: boolean;
    nextPublicTurnUrlsSet: boolean;
  };
  dbPing: { dbOk: boolean; ms?: number; error?: string };
  /** Pe Vercel: hash Git al deploymentului (VERCEL_GIT_COMMIT_SHA). Nu e secret — ajută la verificarea commitului. */
  gitSha?: string;
};

export async function getProductionHealthzSnapshot(): Promise<ProductionHealthzJson> {
  const requiredEnv = PRODUCTION_REQUIRED_ENV_KEYS.map((name) => ({
    name,
    set: envSet(name),
  }));

  const nau = process.env.NEXTAUTH_URL;
  const npu = process.env.NEXT_PUBLIC_APP_URL;
  const nextAuthHostname = safeHostnameFromHttpUrl(nau);
  const nextPublicAppHostname = safeHostnameFromHttpUrl(npu);
  const identical =
    !!nextAuthHostname &&
    !!nextPublicAppHostname &&
    nextAuthHostname === nextPublicAppHostname;

  const dbRaw = process.env.DATABASE_URL;
  const dirRaw = process.env.DIRECT_URL;
  const dbHost = safeHostnameFromDbUrl(dbRaw);
  const dirHost = safeHostnameFromDbUrl(dirRaw);

  const databaseUrlHasPoolerInHostname = dbHost.includes("-pooler");
  const directUrlHasPoolerInHostname = dirHost.includes("-pooler");

  let neonPoolerShapeOk: boolean | null = null;
  if (dbHost && isLikelyNeonHost(dbHost) && dirHost && isLikelyNeonHost(dirHost)) {
    neonPoolerShapeOk =
      databaseUrlHasPoolerInHostname && !directUrlHasPoolerInHostname;
  } else if (dbHost && isLikelyNeonHost(dbHost)) {
    neonPoolerShapeOk = databaseUrlHasPoolerInHostname;
  } else if (dirHost && isLikelyNeonHost(dirHost)) {
    neonPoolerShapeOk = !directUrlHasPoolerInHostname;
  }

  const dbPingResult = await pingDatabase();

  const dbPing =
    dbPingResult.dbOk === true
      ? { dbOk: true as const, ms: dbPingResult.ms }
      : { dbOk: false as const, error: dbPingResult.error };

  const requiredOk = requiredEnv.every((e) => e.set);
  const noAmp =
    !containsLiteralAmpEntity(dbRaw) && !containsLiteralAmpEntity(dirRaw);

  const neonShapeFails = neonPoolerShapeOk === false;

  const expectedDbEnvProd =
    (process.env.EXPECTED_DB_ENV ?? "").trim().toLowerCase() === "prod";

  const secretLen = process.env.NEXTAUTH_SECRET?.trim().length ?? 0;
  const nextAuthSecretMinLengthOk = secretLen >= 32;

  const ok =
    requiredOk &&
    identical &&
    noAmp &&
    dbPing.dbOk &&
    !neonShapeFails &&
    expectedDbEnvProd &&
    nextAuthSecretMinLengthOk;

  const deployGitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();

  return {
    ok,
    dbOk: dbPing.dbOk,
    expectedDbEnvProd,
    nextAuthSecretMinLengthOk,
    requiredEnv,
    urlChecks: {
      nextAuthHostname,
      nextPublicAppHostname,
      identical,
    },
    dbChecks: {
      databaseUrlHasPoolerInHostname,
      directUrlHasPoolerInHostname,
      databaseUrlContainsAmpEntity: containsLiteralAmpEntity(dbRaw),
      directUrlContainsAmpEntity: containsLiteralAmpEntity(dirRaw),
      neonPoolerShapeOk,
    },
    webrtcChecks: {
      nextPublicSignalingWsUrlSet: envSet("NEXT_PUBLIC_SIGNALING_WS_URL"),
      nextPublicTurnUrlsSet: envSet("NEXT_PUBLIC_TURN_URLS"),
    },
    dbPing,
    ...(deployGitSha ? { gitSha: deployGitSha } : {}),
  };
}
