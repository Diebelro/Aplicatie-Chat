/**
 * Google Play Store listing assets (official sizes).
 * Run: npm run store:play-assets
 * Output: assets/store/google-play-console/
 *
 * — 512×512 app icon (from brand SVG)
 * — 1024×500 feature graphic (vector composite)
 *
 * Phone screenshots (real UI): npm run store:play-screenshots (Playwright; server + DB seed required).
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "store", "google-play-console");
const brandSvg = path.join(root, "assets", "brand", "diebel-icon.svg");

/** Fundal feature graphic — verde brand (aliniat cu diebel-icon / site). */
const BG = "#0f766e";
const BG2 = "#14b8a6";
const TEXT = "#FFFFFF";
const MUTED = "#ccfbf1";
const ACCENT = "#f0fdfa";

/** Feature graphic: wide banner, brand + subtle chat / voice / video motifs (no clutter). */
function featureGraphicSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${BG2}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <!-- Chat: two bubbles -->
  <rect x="640" y="120" rx="20" ry="20" width="280" height="56" fill="#FFFFFF" fill-opacity="0.12"/>
  <rect x="680" y="188" rx="20" ry="20" width="240" height="48" fill="#FFFFFF" fill-opacity="0.2"/>
  <circle cx="670" cy="148" r="6" fill="${ACCENT}" fill-opacity="0.9"/>
  <!-- Voice: simple waveform -->
  <g transform="translate(640 280)" fill="none" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round" opacity="0.85">
    <path d="M0 40 L0 20 M40 50 L40 10 M80 45 L80 15 M120 50 L120 10 M160 40 L160 20"/>
  </g>
  <!-- Video: frame corners -->
  <rect x="640" y="340" width="200" height="120" rx="16" ry="16" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="3"/>
  <circle cx="740" cy="400" r="24" fill="#FFFFFF" fill-opacity="0.15"/>
  <polygon points="730,400 748,410 730,420" fill="#FFFFFF" fill-opacity="0.35"/>
  <!-- Brand -->
  <text x="72" y="220" font-family="Segoe UI, system-ui, -apple-system, sans-serif" font-size="64" font-weight="700" fill="${TEXT}">Diebel</text>
  <text x="72" y="280" font-family="Segoe UI, system-ui, sans-serif" font-size="28" fill="${MUTED}">Chat · Voice · Video</text>
</svg>`;
}

async function writeIcon512() {
  const out = path.join(outDir, "app-icon-512.png");
  await fs.mkdir(outDir, { recursive: true });
  const svg = await fs.readFile(brandSvg);
  await sharp(svg, { density: 300 })
    .resize(512, 512, { fit: "fill" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out);
  const st = await fs.stat(out);
  console.log("wrote app-icon-512.png", Math.round(st.size / 1024), "KB");
}

/**
 * Google Play cere exact 1024×500 px; rasterizarea SVG fără resize poate da ±1 px sau alpha.
 * Forțăm resize + flatten RGB opac + verificare metadata.
 */
async function writeFeatureGraphicPng() {
  const filename = "feature-graphic-1024x500.png";
  const out = path.join(outDir, filename);
  await fs.mkdir(outDir, { recursive: true });
  const buf = Buffer.from(featureGraphicSvg(), "utf8");
  await sharp(buf, { density: 300 })
    .resize(1024, 500, { fit: "fill", position: "centre", kernel: sharp.kernel.lanczos3 })
    .flatten({ background: BG })
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      force: true,
    })
    .toFile(out);

  const meta = await sharp(out).metadata();
  if (meta.width !== 1024 || meta.height !== 500) {
    throw new Error(`Feature graphic must be 1024×500, got ${meta.width}×${meta.height}`);
  }
  if (meta.hasAlpha) {
    throw new Error("Feature graphic PNG must not have alpha channel for Play upload");
  }
  const st = await fs.stat(out);
  console.log("wrote", filename, Math.round(st.size / 1024), "KB", `(verified ${meta.width}×${meta.height})`);
}

async function writeFilesGuide() {
  const text = `Diebel — Google Play Console (folder-ul acesta)

GRAFICĂ (nu sunt screenshot-uri telefon):
  app-icon-512.png                 → App icon 512×512
  feature-graphic-1024x500.png     → Feature graphic

PHONE SCREENSHOTS (secțiunea Phone → Add assets):
  phone-screenshot-01-chat.jpg
  phone-screenshot-02-voice-call.jpg
  phone-screenshot-03-video-call.jpg
  phone-screenshot-04-conversations.jpg
  Generare: npm run store:play-screenshots (1440×2560, 9:16, JPEG)

Checklist Play (telefon, rezumat):
  • Minim 2 screenshot-uri ca să publici listing; recomandat ≥4 × ≥1080 px/latură pentru promo în vitrine.
  • JPEG sau PNG 24-bit fără alpha; ≤8 MB/fișier; 9:16 sau 16:9; laturi între 320–3840 px; latura mare ≤ 2× latura mică.
  • Conținut = experiență reală în app; fără frame-uri de telefon, fără „Best/#1/Sale”, fără CTA gen „Download now”.
  • La upload: adaugă alt text scurt per screenshot (ex. „Chat conversation screen”) — se completează în consolă.
  • Tabletă / Chromebook / Wear / TV / XR = alte secțiuni; nu le amesteca cu fișierele de mai sus dacă nu le ceri.
`;
  await fs.writeFile(path.join(outDir, "FILES.txt"), text, "utf8");
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await writeIcon512();
  await writeFeatureGraphicPng();
  await writeFilesGuide();
  console.log("\nDone. Output:", outDir);
  console.log("Phone screenshots: npm run store:play-screenshots (with dev server + prisma seed).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
