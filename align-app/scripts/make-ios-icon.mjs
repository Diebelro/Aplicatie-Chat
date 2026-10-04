/**
 * Iconița iOS: pătrat 1024x1024, FĂRĂ canal alpha și fără colțuri rotunjite
 * (iOS aplică singur masca; o iconiță cu transparență e respinsă la upload).
 * Sursa Android are colțuri transparente → le umplem cu culoarea brandului.
 *
 * Rulare (din align-app): node scripts/make-ios-icon.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");
const source = path.join(repoRoot, "play-store-assets", "app_icon_512.png");
const outDir = path.join(repoRoot, "align-ios", "Diebel", "Assets.xcassets", "AppIcon.appiconset");
const SIZE = 1024;

// Culoarea de fundal = pixel din zona colorată (evită să ghicim hexul brandului).
const probe = await sharp(source)
  .extract({ left: 40, top: 250, width: 1, height: 1 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const [r, g, b] = probe.data;

const scaled = await sharp(source)
  .resize(SIZE, SIZE, { fit: "contain", background: { r, g, b, alpha: 1 } })
  .toBuffer();

const icon = await sharp({
  create: { width: SIZE, height: SIZE, channels: 3, background: { r, g, b } },
})
  .composite([{ input: scaled }])
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toBuffer();

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "AppIcon-1024.png"), icon);

const contents = {
  images: [
    { filename: "AppIcon-1024.png", idiom: "universal", platform: "ios", size: "1024x1024" },
  ],
  info: { author: "xcode", version: 1 },
};
await writeFile(path.join(outDir, "Contents.json"), JSON.stringify(contents, null, 2) + "\n");

const meta = await sharp(path.join(outDir, "AppIcon-1024.png")).metadata();
console.log(
  `AppIcon-1024.png: ${meta.width}x${meta.height}, canale=${meta.channels}, alpha=${meta.hasAlpha}, fundal=rgb(${r},${g},${b})`
);
