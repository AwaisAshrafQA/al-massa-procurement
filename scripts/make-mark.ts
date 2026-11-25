// Cuts the diamond mark out of public/brand/logo-full.png (everything above the wordmark),
// centres it on a square transparent canvas, and samples the brand colours.
// Usage: npx tsx scripts/make-mark.ts
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const dataUrl = `data:image/png;base64,${readFileSync("brand-source/logo-full.png").toString("base64")}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.evaluate("window.__name = (f) => f"); // tsx helper used inside evaluated code
const r = await page.evaluate(async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, W, H);
  const ink = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return data[i + 3] > 40 && !(data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235);
  };
  const rowInk = (y: number) => { let n = 0; for (let x = 0; x < W; x++) if (ink(x, y)) n++; return n; };
  // the mark ends at the first empty band (>= 6 blank rows) after its bottom tip
  let end = H - 1, blank = 0, seen = false;
  for (let y = 0; y < H; y++) {
    const n = rowInk(y);
    if (n > 0) { seen = true; blank = 0; } else if (seen && ++blank >= 6) { end = y - blank; break; }
  }
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y <= end; y++) for (let x = 0; x < W; x++) if (ink(x, y)) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const side = Math.round(Math.max(w, h) * 1.08);
  const s = document.createElement("canvas");
  s.width = side; s.height = side;
  s.getContext("2d")!.drawImage(c, minX, minY, w, h, Math.round((side - w) / 2), Math.round((side - h) / 2), w, h);

  // colour sample: most common saturated colours
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [R, G, B] = [data[i], data[i + 1], data[i + 2]];
    if (Math.max(R, G, B) - Math.min(R, G, B) < 40) continue;
    const k = [R, G, B].map((v) => Math.round(v / 16) * 16).map((v) => Math.min(255, v).toString(16).padStart(2, "0")).join("");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `#${k} (${n})`);
  return { bounds: { minX, minY, w, h, side, end }, png: s.toDataURL("image/png"), top };
}, dataUrl);
await browser.close();
writeFileSync("brand-source/logo-mark.png", Buffer.from(r.png.split(",")[1], "base64"));
console.log(JSON.stringify({ bounds: r.bounds, colours: r.top }));
