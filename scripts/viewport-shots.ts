// Screen-sized captures (what a phone actually shows, fixed bars included) of chosen spots.
// Usage: npx tsx scripts/viewport-shots.ts <outDir>   (needs the dev server, or DEMO_URL)
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { adminClient, DEMO_PASSWORD, USERS, type UserKey } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const out = process.argv[2] ?? "viewport";
mkdirSync(out, { recursive: true });
const width = Number(process.env.W ?? 320);
const lang = process.env.LANG_UI ?? "en";
const theme = process.env.THEME ?? "light";
const db = adminClient();
const byNo = async (no: string) => (await db.from("purchase_requests").select("id").eq("request_no", no).single()).data!.id as string;

type Spot = { name: string; who: UserKey; path: string; act?: (p: Page) => Promise<void> };
const SPOTS: Spot[] = [
  { name: "overview-top", who: "admin", path: "/overview" },
  { name: "overview-projects", who: "admin", path: "/overview", act: async (p) => { await p.getByText("Villa Complex").first().scrollIntoViewIfNeeded(); } },
  { name: "drill", who: "admin", path: "/overview", act: async (p) => { await p.locator("button.absolute.inset-0[aria-hidden]").first().click({ force: true }); } },
  { name: "my-requests", who: "se1", path: "/requests" },
  { name: "form-bottom", who: "se1", path: "/requests/new", act: async (p) => { await p.mouse.wheel(0, 3000); } },
  { name: "picker-line1", who: "se1", path: "/requests/new", act: async (p) => { const s = p.locator("input[role=combobox]").first(); await s.scrollIntoViewIfNeeded(); await s.click(); await s.type("ce"); } },
  { name: "picker-line2", who: "se1", path: "/requests/new", act: async (p) => { await p.getByRole("button", { name: /Add line|إضافة بند/ }).click(); await p.waitForTimeout(400); const s = p.locator("input[role=combobox]").last(); await s.scrollIntoViewIfNeeded(); await s.click(); await s.type("pi"); } },
  { name: "dd-project", who: "se1", path: "/requests/new", act: async (p) => { await p.locator("#project").click(); } },
  { name: "dd-unit-low", who: "se1", path: "/requests/new", act: async (p) => { const u = p.locator("button[id^=u-]").first(); await u.scrollIntoViewIfNeeded(); await p.mouse.wheel(0, -40); await u.click(); } },
  { name: "dd-filter", who: "se1", path: "/requests", act: async (p) => { await p.getByRole("combobox", { name: /Filter by status|تصفية حسب الحالة/ }).click(); } },
  { name: "dd-supplier", who: "proc1", path: `/requests/${await byNo("PR-2026-0098")}`, act: async (p) => { await p.getByRole("button", { name: /^(Record supplier|تسجيل)/ }).first().click(); await p.waitForTimeout(500); await p.locator("#supplier").click(); } },
  { name: "inbox-all", who: "proc1", path: "/inbox", act: async (p) => { await p.getByRole("tab").nth(1).click(); } },
  { name: "detail-actions", who: "admin", path: `/requests/${await byNo("PR-2026-0097")}` },
  { name: "order-sheet", who: "proc1", path: `/requests/${await byNo("PR-2026-0098")}`, act: async (p) => { await p.getByRole("button", { name: /^(Record supplier|تسجيل)/ }).first().click(); } },
  { name: "return-sheet", who: "proc1", path: `/requests/${await byNo("PR-2026-0100")}`, act: async (p) => { await p.getByRole("button", { name: /^(Return to site|الإعادة إلى الموقع|إعادة إلى الموقع)/ }).first().click(); } },
];

const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width, height: width < 700 ? 640 : 900 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: "Asia/Dubai" });
await ctx.addInitScript("window.__name = (f) => f");
await ctx.addInitScript((l) => { localStorage.setItem("am.lang", l[0]); localStorage.setItem("am.theme", l[1]); localStorage.setItem("am.swipehint", "0"); }, [lang, theme]);
const p = await ctx.newPage();
let who: UserKey | null = null;
for (const s of SPOTS) {
  if (s.who !== who) {
    await p.goto(BASE + "/login");
    await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); });
    await p.goto(BASE + "/login");
    await p.locator("#email").fill(USERS[s.who].email);
    await p.locator("#password").fill(DEMO_PASSWORD);
    await p.locator("button[type=submit]").click();
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    who = s.who;
  }
  await p.goto(BASE + s.path);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1500);
  if (s.act) { await s.act(p); await p.waitForTimeout(1000); }
  await p.screenshot({ path: `${out}/${theme}-${lang}-${width}-${s.name}.png` });
}
await b.close();
console.log("done");
