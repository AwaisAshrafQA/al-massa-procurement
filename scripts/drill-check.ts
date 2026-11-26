// Checks every Overview drill-down: the panel lists as many requests as the number clicked,
// step timings are sorted slowest first, and a listed request opens. Usage: npx tsx scripts/drill-check.ts [outDir]
import { chromium, type Page } from "playwright-core";
import { DEMO_PASSWORD, USERS } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const out = process.argv[2];
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(BASE + "/login");
await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); localStorage.setItem("am.lang", "en"); });
await p.goto(BASE + "/login");
await p.locator("#email").fill(USERS.admin.email);
await p.locator("#password").fill(DEMO_PASSWORD);
await p.locator("button[type=submit]").click();
await p.waitForURL("**/overview");
await p.waitForLoadState("networkidle");
await p.waitForTimeout(1800);

const dialog = () => p.getByRole("dialog");
const panelCount = async () => {
  const sub = await dialog().locator("p").first().innerText();
  const m = sub.match(/(\d+) requests?|1 request/);
  return m ? Number(m[1] ?? 1) : -1;
};
const close = async () => { await p.keyboard.press("Escape"); await dialog().waitFor({ state: "detached" }); };
let fails = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };

async function tile(label: string) {
  const card = p.getByRole("button", { name: `${label}: show requests` });
  await p.waitForTimeout(1500); // let the count-up animation finish
  const number = Number((await card.locator("xpath=..").locator("div.font-extrabold").innerText()).replace(/[^\d.]/g, ""));
  await card.locator("xpath=..").locator("button[aria-hidden]").click({ force: true });
  await dialog().waitFor();
  return number;
}

// 1. KPI tiles (integers)
for (const label of ["Open requests", "Urgent open", "Delivered"]) {
  const n = await tile(label);
  const c = await panelCount();
  check(`tile "${label}"`, n === c, `tile ${n} vs panel ${c}`);
  await close();
}
// 2. Average-time tile: panel lists the measured requests, slowest first
await tile("Sent → PM decision");
const hrs = await dialog().locator("li .text-sm.font-extrabold").allInnerTexts();
const toH = (s: string) => { const v = parseFloat(s); return /d/.test(s) ? v * 24 : v; };
const sorted = hrs.map(toH).every((v, i, a) => i === 0 || a[i - 1] >= v);
check("tile \"Sent → PM decision\" lists timings slowest first", hrs.length > 0 && sorted, `${hrs.length} requests, first ${hrs[0]}, last ${hrs[hrs.length - 1]}`);
await close();

// 3. Bar charts
async function bars(chartTitle: string) {
  const card = p.locator("div.rounded-2xl", { has: p.getByRole("heading", { name: chartTitle }) }).last();
  const rows = card.locator('li > [role="button"]');
  const count = await rows.count();
  let okAll = true;
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const label = (await row.locator("span.truncate").innerText()).trim();
    const valueText = (await row.locator("span.tabular-nums").innerText()).trim();
    await row.click();
    await dialog().waitFor();
    const c = await panelCount();
    if (chartTitle === "Average time at each step") {
      const first = await dialog().locator("li .text-sm.font-extrabold").first().innerText();
      if (c <= 0) okAll = false;
      if (i === 0) console.log(`      ${label}: avg ${valueText}, ${c} requests, slowest ${first}`);
    } else if (Number(valueText) !== c) { okAll = false; console.log(`      ${label}: bar ${valueText} vs panel ${c}`); }
    if (out && i === 0) { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/drill-${chartTitle.replace(/\W+/g, "-")}.png` }); }
    await close();
  }
  check(`bars "${chartTitle}" (${count} bars)`, okAll && count > 0);
}
await bars("Where requests are now");
await bars("Requests by project");
await bars("Average time at each step");

// 4. Columns (requests per day)
{
  const cols = p.locator('button[aria-label$=" sent"]');
  const n = await cols.count();
  let okAll = true, tried = 0;
  for (let i = 0; i < n; i++) {
    const label = (await cols.nth(i).getAttribute("aria-label"))!;
    const v = Number(label.match(/: (\d+) sent/)![1]);
    if (!v) continue;
    tried++;
    await cols.nth(i).click();
    await dialog().waitFor();
    const c = await panelCount();
    if (c !== v) { okAll = false; console.log(`      ${label} vs panel ${c}`); }
    await close();
  }
  check(`columns "Requests sent per day" (${tried} non-empty days)`, okAll && tried > 0);
}

// 5. Project card + open a request from the panel
{
  const card = p.locator("button", { hasText: "Villa Complex" }).first();
  const total = Number((await card.innerText()).match(/(\d+) total/)![1]);
  await card.click();
  await dialog().waitFor();
  const c = await panelCount();
  check("project card 155 Villa Complex", c === total, `card ${total} total vs panel ${c}`);
  if (out) { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/drill-project.png` }); }
  const first = dialog().locator("li a").first();
  const no = (await first.locator("span.font-bold").first().innerText()).trim();
  await first.click();
  await p.waitForURL(/\/requests\/[0-9a-f-]{36}$/);
  await p.waitForLoadState("networkidle");
  const h1 = await p.locator("h1").innerText();
  check("tapping a request in the panel opens it", h1.trim() === no && (await dialog().count()) === 0, `opened ${h1}`);
}

await b.close();
console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
process.exit(fails ? 1 : 0);
