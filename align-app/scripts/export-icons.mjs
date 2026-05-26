/**
 * Exportă PNG-uri din marca unică verde/albă (launcher principal)
 * și din mărci alternative (512 + 192 pentru preview).
 * Rulezi: npm run icons:export
 * Necesită: sharp (devDependency).
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const primarySvg = path.join(root, "assets", "brand", "diebel-mark-heart-flow.svg");
/** Tile chat verde/alb (metadata + manifest + PWA v7). */
const tileSvg = path.join(root, "assets", "brand", "diebel-icon.svg");

const primaryTargets = [
  ["public/brand/play-icon-512.png", 512],
  ["public/brand/icon-192.png", 192],
  ["public/brand/icon-512.png", 512],
  ["public/favicon-16.png", 16],
  ["public/favicon-32.png", 32],
  ["public/apple-touch-icon.png", 180],
];

const tileTargets = [
  ["public/brand/app-icon-v7-192.png", 192],
  ["public/brand/app-icon-v7-512.png", 512],
];

/** Alternative marks: same basename in assets + public SVG copy. */
const alternateMarks = ["diebel-mark-heart-flow", "diebel-mark-message-try"];

async function exportPng(svgPath, relOut, size) {
  const out = path.join(root, ...relOut.split("/"));
  await fs.mkdir(path.dirname(out), { recursive: true });
  const svg = await fs.readFile(svgPath);
  await sharp(svg, { density: 300 })
    .resize(size, size, { fit: "fill" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out);
  console.log("wrote", relOut, size);
}

async function main() {
  for (const [rel, size] of primaryTargets) {
    await exportPng(primarySvg, rel, size);
  }
  for (const [rel, size] of tileTargets) {
    await exportPng(tileSvg, rel, size);
  }

  for (const base of alternateMarks) {
    const svgPath = path.join(root, "assets", "brand", `${base}.svg`);
    await exportPng(svgPath, `public/brand/${base}-512.png`, 512);
    await exportPng(svgPath, `public/brand/${base}-192.png`, 192);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

