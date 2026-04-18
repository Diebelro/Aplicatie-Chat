/**
 * Generează 4 PNG-uri PWA din aceeași sursă SVG:
 *   icon-192-any.png, icon-512-any.png, icon-192-maskable.png, icon-512-maskable.png
 * + aliasuri icon-192.png / icon-512.png = copii ale variantelor *-any (compat).
 *
 * Rulezi: npm run icons:pwa
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");

/** Culori — schimbă aici brandul; simbolul e inima (path), nu literă. */
const BRAND = {
  bg: "#0FB9B1",
  fg: "#042f2e",
};

/**
 * Inimă umplută (path în viewBox 0–24, ca iconițele „filled” din UI).
 * @see https://fonts.google.com/icons — heart material-style
 */
const HEART_PATH_24 =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

/**
 * SVG 512×512, fundal opac 100%.
 * - any: inimă mai mare (tab / favicon).
 * - maskable: inimă mai mică, centrată în zona sigură launcher.
 */
function buildSvg512(variant) {
  const isMaskable = variant === "maskable";
  const scale = isMaskable ? 11 : 14.5;
  const dy = isMaskable ? 8 : 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND.bg}"/>
  <g transform="translate(256 ${256 + dy}) scale(${scale}) translate(-12 -11)">
    <path fill="${BRAND.fg}" d="${HEART_PATH_24}"/>
  </g>
</svg>`;
}

async function writePng(svgString, outName, size) {
  const buf = Buffer.from(svgString, "utf8");
  await sharp(buf).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(outDir, outName));
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const svgAny = buildSvg512("any");
  const svgMaskable = buildSvg512("maskable");

  await writePng(svgAny, "icon-192-any.png", 192);
  await writePng(svgAny, "icon-512-any.png", 512);
  await writePng(svgMaskable, "icon-192-maskable.png", 192);
  await writePng(svgMaskable, "icon-512-maskable.png", 512);

  await fs.copyFile(path.join(outDir, "icon-192-any.png"), path.join(outDir, "icon-192.png"));
  await fs.copyFile(path.join(outDir, "icon-512-any.png"), path.join(outDir, "icon-512.png"));

  console.log(
    "[icons:pwa] Scrie: icon-192-any.png, icon-512-any.png, icon-192-maskable.png, icon-512-maskable.png + alias icon-192.png, icon-512.png (inimă)"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
