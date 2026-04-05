/**
 * Recovery one-click: env-guard (din npm) + prisma generate + db push/migrate + bootstrap-accounts.
 * La EPERM pe query engine (Windows), reîncearcă după prisma generate cu mesaj clar.
 */
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const dotenvPre = "npx --yes dotenv-cli@8 -e .env.local -e .env -- ";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit", env: process.env });
}

function guard(args) {
  const r = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function looksLikeEngineLock(output) {
  return /EPERM|query_engine|\.node\b|EBUSY|ENOTEMPTY|access denied.*\.node/i.test(output || "");
}

function runBootstrapAccountsWithRetry() {
  const tsCmd =
    "npx --yes ts-node --project scripts/tsconfig.json prisma/bootstrap-accounts.ts";
  const fullCmd = dotenvPre + tsCmd;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = spawnSync(fullCmd, {
      cwd: ROOT,
      env: process.env,
      shell: true,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status === 0) return;

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`;

    if (attempt === 1 && looksLikeEngineLock(combined)) {
      console.error(
        `\n${YELLOW}[bootstrap] Fișier Prisma query engine blocat (EPERM / Windows sau antivirus).${RESET}`
      );
      console.error(
        `${YELLOW}  Oprește: npm run dev, alte procese Node, IDE care ține deschis .prisma/client.${RESET}`
      );
      console.error(`${YELLOW}  Re-rulez: prisma generate … apoi bootstrap-accounts încă o dată.${RESET}\n`);
      try {
        run(dotenvPre + "npx prisma generate");
      } catch {
        process.exit(1);
      }
      continue;
    }

    process.exit(r.status ?? 1);
  }
  process.exit(1);
}

const expected = (process.env.EXPECTED_DB_ENV || "dev").toLowerCase();
const forcePush = process.env.BOOTSTRAP_USE_DB_PUSH === "1";
const forceMigrate = process.env.BOOTSTRAP_USE_MIGRATE_DEPLOY === "1";

if (forceMigrate) {
  guard([path.join(ROOT, "scripts", "env-guard.mjs"), "prisma"]);
} else if (forcePush || expected !== "prod") {
  guard([path.join(ROOT, "scripts", "env-guard.mjs"), "prisma", "push"]);
} else {
  guard([path.join(ROOT, "scripts", "env-guard.mjs"), "prisma"]);
}

try {
  run(dotenvPre + "npx prisma generate");
} catch (e) {
  if (looksLikeEngineLock(String(e?.stderr || e?.message || e))) {
    console.error(
      `\n${YELLOW}[bootstrap] prisma generate a eșuat (probabil fișier blocat). Oprește dev/antivirus și rulează din nou npm run bootstrap.${RESET}\n`
    );
  }
  process.exit(1);
}

if (forceMigrate) {
  run(dotenvPre + "npx prisma migrate deploy");
} else if (forcePush || expected !== "prod") {
  try {
    run(dotenvPre + "npx prisma db push");
  } catch (e) {
    if (looksLikeEngineLock(String(e?.stderr || e?.message || e))) {
      console.error(
        `\n${YELLOW}[bootstrap] db push a eșuat — posibil client Prisma blocat. Oprește npm run dev, rulează din nou npm run bootstrap.${RESET}\n`
      );
    }
    process.exit(1);
  }
} else {
  run(dotenvPre + "npx prisma migrate deploy");
}

runBootstrapAccountsWithRetry();
