#!/usr/bin/env node
/**
 * Verificare end-to-end producție (după deploy).
 * Rulează din folderul align-app.
 *
 *   node scripts/verify-production.mjs
 *
 * URL bază:
 *   - implicit: https://chat.diebel.ro
 *   - override: VERIFY_PRODUCTION_BASE_URL=https://alt-domeniu.vercel.app
 *
 * Opțional — commit așteptat (trebuie să existe gitSha în /api/healthz, ex. Vercel Git):
 *   VERIFY_EXPECTED_GIT_SHA=abc123def node scripts/verify-production.mjs
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

async function fetchPath(path) {
  const base = getBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: { Accept: "application/json, */*" },
  });
  const text = await res.text();
  return { res, text, url };
}

/** @param {string} msg */
function explainApiNotServed(routeLabel) {
  return `${routeLabel} Production domain is NOT serving the expected API routes. (Got HTML instead of JSON — often app not-found, wrong Vercel project, or Root Directory not align-app.)`;
}

async function main() {
  const base = getBaseUrl();
  console.log(`Production verify: ${base}\n`);

  const errors = [];

  /** @type {Record<string, unknown> | null} */
  let healthzJson = null;

  try {
    const h = await fetchPath("/api/healthz");

    if (isHtmlResponse(h.res.headers.get("content-type"), h.text)) {
      errors.push(explainApiNotServed("/api/healthz:"));
    } else {
      if (h.res.status !== 200) {
        errors.push(`/api/healthz: HTTP ${h.res.status} (expected 200)`);
      }
      const ct = h.res.headers.get("content-type") || "";
      if (!isJsonContentType(ct)) {
        errors.push(
          `/api/healthz: Content-Type must include application/json (got: ${ct || "(empty)"})`
        );
      }
      try {
        healthzJson = JSON.parse(h.text);
      } catch {
        errors.push("/api/healthz: response body is not valid JSON");
        healthzJson = null;
      }
      if (healthzJson && typeof healthzJson === "object") {
        if (healthzJson.ok !== true) errors.push("/api/healthz: json.ok must be true");
        if (healthzJson.dbOk !== true) errors.push("/api/healthz: json.dbOk must be true");
        const uc = healthzJson.urlChecks;
        if (!uc || uc.identical !== true) {
          errors.push("/api/healthz: json.urlChecks.identical must be true");
        }
      }
    }
  } catch (e) {
    errors.push(`/api/healthz: request failed — ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const p = await fetchPath("/api/db-ping");

    if (isHtmlResponse(p.res.headers.get("content-type"), p.text)) {
      errors.push(explainApiNotServed("/api/db-ping:"));
    } else {
      if (p.res.status !== 200) {
        errors.push(`/api/db-ping: HTTP ${p.res.status} (expected 200)`);
      }
      const ct = p.res.headers.get("content-type") || "";
      if (!isJsonContentType(ct)) {
        errors.push(
          `/api/db-ping: Content-Type must include application/json (got: ${ct || "(empty)"})`
        );
      }
      let pingJson;
      try {
        pingJson = JSON.parse(p.text);
      } catch {
        errors.push("/api/db-ping: response body is not valid JSON");
        pingJson = null;
      }
      if (pingJson && typeof pingJson === "object" && pingJson.dbOk !== true) {
        errors.push(
          `/api/db-ping: json.dbOk must be true` +
            (pingJson.error != null ? ` (error: ${String(pingJson.error)})` : "")
        );
      }
    }
  } catch (e) {
    errors.push(`/api/db-ping: request failed — ${e instanceof Error ? e.message : String(e)}`);
  }

  const expectedSha = process.env.VERIFY_EXPECTED_GIT_SHA?.trim();
  if (expectedSha && healthzJson && typeof healthzJson === "object") {
    const prod = healthzJson.gitSha;
    if (typeof prod !== "string" || !prod.length) {
      errors.push(
        "VERIFY_EXPECTED_GIT_SHA is set but /api/healthz has no gitSha (missing VERCEL_GIT_COMMIT_SHA on host?)"
      );
    } else {
      const p = prod.toLowerCase();
      const e = expectedSha.toLowerCase();
      if (!p.startsWith(e) && p !== e) {
        errors.push(
          `Git SHA mismatch: production gitSha ${prod.slice(0, 7)}… does not match VERIFY_EXPECTED_GIT_SHA ${e.slice(0, 7)}…`
        );
      }
    }
  }

  if (errors.length) {
    console.error("❌ PROD NOT READY\n");
    for (const line of errors) console.error(`   • ${line}`);
    console.error(
      "\n   Hint: Vercel Root Directory = align-app; redeploy; check env + DB if JSON routes work but ok/dbOk false.\n"
    );
    process.exit(1);
  }

  console.log("✅ PROD OK\n");
  console.log("   • /api/healthz: HTTP 200, application/json, ok=true, dbOk=true, urlChecks.identical=true");
  console.log("   • /api/db-ping: HTTP 200, dbOk=true");
  if (healthzJson && typeof healthzJson.gitSha === "string" && healthzJson.gitSha.length) {
    console.log(`   • deployment gitSha: ${healthzJson.gitSha}`);
  }
  process.exit(0);
}

main();
