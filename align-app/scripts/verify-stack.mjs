#!/usr/bin/env node
/**
 * Verificare stack Diebel (Hetzner + Neon) — rulează local după deploy.
 *   node scripts/verify-stack.mjs
 *
 * Env:
 *   VERIFY_PRODUCTION_BASE_URL=https://chat.diebel.ro
 *   VERIFY_WS_BASE_URL=https://ws.diebel.ro
 */

const CHAT = (process.env.VERIFY_PRODUCTION_BASE_URL || "https://chat.diebel.ro").replace(/\/+$/, "");
const WS = (process.env.VERIFY_WS_BASE_URL || "https://ws.diebel.ro").replace(/\/+$/, "");

const errors = [];
const warns = [];

async function get(path, base = CHAT) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { redirect: "follow", headers: { Accept: "*/*" } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { url, res, text, json };
}

function need(cond, err) {
  if (!cond) errors.push(err);
}
function warn(cond, msg) {
  if (!cond) warns.push(msg);
}

async function main() {
  console.log(`Stack verify: chat=${CHAT} ws=${WS}\n`);

  const healthz = await get("/api/healthz");
  need(healthz.res.status === 200, `/api/healthz → ${healthz.res.status}`);
  need(healthz.json?.ok === true, "healthz ok !== true");
  need(healthz.json?.dbOk === true, "healthz dbOk !== true (DATABASE_URL / Neon)");

  const dbPing = await get("/api/db-ping");
  need(dbPing.res.status === 200, `/api/db-ping → ${dbPing.res.status}`);
  need(dbPing.json?.dbOk === true, "db-ping dbOk !== true");

  const native = await get("/api/native-config");
  need(native.res.status === 200, `/api/native-config → ${native.res.status}`);
  need(native.json?.apiBase === CHAT, `native-config apiBase must be ${CHAT}`);
  need(
    typeof native.json?.signalingWsBase === "string" && native.json.signalingWsBase.includes("ws.diebel.ro"),
    "native-config signalingWsBase missing ws.diebel.ro"
  );

  const wsHealth = await get("/health", WS);
  need(wsHealth.res.status === 200, `ws /health → ${wsHealth.res.status}`);

  for (const p of ["/avatars/male-default-1.jpg", "/avatars/female-default.jpg"]) {
    const a = await get(p);
    need(a.res.status === 200, `${p} → ${a.res.status}`);
  }

  const feed = await get("/api/feed");
  need(feed.res.status === 401, `/api/feed must be 401 without auth (got ${feed.res.status})`);

  const hb = await get("/api/heartbeat", CHAT);
  need(hb.res.status === 405 || hb.res.status === 401, `/api/heartbeat GET unexpected ${hb.res.status}`);

  if (errors.length) {
    console.error("❌ STACK NOT OK\n");
    for (const e of errors) console.error(`   • ${e}`);
    process.exit(1);
  }

  console.log("✅ STACK OK (API + DB + WS + avatars)\n");
  for (const w of warns) console.warn(`   ⚠ ${w}`);
  if (!warns.length) {
    console.log("   • healthz + db-ping + native-config + ws health + static avatars");
    console.log("   • Rulează și pe VPS: bash scripts/vps-post-deploy-check.sh\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
