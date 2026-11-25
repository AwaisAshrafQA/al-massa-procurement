// Converts the supplied logo (brand-source/*) to PNG using Chrome's image decoder,
// trims empty margins, and reports size and transparency. Usage: npx tsx scripts/convert-logo.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const srcName = readdirSync("brand-source").find((f) => /\.(avif|png|jpe?g|webp|svg)$/i.test(f))!;
const ext = srcName.split(".").pop()!.toLowerCase();
const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
const dataUrl = `data:${mime};base64,${readFileSync(`brand-source/${srcName}`).toString("base64")}`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const result = await page.evaluate(async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  // find bounds of non-transparent, non-near-white pixels
  let minX = width, minY = height, maxX = -1, maxY = -1, transparent = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const a = data[i + 3];
    if (a < 250) transparent++;
    const white = data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
    if (a > 20 && !white) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  }
  const pad = Math.round(Math.max(width, height) * 0.02);
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const t = document.createElement("canvas");
  t.width = maxX - minX + 1;
  t.height = maxY - minY + 1;
  t.getContext("2d")!.drawImage(c, minX, minY, t.width, t.height, 0, 0, t.width, t.height);
  return {
    natural: [width, height],
    trimmed: [t.width, t.height],
    transparentShare: transparent / (width * height),
    png: t.toDataURL("image/png"),
  };
}, dataUrl);
await browser.close();

writeFileSync("brand-source/logo-full.png", Buffer.from(result.png.split(",")[1], "base64"));
console.log(JSON.stringify({ source: srcName, natural: result.natural, trimmed: result.trimmed, transparentShare: +result.transparentShare.toFixed(3) }));
