/**
 * Real phone screenshots for Google Play (9:16 portrait, real app UI in Playwright).
 *
 * Aliniat la politica Play (phone): JPEG fără alpha; 320–3840 px/latură; latura mare ≤ 2× latura mică;
 * ≥4 capturi × ≥1080 px/latură pentru recomandări; UI real, fără frame telefon, fără text promoțional.
 * Alte tipuri (tabletă, Chromebook, Wear, TV, XR) — cerințe separate în consolă; acest script = doar phone.
 *
 * Prerequisites:
 *   - `npm run dev:server` (or any server) on PLAYWRIGHT_STORE_BASE_URL (default http://localhost:3005)
 *
 * Light theme applies only inside this Playwright browser (colorScheme light, no forced-dark);
 * nu modifică producția — tema globală a site-ului rămâne ce era înainte.
 *   - Prisma DB with seeded demo users: `npm run db:seed` (demo1@align.local / Parola123, …)
 *
 * Rezoluție: viewport 1440×2560 (9:16) — ambele laturi ≥1080 px (cerință Play pentru promo).
 *
 * Run:
 *   npm run store:play-screenshots
 *
 * Optional env:
 *   PLAYWRIGHT_STORE_BASE_URL   (default http://localhost:3005)
 *   STORESHOT_EMAIL             (default demo1@align.local)
 *   STORESHOT_PASSWORD          (default Parola123)
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "store", "google-play-console");

const BASE = (process.env.PLAYWRIGHT_STORE_BASE_URL || "http://localhost:3005").replace(/\/$/, "");
const EMAIL = process.env.STORESHOT_EMAIL || "demo1@align.local";
const PASS = process.env.STORESHOT_PASSWORD || "Parola123";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function alignRoomId(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].sort();
  return `align-${a}__${b}`;
}

async function waitForServer(maxMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (r.ok || r.status === 307 || r.status === 308) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Server not reachable at ${BASE}. Start the app (e.g. npm run dev:server) then rerun npm run store:play-screenshots.`,
  );
}

async function apiLogin() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: EMAIL,
      password: PASS,
      rememberDevice: true,
      deviceFingerprint: "playwright-store-screenshots-v2",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 404
        ? " Tip: use a real account from your DB, or run `npm run db:seed` when DATABASE_URL is reachable (demo1@align.local / Parola123)."
        : "";
    throw new Error(`Login failed ${res.status}: ${text.slice(0, 500)}${hint}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Login response was not JSON");
  }
  const token = data.sessionToken;
  if (!token || typeof token !== "string") {
    throw new Error("Login JSON missing sessionToken — check credentials and DB seed.");
  }
  return { sessionToken: token, user: data.user };
}

async function main() {
  await waitForServer();
  const { sessionToken, user } = await apiLogin();
  if (!user?.id) throw new Error("Login response missing user.id");

  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      /** Evită Chrome „Auto Dark Mode” pentru site la prefers-color-scheme: dark. */
      "--disable-features=WebContentsForceDark",
    ],
  });

  const context = await browser.newContext({
    baseURL: BASE,
    locale: "en-GB",
    /** Forțează prefers-color-scheme: light (UI alb + verde, fără invert OS). */
    colorScheme: "light",
    viewport: { width: 1440, height: 2560 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  });

  await context.addCookies([
    {
      name: "align_sid",
      value: sessionToken,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await context.addInitScript(() => {
    try {
      localStorage.setItem("theme", "light");
      localStorage.setItem("align-locale", "en");
      document.documentElement.style.colorScheme = "light";
    } catch {
      /* ignore */
    }
  });

  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: "light" });

  const convRes = await page.request.get(`${BASE}/api/conversations`, {
    headers: { Cookie: `align_sid=${sessionToken}` },
  });
  if (!convRes.ok()) {
    throw new Error(`GET /api/conversations failed: ${convRes.status()} ${await convRes.text()}`);
  }
  const convJson = await convRes.json();
  const list = Array.isArray(convJson.conversations) ? convJson.conversations : [];
  if (list.length === 0) {
    throw new Error(
      "No conversations for this user — run prisma seed (demo1 has a match with demo2 and messages).",
    );
  }
  const otherId = list[0].otherUser?.id;
  if (!otherId) throw new Error("Conversation missing otherUser.id");

  const roomId = alignRoomId(String(user.id), String(otherId));

  const MIN_SIDE_PX = 1080;

  /** @param {string} name */
  async function shot(name) {
    const out = path.join(outDir, name);
    await page.screenshot({
      path: out,
      type: "jpeg",
      quality: 90,
      fullPage: false,
    });
    const meta = await sharp(out).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < MIN_SIDE_PX || h < MIN_SIDE_PX) {
      throw new Error(
        `${name}: Play requires ≥${MIN_SIDE_PX}px on each side; got ${w}×${h}`,
      );
    }
    const shortSide = Math.min(w, h);
    const longSide = Math.max(w, h);
    if (longSide > 3840 || shortSide < 320) {
      throw new Error(`${name}: sides must be 320–3840 px; got ${w}×${h}`);
    }
    if (longSide > 2 * shortSide) {
      throw new Error(
        `${name}: Play max side must be ≤ 2× min side; got ${w}×${h}`,
      );
    }
    const st = await fs.stat(out);
    console.log("wrote", name, `${w}×${h}`, Math.round(st.size / 1024), "KB");
  }

  // 01 — Chat with real thread
  await page.goto(`/app/chat/${otherId}`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Write a message…").waitFor({ state: "visible", timeout: 45_000 });
  await delay(800);
  await shot("phone-screenshot-01-chat.jpg");

  // 02 — Voice call (same real CallUI as production; audio UI uses "Hang up" title on red button)
  await page.goto(`/app/call/${encodeURIComponent(roomId)}?audio=1`, { waitUntil: "domcontentloaded" });
  await page
    .locator('button[title="Hang up"], button[title="End call"]')
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });
  await delay(2500);
  await shot("phone-screenshot-02-voice-call.jpg");

  // 03 — Video call
  await page.goto(`/app/call/${encodeURIComponent(roomId)}`, { waitUntil: "domcontentloaded" });
  await page
    .locator('button[title="Hang up"], button[title="End call"]')
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });
  await delay(2500);
  await shot("phone-screenshot-03-video-call.jpg");

  // 04 — Conversations (home / message list)
  await page.goto("/app/messages", { waitUntil: "domcontentloaded" });
  await page.locator('a[href^="/app/chat/"]').first().waitFor({ state: "visible", timeout: 45_000 });
  await delay(600);
  await shot("phone-screenshot-04-conversations.jpg");

  await browser.close();
  console.log("\nDone. Google Play bundle:", outDir);
  console.log("Icon + banner: npm run store:play-assets");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
