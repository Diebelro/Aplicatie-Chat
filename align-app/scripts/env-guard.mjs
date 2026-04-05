/**
 * Guardrails DB: nu rula pe conexiuni greșite (dev vs prod, localhost în producție, etc.).
 * Moduri: runtime | prisma | prisma-destructive
 *
 * Încarcă .env apoi .env.local (local peste repo), completează process.env doar unde lipsește sau e gol.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function bail(msg) {
  console.error(`\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.error(`${RED}[env-guard] BLOCAT:${RESET} ${msg}\n`);
  console.error(`${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`${YELLOW}[env-guard] ${msg}${RESET}`);
}

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, "utf8");
  for (let line of raw.split(/\r?\n/)) {
    const hash = line.indexOf("#");
    if (hash >= 0) line = line.slice(0, hash);
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).replace(/\\n/g, "\n");
    }
    out[m[1]] = val;
  }
  return out;
}

/** Îmbină .env + .env.local; completează process.env doar unde lipsește sau e gol. */
function hydrateEnvFromFiles() {
  const base = parseEnvFile(path.join(ROOT, ".env"));
  const local = parseEnvFile(path.join(ROOT, ".env.local"));
  const merged = { ...base, ...local };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "") continue;
    if (process.env[k] === undefined || process.env[k] === "") {
      process.env[k] = v;
    }
  }
}

function toHostname(dbUrl) {
  if (!dbUrl || typeof dbUrl !== "string") return "";
  try {
    const normalized = dbUrl.replace(/^postgres(ql)?:/i, "http:");
    const u = new URL(normalized);
    return (u.hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

function isLocalHost(host) {
  if (!host) return false;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost")
  );
}

function stringHasAnyMarker(text, csv) {
  if (!csv || !text) return false;
  const lower = text.toLowerCase();
  for (const m of csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (lower.includes(m.toLowerCase())) return true;
  }
  return false;
}

/** DATABASE_URL ar trebui să folosească pooler în runtime producție (Neon). */
function checkPoolerHint(mode, dbUrl) {
  if (process.env.SKIP_POOLER_HOST_CHECK === "1") return;
  if (mode !== "runtime") return;
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv !== "production") return;
  const host = toHostname(dbUrl);
  if (!host || isLocalHost(host)) return;
  if (!host.includes("-pooler")) {
    warn(
      'DATABASE_URL în producție nu pare pooler (lipsește „-pooler” în host). Pe Neon/serverless, folosește string-ul „Pooled connection” pentru runtime.'
    );
  }
}

/** Opțional: DIRECT fără -pooler, POOL cu -pooler (Neon). */
function checkNeonUrlShapes(databaseUrl, directUrl) {
  if (process.env.SKIP_NEON_URL_SHAPE_CHECK === "1") return;
  const hp = toHostname(databaseUrl);
  const hd = toHostname(directUrl);
  if (!hp || !hd) return;
  if (isLocalHost(hp) || isLocalHost(hd)) return;
  if (hp.includes("neon.tech") && hd.includes("neon.tech")) {
    if (!hp.includes("-pooler")) {
      warn("DATABASE_URL: pe Neon, runtime-ul folosește de obicei host cu „-pooler”.");
    }
    if (hd.includes("-pooler")) {
      warn(
        "DIRECT_URL: pentru migrate ar trebui conexiunea „Direct” (host fără „-pooler”), altfel advisory locks pot da timeout."
      );
    }
  }
}

/**
 * EXPECTED_DB_ENV=prod → URL nu trebuie să semene a dev/staging/local.
 * EXPECTED_DB_ENV=dev → blochează fingerprint explicit de prod (FORBIDDEN_PROD_DB_SUBSTRING sau markeri default).
 */
function assertExpectedDbEnv(databaseUrl, directUrl) {
  const expected = (process.env.EXPECTED_DB_ENV || "").toLowerCase().trim();
  if (!expected) return;

  const combined = `${databaseUrl || ""} ${directUrl || ""}`.toLowerCase();

  if (expected === "prod") {
    const devMarkers =
      process.env.DEV_URL_MARKERS ||
      "localhost,127.0.0.1,::1,.local,-dev-,/dev.,ep-dev-,staging.,/test/,_test_,@localhost";
    if (stringHasAnyMarker(combined, devMarkers)) {
      bail(
        `EXPECTED_DB_ENV=prod dar DATABASE_URL/DIRECT_URL conțin markeri „dev/local/test” (${devMarkers}). Verifică că folosești proiectul Neon de PRODUCȚIE.`
      );
    }
  }

  if (expected === "dev") {
    const forbiddenSingle = process.env.FORBIDDEN_PROD_DB_SUBSTRING?.trim();
    if (forbiddenSingle && combined.includes(forbiddenSingle.toLowerCase())) {
      bail(
        `EXPECTED_DB_ENV=dev dar URL conține FORBIDDEN_PROD_DB_SUBSTRING=${forbiddenSingle}. Risc: operați pe DB de producție.`
      );
    }
    const prodMarkers = process.env.PROD_URL_MARKERS_IN_DEV?.trim();
    if (prodMarkers && stringHasAnyMarker(combined, prodMarkers)) {
      bail(
        `EXPECTED_DB_ENV=dev dar URL conține PROD_URL_MARKERS_IN_DEV (${prodMarkers}). Aliniază .env.local la DB dev sau schimbă EXPECTED_DB_ENV.`
      );
    }
  }
}

function assertProductionSafe(databaseUrl, directUrl) {
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv !== "production") return;

  const blockDevMarkers =
    process.env.DB_BLOCK_MARKERS_IN_PRODUCTION ||
    "-dev-,/dev.,ep-dev-,localhost,127.0.0.1";
  const combined = `${databaseUrl || ""} ${directUrl || ""}`;
  for (const h of [toHostname(databaseUrl), toHostname(directUrl)]) {
    if (!h) continue;
    if (isLocalHost(h)) {
      bail(
        `În NODE_ENV=production, host-ul DB nu poate fi local (${h}). Verifică DATABASE_URL / DIRECT_URL.`
      );
    }
  }
  if (stringHasAnyMarker(combined, blockDevMarkers)) {
    bail(
      `În producție, URL DB pare „dev/local” (marker din DB_BLOCK_MARKERS_IN_PRODUCTION: ${blockDevMarkers}).`
    );
  }

  const expected = (process.env.EXPECTED_DB_ENV || "prod").toLowerCase();
  if (expected === "dev") {
    bail(
      "EXPECTED_DB_ENV=dev cu NODE_ENV=production este interzis. Pe Vercel pune EXPECTED_DB_ENV=prod și URL-uri de producție."
    );
  }

  const required = process.env.REQUIRED_PROD_DB_HOST_SUBSTRING?.trim();
  if (required) {
    const h1 = toHostname(databaseUrl);
    const h2 = toHostname(directUrl);
    const ok =
      h1.includes(required.toLowerCase()) || h2.includes(required.toLowerCase());
    if (!ok) {
      bail(
        `Cerut REQUIRED_PROD_DB_HOST_SUBSTRING=${required} dar hosturile nu îl conțin (pool: ${h1}, direct: ${h2}).`
      );
    }
  }
}

function assertDevNotAccidentalProd(databaseUrl, directUrl) {
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv === "production") return;
  if ((process.env.EXPECTED_DB_ENV || "dev").toLowerCase() !== "dev") return;

  const forbidden = process.env.FORBIDDEN_PROD_DB_SUBSTRING?.trim();
  if (!forbidden) return;

  const urls = `${databaseUrl || ""} ${directUrl || ""}`.toLowerCase();
  if (urls.includes(forbidden.toLowerCase())) {
    bail(
      `EXPECTED_DB_ENV=dev dar URL DB conține FORBIDDEN_PROD_DB_SUBSTRING=${forbidden}. Risc: rulezi local pe baza de producție.`
    );
  }
}

/** prisma db push pe baza marcată prod sau proces Node producție = interzis. */
function assertNoDbPushInProduction(pushIntent) {
  if (!pushIntent) return;
  const nodeEnv = process.env.NODE_ENV || "development";
  const expected = (process.env.EXPECTED_DB_ENV || "").toLowerCase();
  if (expected === "prod") {
    bail(
      "prisma db push este INTERZIS când EXPECTED_DB_ENV=prod. Folosește npm run db:migrate:deploy și migrări versionate."
    );
  }
  if (nodeEnv === "production" && (expected === "" || expected === "prod")) {
    bail(
      "prisma db push este INTERZIS când NODE_ENV=production. Folosește migrate deploy."
    );
  }
}

function main() {
  const mode = process.argv[2];
  const sub = (process.argv[3] || "").toLowerCase();
  const pushIntent = sub === "push";

  if (!["runtime", "prisma", "prisma-destructive"].includes(mode)) {
    bail(
      `Folosire: node scripts/env-guard.mjs <runtime|prisma|prisma-destructive> [push]\n  Primit: ${process.argv[2] || "(lipsă)"}`
    );
  }

  hydrateEnvFromFiles();

  const databaseUrl = process.env.DATABASE_URL?.trim() || "";
  const directUrl = process.env.DIRECT_URL?.trim() || "";

  if (mode === "prisma" || mode === "prisma-destructive") {
    if (!databaseUrl) bail("Lipsește DATABASE_URL (setează în .env / .env.local).");
    if (!directUrl) bail("Lipsește DIRECT_URL — obligatoriu pentru Prisma migrate/db push cu directUrl în schema (Neon: „Direct connection”).");
  }

  if (mode === "runtime") {
    if (!databaseUrl) {
      warn("DATABASE_URL gol — aplicația poate rula în mod memorie; guard sar peste verificări stricte DB.");
      process.exit(0);
    }
  }

  assertExpectedDbEnv(databaseUrl, directUrl);
  assertProductionSafe(databaseUrl, directUrl);
  assertDevNotAccidentalProd(databaseUrl, directUrl);
  checkNeonUrlShapes(databaseUrl, directUrl);
  checkPoolerHint(mode, databaseUrl);

  if (mode === "prisma" || mode === "prisma-destructive") {
    assertNoDbPushInProduction(pushIntent);
  }

  if (mode === "prisma-destructive") {
    const nodeEnv = process.env.NODE_ENV || "development";
    if (nodeEnv === "production") {
      bail(
        "prisma migrate reset / operații distructive sunt INTERZISE când NODE_ENV=production. Folosește branch Neon + restore, nu reset pe producție."
      );
    }
  }

  process.exit(0);
}

main();
