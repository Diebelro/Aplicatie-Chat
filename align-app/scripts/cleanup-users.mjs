/**
 * Listare useri sau ștergere explicită (niciodată implicită).
 * Ștergere: obligatoriu --keep, --delete, --yes. Nu poți șterge emailul --keep.
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

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

function hydrateEnv() {
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

function parseArgs(argv) {
  const out = { keep: null, delete: null, yes: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--yes") out.yes = true;
    else if (a === "--keep" && argv[i + 1]) {
      out.keep = argv[++i].trim().toLowerCase();
    } else if (a === "--delete" && argv[i + 1]) {
      out.delete = argv[++i].trim().toLowerCase();
    }
  }
  return out;
}

function printHelp() {
  console.log(`
scripts/cleanup-users.mjs

  Listare (implicit):
    node scripts/cleanup-users.mjs

  Ștergere explicită (toate trei obligatorii):
    node scripts/cleanup-users.mjs --keep contact@diebel.ro --delete alt@email.com --yes

  Cu npm (args după --):
    npm run cleanup:bootstrap -- --keep contact@diebel.ro --delete alt@email.com --yes
`);
}

async function listUsers(prisma) {
  const rows = await prisma.user.findMany({
    select: { email: true, role: true },
    orderBy: { email: "asc" },
  });
  console.log("Utilizatori (email → rol):");
  if (rows.length === 0) {
    console.log("  (niciun rând)");
    return;
  }
  for (const r of rows) {
    console.log(`  ${r.email}\t${r.role}`);
  }
}

hydrateEnv();

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[cleanup-users] Lipsește DATABASE_URL (.env / .env.local).");
  process.exit(1);
}

const args = parseArgs(process.argv);

if (args.help) {
  printHelp();
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  if (!args.delete) {
    await listUsers(prisma);
    process.exit(0);
  }

  if (!args.keep) {
    console.error("[cleanup-users] Pentru --delete, obligatoriu și --keep <email>.");
    printHelp();
    process.exit(1);
  }

  if (!args.yes) {
    console.error(
      "[cleanup-users] Refuzat: pentru ștergere adaugă --yes (confirmare explicită)."
    );
    process.exit(1);
  }

  if (!args.delete.includes("@")) {
    console.error("[cleanup-users] --delete trebuie să fie un email valid.");
    process.exit(1);
  }

  if (args.delete === args.keep) {
    console.error("[cleanup-users] Nu poți șterge același email ca --keep.");
    process.exit(1);
  }

  const victim = await prisma.user.findUnique({
    where: { email: args.delete },
    select: { id: true, email: true, role: true },
  });
  if (!victim) {
    console.error(`[cleanup-users] Nu există user cu email: ${args.delete}`);
    process.exit(1);
  }

  await prisma.user.delete({ where: { email: args.delete } });
  console.log(`[cleanup-users] Șters: ${victim.email} (rol ${victim.role}).`);
} catch (e) {
  console.error("[cleanup-users] Eroare:", e.message || e);
  if (e.code) console.error("  code:", e.code);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
