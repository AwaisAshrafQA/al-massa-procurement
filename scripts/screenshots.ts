// Captures screenshots of the main screens across phone/desktop, English/Arabic, light/dark.
// Needs the dev server running. Usage: npx tsx scripts/screenshots.ts <outDir>
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { adminClient, DEMO_PASSWORD, USERS, type UserKey } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const out = process.argv[2] ?? "screenshots";
mkdirSync(out, { recursive: true });

const db = adminClient();
const pick = async (status: string) =>
  (await db.from("purchase_requests").select("id").eq("status", status).order("created_at", { ascending: false }).limit(1).single()).data!.id as string;

async function signIn(page: Page, who: UserKey) {
  await page.goto(BASE + "/login");
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); });
  await page.goto(BASE + "/login");
  await page.locator("#email").fill(USERS[who].email);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.locator("button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

async function shot(page: Page, name: string, path?: string, wait = 1600, fullPage = true) {
  if (path) {
    await page.goto(BASE + path);
    await page.waitForLoadState("networkidle");
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
}

type Variant = { tag: string; viewport: { width: number; height: number }; lang: "en" | "ar"; theme: "light" | "dark" };
const VARIANTS: Variant[] = [
  { tag: "phone-en-light", viewport: { width: 400, height: 860 }, lang: "en", theme: "light" },
  { tag: "desktop-en-light", viewport: { width: 1280, height: 860 }, lang: "en", theme: "light" },
  { tag: "desktop-en-dark", viewport: { width: 1280, height: 860 }, lang: "en", theme: "dark" },
  { tag: "phone-ar-light", viewport: { width: 400, height: 860 }, lang: "ar", theme: "light" },
  { tag: "phone-en-dark", viewport: { width: 400, height: 860 }, lang: "en", theme: "dark" },
];

const only = process.env.ONLY?.split(",");
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const v of VARIANTS) {
  if (only && !only.includes(v.tag)) continue;
  const ctx = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: v.viewport.width < 600 ? 2 : 1, timezoneId: "Asia/Dubai" });
  await ctx.addInitScript(([lang, theme]) => {
    localStorage.setItem("am.lang", lang);
    localStorage.setItem("am.theme", theme);
    localStorage.setItem("am.swipehint", "0");
  }, [v.lang, v.theme]);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log(`[${v.tag}] console error:`, m.text().slice(0, 200)); });
  page.on("pageerror", (e) => console.log(`[${v.tag}] page error:`, e.message.slice(0, 200)));

  await page.goto(BASE + "/login");
  await shot(page, `${v.tag}-01-login`, undefined, 900, false);
  await signIn(page, "admin");
  await shot(page, `${v.tag}-02-overview`, undefined, 2400);
  await shot(page, `${v.tag}-03-board`, "/board");
  await signIn(page, "proc1");
  await shot(page, `${v.tag}-04-inbox`, "/inbox");
  await shot(page, `${v.tag}-05-detail`, `/requests/${await pick("ordered")}`);
  // notifications panel + search palette
  await page.getByRole("button", { name: /Notifications|الإشعارات/ }).click();
  await shot(page, `${v.tag}-06-notifications`, undefined, 700, false);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  await page.keyboard.type("villa", { delay: 60 });
  await shot(page, `${v.tag}-07-search`, undefined, 700, false);
  await page.keyboard.press("Escape");
  await signIn(page, "se1");
  await shot(page, `${v.tag}-08-new-request`, "/requests/new");
  await ctx.close();
}
await browser.close();
console.log("saved to", out);
