#!/usr/bin/env node
/**
 * Verificare sigură înainte de deploy / pornire „ca în producție”:
 * variabile obligatorii din healthz + WebRTC + TURN_AUTH (fără a loga valori).
 * Citește `process.env` apoi `align-app/.env.local` (completare).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const alignRoot = path.join(__dirname, "..");
const envLocalPath = path.join(alignRoot, ".env.local");

/** Aliniat cu `lib/productionHealthz.ts` PRODUCTION_REQUIRED_ENV_KEYS */
const REQUIRED_PRESENT = [
  "DATABASE_URL",
  "DIRECT_URL",
  "EXPECTED_DB_ENV",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SIGNALING_WS_URL",
  "NEXT_PUBLIC_TURN_URLS",
  "TURN_REALM",
  "TURN_STATIC_SECRET",
  "TURN_AUTH_SECRET",
];

function parseDotEnv(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

/** @type {Map<string, string>} */
let fromFile = new Map();
if (fs.existsSync(envLocalPath)) {
  try {
    fromFile = parseDotEnv(fs.readFileSync(envLocalPath, "utf8"));
  } catch {
    process.stderr.write("Failed to read align-app/.env.local\n");
    process.exit(1);
  }
}

function effective(name) {
  const fromProc = process.env[name]?.trim();
  if (fromProc) return fromProc;
  return fromFile.get(name)?.trim() ?? "";
}

const missing = REQUIRED_PRESENT.filter((k) => !effective(k));
if (missing.length) {
  for (const m of missing) {
    process.stderr.write(`${m}\n`);
  }
  process.exit(1);
}

const naLen = effective("NEXTAUTH_SECRET").length;
if (naLen < 32) {
  process.stderr.write("NEXTAUTH_SECRET (min 32 characters required)\n");
  process.exit(1);
}

const taLen = effective("TURN_AUTH_SECRET").length;
if (taLen < 16) {
  process.stderr.write("TURN_AUTH_SECRET (min 16 characters required)\n");
  process.exit(1);
}

/** `parseTurnAndSignalingSecrets`: după `NEXTAUTH_SECRET` ≥32, semnalizarea e acoperită fără `SIGNALING_TOKEN_SECRET` separat. */

const expected = effective("EXPECTED_DB_ENV").toLowerCase();
if (expected !== "prod") {
  process.stderr.write("EXPECTED_DB_ENV (must be prod for production checklist)\n");
  process.exit(1);
}

const ws = effective("NEXT_PUBLIC_SIGNALING_WS_URL");
if (!ws.startsWith("ws://") && !ws.startsWith("wss://")) {
  process.stderr.write("NEXT_PUBLIC_SIGNALING_WS_URL (must start with ws:// or wss://)\n");
  process.exit(1);
}

process.stdout.write("OK: online env checklist passed (no values printed)\n");
process.exit(0);
