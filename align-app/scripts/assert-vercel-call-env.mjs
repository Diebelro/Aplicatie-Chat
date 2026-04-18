#!/usr/bin/env node
/**
 * Verifică pe proiectul Vercel legat (`.vercel/project.json`) dacă există
 * variabilele minime pentru apeluri pe Preview și Production.
 *
 * Rulează din `align-app/` cu CLI logat: `npm run vercel:assert-call-env`
 * Ieșire 1 dacă lipsesc chei — util înainte de „de ce nu merge apelul pe preview”.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const REQUIRED = [
  "TURN_REALM",
  "TURN_STATIC_SECRET",
  "NEXT_PUBLIC_TURN_URLS",
  "NEXT_PUBLIC_SIGNALING_WS_URL",
];

function parseCliJson(stdout, stderr) {
  const combined = `${stderr}\n${stdout}`;
  const start = combined.indexOf("{");
  const end = combined.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new Error(`Nu am primit JSON de la Vercel CLI. Primele 400 caractere:\n${combined.slice(0, 400)}`);
  }
  return JSON.parse(combined.slice(start, end + 1));
}

function keysForTarget(json, targetName) {
  const envs = Array.isArray(json.envs) ? json.envs : [];
  const set = new Set();
  for (const row of envs) {
    const key = typeof row?.key === "string" ? row.key : null;
    if (!key) continue;
    const targets = Array.isArray(row.target) ? row.target : [];
    if (targets.length === 0 || targets.includes(targetName)) set.add(key);
  }
  return set;
}

function runList(target) {
  if (target !== "preview" && target !== "production") throw new Error("target invalid");
  const cmd = `npx --yes vercel@latest env list ${target} -F json`;
  const r = spawnSync(cmd, { cwd: root, encoding: "utf8", shell: true });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`vercel env list ${target} a eșuat (exit ${r.status})\n${(r.stderr || r.stdout || "").slice(0, 500)}`);
  }
  return parseCliJson(r.stdout ?? "", r.stderr ?? "");
}

function main() {
  if (!existsSync(join(root, ".vercel", "project.json"))) {
    console.error(
      "Lipsește .vercel/project.json. Rulează din align-app:\n  npx vercel link --yes --scope <team> --project align-app\n"
    );
    process.exit(1);
  }

  let previewJson;
  let prodJson;
  try {
    previewJson = runList("preview");
    prodJson = runList("production");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const previewKeys = keysForTarget(previewJson, "preview");
  const prodKeys = keysForTarget(prodJson, "production");

  const missingPreview = REQUIRED.filter((k) => !previewKeys.has(k));
  const missingProd = REQUIRED.filter((k) => !prodKeys.has(k));

  console.log("— Vercel call env (chei prezente, fără valori) —");
  console.log("Preview:   ", missingPreview.length ? `LIPSESC: ${missingPreview.join(", ")}` : "OK (toate cheile)");
  console.log("Production:", missingProd.length ? `LIPSESC: ${missingProd.join(", ")}` : "OK (toate cheile)");

  if (missingPreview.length || missingProd.length) {
    console.log("\nRemediu: Vercel → Project → Settings → Environment Variables.");
    console.log("Bifează Preview pentru același set ca Production (vezi docs/calls.md secțiunea D).");
    console.log("Apoi Redeploy pe deployment-ul de test.\n");
    process.exit(1);
  }

  console.log("\nToate cheile minime pentru apeluri sunt definite pe Preview și Production.");
  process.exit(0);
}

main();
