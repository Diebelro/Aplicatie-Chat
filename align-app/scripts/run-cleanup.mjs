/**
 * One-shot: verifică admin KEEP → dacă lipsește, rulează bootstrap (necesită BOOTSTRAP_* încă în .env.local) →
 * curăță BOOTSTRAP_* din .env.local → listează useri și indică posibili conturi de test (fără ștergere automată).
 */
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");

const KEEP = (process.env.CLEANUP_KEEP_EMAIL || "contact@diebel.ro").trim().toLowerCase();

const BOOTSTRAP_LINE = /^\s*BOOTSTRAP_[A-Za-z0-9_]*\s*=/;
const BOOTSTRAP_COMMENT =
  /^\s*#\s*(BOOTSTRAP_|BOOTSTRAP\s|Forță|ALLOW_PRODUCTION|SKIP_TEST)/i;

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
  const local = parseEnvFile(ENV_LOCAL);
  const merged = { ...base, ...local };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "") continue;
    if (process.env[k] === undefined || process.env[k] === "") {
      process.env[k] = v;
    }
  }
}

function stripBootstrapFromEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL)) {
    console.log("[cleanup] Nu există .env.local — nimic de curățat.");
    return;
  }
  const lines = fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    const t = line.trim();
    if (BOOTSTRAP_LINE.test(line)) continue;
    if (/BOOTSTRAP\s*\/\s*RECOVERY/i.test(t)) continue;
    if (BOOTSTRAP_COMMENT.test(line)) continue;
    if (/^#\s*Ghilimele obligatorii/i.test(t)) continue;
    if (/^#\s*Dacă userul există deja/i.test(t)) continue;
    kept.push(line);
  }
  const collapsed = [];
  let i = 0;
  while (i < kept.length) {
    const t = kept[i].trim();
    if (/^#\s*={5,}$/.test(t)) {
      let runEnd = i + 1;
      while (
        runEnd < kept.length &&
        /^#\s*={5,}$/.test(kept[runEnd].trim())
      ) {
        runEnd++;
      }
      if (runEnd - i >= 2) {
        i = runEnd;
        collapsed.push("");
        continue;
      }
    }
    collapsed.push(kept[i]);
    i++;
  }
  let text = collapsed.join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(ENV_LOCAL, text.trimEnd() + "\n", "utf8");
  console.log("[cleanup] Am eliminat din .env.local liniile BOOTSTRAP_* și comentariile asociate.");
}

function isBootstrapCandidateEmail(email) {
  const e = email.toLowerCase();
  if (e === KEEP) return false;
  return (
    /testuser|@dev\.align|admin@dev\.|@example\.com$/i.test(e) ||
    /bootstrap|local\.dev/i.test(e)
  );
}

hydrateEnv();

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[cleanup] Lipsește DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  let u = await prisma.user.findUnique({
    where: { email: KEEP },
    select: { id: true, email: true, role: true },
  });

  if (!u) {
    const hasEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() === KEEP;
    const hasPass = !!process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
    if (!hasEmail || !hasPass) {
      console.error(
        `[cleanup] Userul ${KEEP} nu există. Adaugă temporar în .env.local:\n` +
          `  BOOTSTRAP_ADMIN_EMAIL=${KEEP}\n` +
          `  BOOTSTRAP_ADMIN_PASSWORD="..."\n` +
          `apoi rulează: npm run bootstrap\n` +
          `și din nou: npm run cleanup`
      );
      process.exit(1);
    }
    console.log("[cleanup] Rulează npm run bootstrap (o dată), apoi continuăm…");
    execSync("npm run bootstrap", { cwd: ROOT, stdio: "inherit", env: process.env });
    u = await prisma.user.findUnique({
      where: { email: KEEP },
      select: { id: true, email: true, role: true },
    });
    if (!u) {
      console.error("[cleanup] După bootstrap, userul keep încă lipsește.");
      process.exit(1);
    }
  }

  if (u.role !== "ADMIN" && u.role !== "SUPERADMIN") {
    await prisma.user.update({
      where: { id: u.id },
      data: { role: "ADMIN" },
    });
    console.log(`[cleanup] Rol actualizat la ADMIN pentru ${KEEP} (era: ${u.role}).`);
  } else {
    console.log(`[cleanup] OK: ${KEEP} există și este ${u.role}.`);
  }

  const all = await prisma.user.findMany({
    select: { email: true, role: true },
    orderBy: { email: "asc" },
  });

  stripBootstrapFromEnvLocal();

  console.log("\n--- Utilizatori în DB după verificare ---");
  for (const r of all) {
    console.log(`  ${r.email}\t${r.role}`);
  }

  const candidates = all.filter((r) => isBootstrapCandidateEmail(r.email));
  if (candidates.length > 0) {
    console.log("\n--- Posibile conturi de test / bootstrap (heuristic) ---");
    for (const r of candidates) {
      console.log(`  ${r.email}\t${r.role}`);
    }
  } else {
    console.log(
      "\n(nicio potrivire heuristică pentru „test/bootstrap”; revizuiește lista de mai sus manual)"
    );
  }

  const others = all.filter((r) => r.email.toLowerCase() !== KEEP);
  console.log("\n--- Ștergere manuală (nu s-a rulat nimic automat) ---");
  if (candidates.length > 0) {
    for (const r of candidates) {
      const quoted = r.email.includes(" ") ? `"${r.email}"` : r.email;
      console.log(
        `  npm run cleanup:bootstrap -- --keep ${KEEP} --delete ${quoted} --yes`
      );
    }
  } else if (others.length > 0) {
    console.log(
      `  Alți useri (nu sunt clasați automat ca test/bootstrap): ${others.map((x) => x.email).join(", ")}`
    );
    console.log(
      `  Exemplu (înlocuiește emailul): npm run cleanup:bootstrap -- --keep ${KEEP} --delete \"alt@email.com\" --yes`
    );
  } else {
    console.log(`  Doar ${KEEP} — nimic de șters.`);
  }

  console.log(
    "\n[cleanup] Gata. Flux zilnic: fără BOOTSTRAP_* în .env.local. Recovery: vezi README / docs/RECOVERY.md."
  );
}

main()
  .catch((e) => {
    console.error("[cleanup]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
