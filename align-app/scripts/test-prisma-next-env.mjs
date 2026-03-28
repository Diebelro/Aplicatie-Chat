/**
 * Încarcă .env apoi .env.local (ca Next) și testează Prisma. Fără output secret.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[key] = v;
  }
  return out;
}

const merged = { ...parseEnvFile(join(root, ".env")), ...parseEnvFile(join(root, ".env.local")) };

if (!merged.DATABASE_URL) {
  console.error("FAIL: lipsește DATABASE_URL după fuziune .env + .env.local");
  process.exit(1);
}

process.env.DATABASE_URL = merged.DATABASE_URL;

const prisma = new PrismaClient();
try {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.log("OK: conexiune Prisma reușită cu același env ca Next.js (.env apoi .env.local).");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("FAIL:", msg);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
