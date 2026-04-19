#!/usr/bin/env node
/**
 * Sets Vercel Production DIRECT_URL from Neon’s unpooled URL already on the project.
 *
 * Prereq (repo root, `.vercel` linked to `aplicatie-chat`):
 *   npx vercel env pull .env.vercel.production.pull --environment=production --yes
 * Then from `align-app`:
 *   npm run vercel:fix-direct-url
 *
 * Source value: `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING` from the pull file
 * (same DB as `DATABASE_URL`, host without `-pooler`). Replaces a wrong `DIRECT_URL` that
 * pointed at another endpoint or at `-pooler`.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const pullPath = path.join(root, ".env.vercel.production.pull");

function parseDotenv(content) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

function host(u) {
  try {
    const x = String(u || "").replace(/^postgres(ql)?:/i, "http:");
    return new URL(x).hostname || "";
  } catch {
    return "";
  }
}

function assertDirectNeonShape(url, label) {
  const h = host(url);
  if (!h) throw new Error(`${label}: empty URL`);
  if (!h.includes("neon.tech")) throw new Error(`${label}: host ${h} is not Neon`);
  if (h.includes("-pooler"))
    throw new Error(`${label}: host still has -pooler: ${h}`);
}

function main() {
  if (!fs.existsSync(pullPath)) {
    console.error("Missing pull file. Run from repo root:");
    console.error(
      "  npx vercel env pull .env.vercel.production.pull --environment=production --yes"
    );
    process.exit(1);
  }
  const env = parseDotenv(fs.readFileSync(pullPath, "utf8"));
  const pooled = env.DATABASE_URL || "";
  const direct =
    env.DATABASE_URL_UNPOOLED?.trim() ||
    env.POSTGRES_URL_NON_POOLING?.trim() ||
    "";
  assertDirectNeonShape(direct, "DATABASE_URL_UNPOOLED/POSTGRES_URL_NON_POOLING");
  const hp = host(pooled);
  const hd = host(direct);
  if (hp && hd) {
    const baseP = hp.replace(/-pooler\b/i, "");
    const baseD = hd.replace(/-pooler\b/i, "");
    if (baseP !== baseD) {
      console.warn(
        `Warning: pooled host stem "${baseP}" !== direct "${baseD}" — still using unpooled string from pull file.`
      );
    }
  }

  /** Windows: avoid `--value` (URLs break spawn argv); stdin is supported by Vercel CLI. */
  function vercelSpawn(args, input) {
    const r = spawnSync("npx", ["vercel", ...args], {
      cwd: root,
      shell: true,
      input: input ?? undefined,
      encoding: "utf-8",
      stdio: input != null ? ["pipe", "inherit", "inherit"] : "inherit",
    });
    if (r.status !== 0 && r.stderr) process.stderr.write(r.stderr);
    return r.status ?? 1;
  }

  console.log("Removing DIRECT_URL (production)…");
  vercelSpawn(["env", "rm", "DIRECT_URL", "production", "--yes"]);
  console.log("Adding DIRECT_URL (production, sensitive via stdin)…");
  const st = vercelSpawn(
    ["env", "add", "DIRECT_URL", "production", "--sensitive", "--yes"],
    `${direct}\n`
  );
  if (st !== 0) {
    console.error(`vercel env add failed for production (exit ${st})`);
    process.exit(st);
  }

  console.log(
    "Done (Production only). If you use Preview deployments, add DIRECT_URL for each Preview git branch in the Vercel UI (same Neon direct string as above), or run `vercel env add DIRECT_URL preview` interactively."
  );
  console.log("Redeploy Production: npm run deploy:chat (din align-app).");
}

main();
