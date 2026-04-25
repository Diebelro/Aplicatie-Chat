/**
 * Exportă PNG-uri din assets/brand/diebel-icon.svg (sursă unică).
 * Rulezi: npm run icons:export
 * Necesită: sharp (devDependency).
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "assets", "brand", "diebel-icon.svg");

const targets = [
  ["public/brand/play-icon-512.png", 512],
  ["public/brand/icon-192.png", 192],
  ["public/brand/icon-512.png", 512],
  ["public/favicon-16.png", 16],
  ["public/favicon-32.png", 32],
  ["public/apple-touch-icon.png", 180],
];

async function main() {
  const svg = await fs.readFile(svgPath);
  for (const [rel, size] of targets) {
    const out = path.join(root, ...rel.split("/"));
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(svg, { density: 300 })
      .resize(size, size, { fit: "fill" })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(out);
    console.log("wrote", rel, size);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
