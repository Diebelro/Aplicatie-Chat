/**
 * Screenshot-uri REALE din chat.diebel.ro (nu mock-uri).
 * Run: cd align-app && node scripts/capture-play-store-screenshots.mjs
 *
 * Opțional login (Discover, Mesaje, Chat):
 *   set PLAYSHOT_EMAIL=email@example.com
 *   set PLAYSHOT_PASSWORD=parola
 *   node scripts/capture-play-store-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const OUT = path.join(REPO, "play-store-assets", "store-listing-en", "06-phone-screenshots");

async function dismissAgeGate(page) {
  for (let i = 0; i < 3; i++) {
    const accept = page.getByRole("button", { name: "Accept", exact: true }).first();
    if (await accept.isVisible({ timeout: 2500 }).catch(() => false)) {
      await accept.click().catch(() => {});
      await page.waitForTimeout(700);
    } else {
      break;
    }
  }
}

async function capture(page, file, url, waitMs = 2500) {
  console.log("→", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
  await dismissAgeGate(page);
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: path.join(OUT, file) });
  console.log("  OK", file);
}

async function tryLogin(page, email, password) {
  await page.goto("https://chat.diebel.ro/login", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1000);
  await dismissAgeGate(page);
  await page.fill('input[type="email"], input[name="email"], input[autocomplete="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: /log in|sign in|autentific|conect/i }).click();
  await page.waitForTimeout(4000);
  return page.url().includes("/app");
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  });

  await capture(page, "01-landing.png", "https://chat.diebel.ro/", 3000);
  await capture(page, "02-login.png", "https://chat.diebel.ro/login", 2000);
  await capture(page, "03-signup.png", "https://chat.diebel.ro/signup", 2000);

  const email = process.env.PLAYSHOT_EMAIL?.trim();
  const password = process.env.PLAYSHOT_PASSWORD?.trim();
  if (email && password) {
    console.log("→ login for in-app screens");
    const ok = await tryLogin(page, email, password);
    if (ok) {
      await capture(page, "04-discover.png", "https://chat.diebel.ro/app", 3500);
      await capture(page, "05-messages.png", "https://chat.diebel.ro/app/messages", 3500);
      await capture(page, "06-map.png", "https://chat.diebel.ro/app/map", 3500);
    } else {
      console.warn("  Login failed — skip in-app screenshots");
    }
  } else {
    console.log("\nPentru Discover/Mesaje/Hartă: setează PLAYSHOT_EMAIL și PLAYSHOT_PASSWORD");
    console.log("SAU fă capturi pe telefon din app și pune-le în:", OUT);
  }

  await browser.close();
  console.log("\nDone:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
