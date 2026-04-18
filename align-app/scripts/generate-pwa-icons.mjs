/**
 * Generează 4 PNG-uri PWA din aceeași sursă SVG (constantele de mai jos):
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

/** Schimbă aici brandul / glyph-ul — se propagă la toate cele 4 ieșiri. */
const BRAND = {
  bg: "#0FB9B1",
  fg: "#042f2e",
  glyph: "D",
};

/**
 * SVG 512×512, fundal opac 100%.
 * - any: glyph mai mare, centrat (pătrat / tab-uri).
 * - maskable: glyph mai mic în zona sigură (~centrul 66%), fără conținut până la margini.
 */
function buildSvg512(variant) {
  const isMaskable = variant === "maskable";
  const fontSize = isMaskable ? 132 : 200;
  const y = 256 + Math.round(fontSize * 0.32);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND.bg}"/>
  <text x="256" y="${y}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-weight="800" font-size="${fontSize}" fill="${BRAND.fg}">${BRAND.glyph}</text>
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
    "[icons:pwa] Scrie: icon-192-any.png, icon-512-any.png, icon-192-maskable.png, icon-512-maskable.png + alias icon-192.png, icon-512.png"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
