import sharp from "sharp";
import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "public", "avatars");
const MAX_W = 900;
const QUALITY = 72;

const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png)$/i.test(f));

for (const f of files) {
  const src = path.join(dir, f);
  const before = (await stat(src)).size;
  const input = await readFile(src);
  const buf = await sharp(input)
    .resize({ width: MAX_W, withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
    .toBuffer();
  await writeFile(src, buf);
  const after = (await stat(src)).size;
  console.log(
    `${f}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`
  );
}
console.log("done");
