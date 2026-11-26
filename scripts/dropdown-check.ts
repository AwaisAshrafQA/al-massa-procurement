// Checks the app-drawn dropdowns really work: pick by tap, pick by keyboard, Esc closes without
// changing, prompts are never offered, list stays on screen, and filters filter. Read-only.
// Usage: npx tsx scripts/dropdown-check.ts   (needs the dev server, or DEMO_URL)
import { chromium, type Page } from "playwright-core";
import { DEMO_PASSWORD, USERS, type UserKey } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
let fails = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };

const b = await chromium.launch({ channel: "chrome", headless: true });
async function page(who: UserKey, width: number) {
  const ctx = await b.newContext({ viewport: { width, height: width < 700 ? 640 : 900 }, hasTouch: width < 700 });
  await ctx.addInitScript("window.__name = (f) => f");
  await ctx.addInitScript(() => { localStorage.setItem("am.lang", "en"); localStorage.setItem("am.swipehint", "0"); });
  const p = await ctx.newPage();
  await p.goto(BASE + "/login");
  await p.locator("#email").fill(USERS[who].email);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.locator("button[type=submit]").click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  return p;
}
const onScreen = async (p: Page) => p.evaluate(() => {
  const r = document.querySelector('[role="listbox"]')!.getBoundingClientRect();
  return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
});

for (const width of [360, 1280]) {
  const p = await page("se1", width);
  await p.goto(BASE + "/requests/new");
  await p.waitForLoadState("networkidle");

  // tap to pick
  await p.locator("#project").click();
  const opts = await p.getByRole("option").allInnerTexts();
  check(`${width}px project list offers no "Select project…" prompt`, opts.length > 0 && !opts.some((o) => o.includes("Select project")), opts.join(" | "));
  check(`${width}px project list is fully on screen`, await onScreen(p));
  await p.getByRole("option").first().click();
  const chosen = (await p.locator("#project").innerText()).trim();
  check(`${width}px tap picks the project`, chosen === opts[0].trim() && (await p.getByRole("listbox").count()) === 0, chosen);

  // keyboard: open, move, choose
  const unit = p.locator("button[id^=u-]").first();
  await unit.scrollIntoViewIfNeeded();
  await unit.focus();
  await p.keyboard.press("ArrowDown");
  check(`${width}px unit list (lower on page) is fully on screen`, await onScreen(p));
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  const u1 = (await unit.innerText()).trim();
  check(`${width}px keyboard picks a unit`, u1 !== "Unit…" && u1.length > 0, u1);

  // type-ahead + Escape leaves value unchanged
  await unit.focus();
  await p.keyboard.press("Enter");
  await p.keyboard.type("k");
  await p.keyboard.press("Escape");
  check(`${width}px Esc closes without changing`, (await unit.innerText()).trim() === u1 && (await p.getByRole("listbox").count()) === 0);
  await unit.focus();
  await p.keyboard.press("Enter");
  await p.keyboard.type("kg");
  await p.keyboard.press("Enter");
  check(`${width}px type-ahead jumps to KG`, (await unit.innerText()).trim() === "KG", (await unit.innerText()).trim());

  // clicking outside closes
  await p.locator("#project").click();
  await p.mouse.click(5, 300);
  check(`${width}px tap outside closes the list`, (await p.getByRole("listbox").count()) === 0);

  // filters filter
  await p.goto(BASE + "/requests");
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  const before = await p.locator("main a[href^='/requests/']:not([href='/requests/new'])").count();
  await p.getByRole("combobox", { name: "Filter by status" }).click();
  await p.getByRole("option", { name: "Received", exact: true }).click();
  await p.waitForTimeout(800);
  const badges = await p.locator("main a[href^='/requests/']:not([href='/requests/new'])").allInnerTexts();
  check(`${width}px status filter shows only Received`, badges.length > 0 && badges.every((t) => t.includes("Received")), `${before} → ${badges.length}`);
  await p.context().close();
}

// supplier dropdown inside the order sheet
{
  const p = await page("proc1", 360);
  const { adminClient } = await import("./lib");
  const id = (await adminClient().from("purchase_requests").select("id").eq("request_no", "PR-2026-0098").single()).data!.id;
  await p.goto(`${BASE}/requests/${id}`);
  await p.getByRole("button", { name: "Record supplier & delivery" }).click();
  await p.locator("#supplier").click();
  check("supplier list opens above the sheet and on screen", await onScreen(p));
  await p.getByRole("option").nth(1).click();
  const sup = (await p.locator("#supplier").innerText()).trim();
  check("supplier is picked and the sheet stays open", !sup.startsWith("Select") && (await p.getByRole("dialog").count()) === 1, sup);
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
process.exit(fails ? 1 : 0);
