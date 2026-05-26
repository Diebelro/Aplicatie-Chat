/**
 * Generează iconițele PWA din marca unică verde/albă.
 * Rulezi: npm run icons:pwa
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "icons");
const sourceSvg = path.join(root, "assets", "brand", "diebel-mark-heart-flow.svg");

async function writePng(svgBuffer, outName, size) {
  await sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: "fill" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(outDir, outName));
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const svg = await fs.readFile(sourceSvg);

  await writePng(svg, "icon-192-any.png", 192);
  await writePng(svg, "icon-512-any.png", 512);
  await writePng(svg, "icon-192-maskable.png", 192);
  await writePng(svg, "icon-512-maskable.png", 512);

  await fs.copyFile(path.join(outDir, "icon-192-any.png"), path.join(outDir, "icon-192.png"));
  await fs.copyFile(path.join(outDir, "icon-512-any.png"), path.join(outDir, "icon-512.png"));

  console.log(
    "[icons:pwa] Scrie iconițe PWA verzi/albe: any, maskable și aliasurile compat."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
