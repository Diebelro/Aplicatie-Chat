#!/usr/bin/env node
/**
 * Verificare FINALĂ WebRTC — doar ce poate confirma aplicația (Vercel/Next).
 * Infrastructura (VPS / coturn / firewall) este în afara acestui script.
 *
 *   npm run verify:webrtc:final
 *
 * Cookie sesiune producție (după login în browser):
 *   VERIFY_WEBRTC_COOKIE="next-auth.session-token=..." npm run verify:webrtc:final
 *
 * URL bază:
 *   VERIFY_PRODUCTION_BASE_URL=https://chat.diebel.ro
 */

const DEFAULT_BASE = "https://chat.diebel.ro";

function getBaseUrl() {
  const u = process.env.VERIFY_PRODUCTION_BASE_URL?.trim();
  return (u || DEFAULT_BASE).replace(/\/+$/, "");
}

function isHtmlResponse(contentType, body) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("text/html")) return true;
  const s = body.trimStart().slice(0, 1200).toLowerCase();
  if (s.startsWith("<!doctype") || s.startsWith("<html")) return true;
  if (s.includes("this page could not be found")) return true;
  return false;
}

function isJsonContentType(contentType) {
  return (contentType || "").toLowerCase().includes("application/json");
}

async function main() {
  const base = getBaseUrl();
  const url = `${base}/api/webrtc-ready-check`;
  const cookie = process.env.VERIFY_WEBRTC_COOKIE?.trim();

  console.log(`WebRTC ready check (app only): ${url}\n`);

  const headers = { Accept: "application/json, */*" };
  if (cookie) headers.Cookie = cookie;

  let res;
  let text;
  try {
    res = await fetch(url, { redirect: "follow", headers });
    text = await res.text();
  } catch (e) {
    console.error("❌ WEBRTC NOT READY (network)");
    console.error(`   ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  if (isHtmlResponse(res.headers.get("content-type"), text)) {
    console.error("❌ WEBRTC NOT READY");
    console.error(
      "   Response is HTML — production domain is not serving /api/webrtc-ready-check as JSON."
    );
    process.exit(1);
  }

  if (!isJsonContentType(res.headers.get("content-type") || "")) {
    console.error("❌ WEBRTC NOT READY: not application/json");
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("❌ WEBRTC NOT READY: invalid JSON");
    process.exit(1);
  }

  if (json.readyFromApp === true && json.summary === "APP_READY_WAITING_FOR_VPS") {
    console.log("✅ WEBRTC READY (WAITING FOR VPS / COTURN)\n");
    console.log("   summary:", json.summary);
    console.log("   requiresExternalInfra:", json.requiresExternalInfra);
    if (json.externalInfraChecklist)
      console.log("   your VPS checklist:", json.externalInfraChecklist.join(", "));
    console.log(
      "\n   App-side is done. Next: start signaling + coturn + open ports (see docs/WEBRTC-FINAL.md)."
    );
    process.exit(0);
  }

  console.error("❌ WEBRTC NOT READY\n");
  console.error("   summary:", json.summary ?? "(missing)");
  const miss = Array.isArray(json.missingFromApp) ? json.missingFromApp : [];
  if (miss.length) {
    console.error("   missingFromApp:");
    for (const m of miss) console.error(`      • ${m}`);
  }
  if (miss[0] === "NOT_AUTHENTICATED" || res.status === 401) {
    console.error(
      "\n   Set VERIFY_WEBRTC_COOKIE from your logged-in browser session (see docs/WEBRTC-FINAL.md).\n"
    );
  }
  process.exit(1);
}

main();
