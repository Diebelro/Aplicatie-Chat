#!/usr/bin/env node
/**
 * Safe check: presence of TURN-related env keys for local / CI (no secret values printed).
 * Mirrors align-app/lib/webrtc/startupTurnCheck.ts variable names.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const alignRoot = path.join(__dirname, "..");
const envLocalPath = path.join(alignRoot, ".env.local");

const REQUIRED = ["NEXT_PUBLIC_TURN_URLS", "TURN_REALM", "TURN_STATIC_SECRET"];

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
    process.stderr.write("Failed to read align-app/.env.local (check path and permissions).\n");
    process.exit(1);
  }
}

function effective(name) {
  const fromProc = process.env[name]?.trim();
  if (fromProc) return fromProc;
  return fromFile.get(name)?.trim() ?? "";
}

const missing = REQUIRED.filter((k) => !effective(k));
if (missing.length) {
  for (const m of missing) {
    process.stderr.write(`${m}\n`);
  }
  process.exit(1);
}

process.stdout.write("OK: TURN env present\n");
process.exit(0);
