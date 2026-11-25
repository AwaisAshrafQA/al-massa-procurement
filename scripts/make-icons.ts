// Renders the brand mark into the PNG app icons + favicon.
// Uses the official mark (public/brand/logo-mark.png) on a white tile when present,
// otherwise the placeholder SVG. Usage: npx tsx scripts/make-icons.ts
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const official = existsSync("brand-source/logo-mark.png");
const markHtml = (inner: number) =>
  official
    ? `<img src="data:image/png;base64,${readFileSync("brand-source/logo-mark.png").toString("base64")}" style="width:${inner}px;height:${inner}px;object-fit:contain" />`
    : readFileSync("public/brand/mark.svg", "utf8").replace("<svg ", `<svg width="${inner}" height="${inner}" `);
mkdirSync("public/icons", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
// tile: white rounded square for "any" icons; full-bleed white for maskable/apple (the OS applies its own mask)
const jobs: { file: string; size: number; markPad: number; radius: number }[] = [
  { file: "favicon-64.png", size: 64, markPad: 0.1, radius: 0.24 },
  { file: "icon-192.png", size: 192, markPad: 0.12, radius: 0.22 },
  { file: "icon-512.png", size: 512, markPad: 0.12, radius: 0.22 },
  { file: "maskable-512.png", size: 512, markPad: 0.2, radius: 0 },
  { file: "apple-touch-icon.png", size: 180, markPad: 0.14, radius: 0 },
];
for (const j of jobs) {
  await page.setViewportSize({ width: j.size, height: j.size });
  const inner = Math.round(j.size * (1 - j.markPad * 2));
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
      <div style="width:${j.size}px;height:${j.size}px;background:#ffffff;border-radius:${Math.round(j.size * j.radius)}px;display:grid;place-items:center">${markHtml(inner)}</div>
    </body></html>`,
  );
  await page.waitForTimeout(100);
  await page.screenshot({ path: `public/icons/${j.file}`, omitBackground: true });
  console.log("wrote", j.file, official ? "(official mark)" : "(placeholder)");
}
await browser.close();
