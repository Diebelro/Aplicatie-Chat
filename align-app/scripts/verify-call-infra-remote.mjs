#!/usr/bin/env node
/**
 * Verificare apeluri (din PC, fără SSH): strat Vercel + endpoint public /health al semnalizării.
 *
 *   npm run verify:calls
 *
 * Env:
 *   VERIFY_CHAT_BASE=https://chat.diebel.ro
 *
 * Nu verifică UDP/TURN (coturn) — doar îți spune dacă semnalizarea HTTPS răspunde.
 * Dacă aici e verde dar apelul tot nu merge: coturn / firewall / vezi docs/VPS-signaling-COPY-PASTE.md
 */

const DEFAULT_CHAT = "https://chat.diebel.ro";

function chatBase() {
  return (process.env.VERIFY_CHAT_BASE || DEFAULT_CHAT).replace(/\/+$/, "");
}

function wssToHttpHealth(wssBase) {
  const t = (wssBase || "").trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "wss:" && u.protocol !== "ws:") return null;
    u.protocol = "https:";
    u.pathname = "/health";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function main() {
  const chat = chatBase();
  console.log(`Call infra (remote): chat=${chat}\n`);

  let envOk = false;
  let envJson = null;
  try {
    const r = await fetch(`${chat}/api/webrtc-env-check`, {
      headers: { Accept: "application/json" },
    });
    const text = await r.text();
    envJson = JSON.parse(text);
    envOk = r.ok && envJson.envLayerCompleteForCalls === true;
    console.log(envOk ? "✅ Vercel env (webrtc-env-check): READY pentru apeluri (strat app)" : "❌ Vercel env: incomplet");
    if (!envOk && envJson) {
      console.log("   signaling:", envJson.serverHasSignalingUrl);
      console.log("   envLayerCompleteForCalls:", envJson.envLayerCompleteForCalls);
      if (envJson.signalingSecretsError) console.log("   signalingSecretsError:", envJson.signalingSecretsError);
    }
  } catch (e) {
    console.log("❌ Vercel env: request eșuat —", e instanceof Error ? e.message : e);
  }

  const healthUrl = wssToHttpHealth(envJson?.signalingWsBaseUrl);
  let signalOk = false;
  if (!healthUrl) {
    console.log("\n⚠️  Semnalizare /health: nu pot deduce URL (lipsește signalingWsBaseUrl în răspuns)");
  } else {
    try {
      const r = await fetch(healthUrl, { headers: { Accept: "text/plain,*/*" } });
      const body = (await r.text()).trim();
      signalOk = r.ok && body === "ok";
      console.log(
        signalOk
          ? `\n✅ Semnalizare HTTPS: ${healthUrl} → ok`
          : `\n❌ Semnalizare HTTPS: ${healthUrl} → HTTP ${r.status} body=${body.slice(0, 80)}`
      );
      if (!signalOk) {
        console.log(
          "\n   → Pornește pe VPS: bash scripts/install-signaling-vps.sh … --install-systemd"
        );
        console.log("   → Doc: docs/VPS-signaling-COPY-PASTE.md");
      }
    } catch (e) {
      console.log(`\n❌ Semnalizare HTTPS: ${healthUrl} —`, e instanceof Error ? e.message : e);
      console.log("\n   → Nginx TLS / DNS / proces oprit pe VPS. Vezi docs/VPS-signaling-COPY-PASTE.md");
    }
  }

  console.log(
    "\nℹ️  TURN/coturn nu se verifică din acest script. Apel real + chrome://webrtc-internals (relay) = confirmare TURN."
  );

  if (envOk && signalOk) {
    console.log("\n✅ CALL INFRA (remote): Vercel + semnalizare publică OK — testează apelul; dacă pică, e TURN/firewall.\n");
    process.exit(0);
  }
  console.log("\n❌ CALL INFRA: verificările de mai sus au eșuat.\n");
  process.exit(1);
}

main();
