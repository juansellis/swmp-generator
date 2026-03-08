/**
 * One-off: make black/dark background of Blueprint logo transparent.
 * Run: node scripts/logo-transparent-background.mjs
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const inputPath = join(root, "public", "brand", "blueprint-logo.png");
const outputPath = inputPath;

const image = sharp(inputPath);
const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
// Make very dark (black) background pixels transparent; keeps logo content (green, white text)
const threshold = 28;
for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r <= threshold && g <= threshold && b <= threshold) {
    data[i + 3] = 0;
  }
}
await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile(outputPath);
console.log("Updated logo with transparent background:", outputPath);
