#!/usr/bin/env node
/**
 * Verificări publice (fără login) că infrastructura WS e reachable de pe internet.
 * Nu înlocuiește: coturn logs, firewall, apel real în 2 browsere.
 *
 *   npm run verify:hetzner-remote
 *
 * Alt host:
 *   HETZNER_WS_HEALTH_URL=https://alt-domeniu.ro/health?ping=1 npm run verify:hetzner-remote
 */

const DEFAULT_HEALTH = "https://ws.diebel.ro/health?ping=1";

async function main() {
  const url = process.env.HETZNER_WS_HEALTH_URL?.trim() || DEFAULT_HEALTH;
  console.log("Hetzner / semnalizare — smoke test (public)\n");
  console.log("GET", url, "\n");

  try {
    const res = await fetch(url, { redirect: "follow" });
    const body = (await res.text()).trim();
    if (res.ok && body === "ok") {
      console.log("✅ Răspuns OK — procesul de semnalizare + Nginx/WSS par accesibile.\n");
      console.log("Următorul pas: verifică coturn + firewall + Vercel env + apel în 2 browsere.\n");
      process.exit(0);
    }
    console.error("❌ Neașteptat: status", res.status, "body:", body.slice(0, 200));
    process.exit(1);
  } catch (e) {
    console.error("❌ Nu pot ajunge la URL (rețea / DNS / certificat / server oprit).");
    console.error("   ", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
