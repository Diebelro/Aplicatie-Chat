/**
 * Înregistrare video pentru certificarea Google Ads „Dating and Companionship".
 * Arată: landing, login, experiența post-login (Discover, Messages, Map, Scan, Premium),
 * cu scroll până la capăt, hover pe meniuri, și URL-ul vizibil permanent (overlay).
 *
 * Run:
 *   set CERT_EMAIL=...
 *   set CERT_PASSWORD=...
 *   node scripts/record-dating-cert-video.mjs
 *
 * Rezultat: play-store-assets/dating-certification/diebel-service-walkthrough.webm
 */
import { chromium } from "playwright";
import { mkdir, readdir, rename, rm } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(REPO, "play-store-assets", "dating-certification");
const VIDEO_DIR = path.join(OUT_DIR, "_raw");
const BASE = "https://chat.diebel.ro";

const EMAIL = process.env.CERT_EMAIL?.trim();
const PASSWORD = process.env.CERT_PASSWORD?.trim();
if (!EMAIL || !PASSWORD) {
  console.error("Setează CERT_EMAIL și CERT_PASSWORD în mediu. Nu pune parole în script.");
  process.exit(1);
}

const URL_BANNER_SCRIPT = `
  (function () {
    function ensureBanner() {
      let b = document.getElementById("__cert_url_banner__");
      if (!b) {
        b = document.createElement("div");
        b.id = "__cert_url_banner__";
        b.style.cssText = [
          "position:fixed","top:0","left:0","right:0","z-index:2147483647",
          "background:#0b3d2e","color:#fff","font:600 13px/28px monospace",
          "height:28px","padding:0 10px","white-space:nowrap","overflow:hidden",
          "text-overflow:ellipsis","pointer-events:none","letter-spacing:.2px"
        ].join(";");
        (document.body || document.documentElement).appendChild(b);
      }
      b.textContent = "🔒 " + location.href;
    }
    ensureBanner();
    setInterval(ensureBanner, 400);
    document.addEventListener("DOMContentLoaded", ensureBanner);
  })();
`;

async function dismissAgeGate(page) {
  for (let i = 0; i < 3; i++) {
    const accept = page.getByRole("button", { name: "Accept", exact: true }).first();
    if (await accept.isVisible({ timeout: 2000 }).catch(() => false)) {
      await accept.click().catch(() => {});
      await page.waitForTimeout(600);
    } else break;
  }
}

async function slowScroll(page, ms = 3500) {
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 500).catch(() => {});
    await page.waitForTimeout(ms / steps);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })).catch(() => {});
  await page.waitForTimeout(500);
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true }).catch(() => {});
  await mkdir(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } },
  });
  await context.addInitScript(URL_BANNER_SCRIPT);
  const page = await context.newPage();

  // 1) Landing
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1500);
  await dismissAgeGate(page);
  await page.waitForTimeout(1500);
  await slowScroll(page, 3000);

  // 2) Login screen
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1500);
  await dismissAgeGate(page);
  await page.waitForTimeout(2000);

  // 3) Log in
  await page.fill('input[type="email"], input[name="email"], input[autocomplete="email"]', EMAIL).catch(() => {});
  await page.waitForTimeout(600);
  await page.fill('input[type="password"]', PASSWORD).catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /log in|sign in|autentific|conect/i }).first().click().catch(() => {});
  await page.waitForTimeout(5000);
  await dismissAgeGate(page);

  // 4) Post-login walkthrough
  const stops = [
    { url: `${BASE}/app`, wait: 3500 },
    { url: `${BASE}/app/profiles`, wait: 3500 },
    { url: `${BASE}/app/messages`, wait: 3000 },
    { url: `${BASE}/app/matches`, wait: 3000 },
    { url: `${BASE}/app/map`, wait: 4000 },
    { url: `${BASE}/app/scan`, wait: 3500 },
    { url: `${BASE}/app/premium`, wait: 4500 },
    { url: `${BASE}/app/settings/account`, wait: 3500 },
  ];
  for (const s of stops) {
    await page.goto(s.url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await dismissAgeGate(page);
    await slowScroll(page, s.wait);
  }

  // 5) Deschide meniul mobil (toggle între iteme)
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const menuBtn = page.getByRole("button", { name: /меню|menu|meniu/i }).first();
  if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await menuBtn.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(1500);

  await context.close();
  await browser.close();

  // Redenumește webm-ul la un nume clar
  const files = await readdir(VIDEO_DIR);
  const webm = files.find((f) => f.endsWith(".webm"));
  if (webm) {
    const finalPath = path.join(OUT_DIR, "diebel-service-walkthrough.webm");
    await rename(path.join(VIDEO_DIR, webm), finalPath);
    console.log("OK video:", finalPath);
  } else {
    console.error("Nu s-a găsit fișierul video.");
    process.exit(1);
  }
  await rm(VIDEO_DIR, { recursive: true, force: true }).catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
