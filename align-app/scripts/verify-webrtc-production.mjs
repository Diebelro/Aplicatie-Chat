#!/usr/bin/env node
/**
 * Verificare WebRTC (config Vercel + rute autentificate).
 * Rulează din folderul align-app.
 *
 * Necesită cookie de sesiune (ești logat în producție), altfel primești NOT_AUTHENTICATED.
 *
 *   VERIFY_WEBRTC_COOKIE="next-auth.session-token=YOUR_TOKEN" node scripts/verify-webrtc-production.mjs
 *
 * URL bază (același ca verify-production):
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
  const url = `${base}/api/webrtc-full-check`;
  const cookie = process.env.VERIFY_WEBRTC_COOKIE?.trim();

  console.log(`WebRTC full check: ${url}\n`);

  const headers = {
    Accept: "application/json, */*",
  };
  if (cookie) {
    headers.Cookie = cookie;
  }

  let res;
  let text;
  try {
    res = await fetch(url, { redirect: "follow", headers });
    text = await res.text();
  } catch (e) {
    console.error("❌ WEBRTC FAIL (network)");
    console.error(`   ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  if (isHtmlResponse(res.headers.get("content-type"), text)) {
    console.error("❌ WEBRTC FAIL at transport");
    console.error(
      "   Production domain is NOT serving the expected API route (HTML instead of JSON)."
    );
    process.exit(1);
  }

  if (!isJsonContentType(res.headers.get("content-type") || "")) {
    console.error("❌ WEBRTC FAIL: response is not application/json");
    process.exit(1);
  }

  /** @type {Record<string, unknown> | null} */
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("❌ WEBRTC FAIL: invalid JSON body");
    process.exit(1);
  }

  if (json?.ok === true) {
    console.log("✅ WEBRTC OK\n");
    console.log("   summary:", json.summary);
    console.log("   steps:", JSON.stringify(json.steps));
    if (json.note) console.log("   note:", json.note);
    process.exit(0);
  }

  const step = typeof json?.step === "string" ? json.step : "unknown";
  const err = typeof json?.error === "string" ? json.error : String(json?.error ?? "");
  console.error(`❌ WEBRTC FAIL at ${step}`);
  console.error(`   error: ${err}`);
  if (json?.summary) console.error(`   summary: ${json.summary}`);
  if (step === "auth" || res.status === 401) {
    console.error(
      "\n   Set session cookie from your browser (while logged in), e.g.:\n   VERIFY_WEBRTC_COOKIE=\"next-auth.session-token=...\" node scripts/verify-webrtc-production.mjs\n"
    );
  }
  if (json?.hint) console.error(`   hint: ${json.hint}`);
  process.exit(1);
}

main();
