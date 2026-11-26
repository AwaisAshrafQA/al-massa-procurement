// Responsive sweep: every screen (and the main dialogs) at phone, tablet and desktop widths,
// in English and Arabic. Reports anything that sticks out sideways (page wider than the
// screen, or an element past the edge that is not inside a scrolling box) and saves a
// screenshot of each for review. Read-only: opens dialogs but never submits them.
// Usage: npx tsx scripts/responsive-check.ts <outDir>   (needs the dev server, or DEMO_URL)
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, type Page } from "playwright-core";
import { adminClient, DEMO_PASSWORD, USERS, type UserKey } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const out = process.argv[2] ?? "responsive";
mkdirSync(out, { recursive: true });
const WIDTHS = (process.env.WIDTHS ?? "320,375,768,1024,1440").split(",").map(Number);
const LANGS = (process.env.LANGS ?? "en,ar").split(",") as ("en" | "ar")[];
const SHOTS = process.env.SHOTS ?? "320,375,768"; // widths to keep screenshots for
const THEME = process.env.THEME ?? "light"; // light | dark
// AXE=1 also runs the axe-core accessibility scan (WCAG 2.2 A/AA) on every screen.
const AXE = process.env.AXE === "1" ? readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8") : null;
type Finding = { impact: string; help: string; screens: Set<string>; examples: Set<string> };
const findings = new Map<string, Finding>();

const db = adminClient();
const byNo = async (no: string) => (await db.from("purchase_requests").select("id").eq("request_no", no).single()).data!.id as string;
const ID = { returned: await byNo("PR-2026-0101"), pendingProc: await byNo("PR-2026-0100"), approved: await byNo("PR-2026-0098"), ordered: await byNo("PR-2026-0097"), pendingPm: await byNo("PR-2026-0099"), received: await byNo("PR-2026-0096") };

type Step = { name: string; who: UserKey | null; path: string; then?: (p: Page) => Promise<void> };
const click = (name: string | RegExp) => async (p: Page) => { await p.getByRole("button", { name }).first().click(); await p.waitForTimeout(700); };
const STEPS: Step[] = [
  { name: "login", who: null, path: "/login" },
  { name: "overview", who: "admin", path: "/overview" },
  { name: "overview-drill", who: "admin", path: "/overview", then: async (p) => { await p.waitForTimeout(1200); await p.locator("button.absolute.inset-0[aria-hidden]").first().click({ force: true }); await p.waitForTimeout(900); } },
  { name: "search", who: "admin", path: "/overview", then: async (p) => { await p.keyboard.press("Control+k"); await p.waitForTimeout(600); await p.keyboard.type("PR-2026"); await p.waitForTimeout(800); } },
  { name: "bell", who: "admin", path: "/overview", then: click(/Notifications|الإشعارات/) },
  { name: "account", who: "admin", path: "/overview", then: click(/Account menu|قائمة الحساب/) },
  { name: "board", who: "admin", path: "/board" },
  { name: "detail-ordered", who: "admin", path: `/requests/${ID.ordered}` },
  { name: "inbox-proc", who: "proc1", path: "/inbox" },
  { name: "detail-proc-return", who: "proc1", path: `/requests/${ID.pendingProc}`, then: click(/^(Return to site|الإعادة إلى الموقع|إعادة إلى الموقع)/) },
  { name: "detail-proc-order", who: "proc1", path: `/requests/${ID.approved}`, then: click(/^(Record supplier|تسجيل)/) },
  { name: "inbox-pm", who: "pm1", path: "/inbox" },
  { name: "detail-pm", who: "pm1", path: `/requests/${ID.pendingPm}` },
  { name: "my-requests", who: "se1", path: "/requests" },
  { name: "detail-received", who: "se1", path: `/requests/${ID.received}` },
  { name: "new-request", who: "se1", path: "/requests/new" },
  { name: "edit-returned", who: "se1", path: `/requests/${ID.returned}/edit` },
];

const scan = () => {
  const W = document.documentElement.clientWidth;
  const offenders: string[] = [];
  const desc = (el: Element) => {
    const c = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 5).join(".");
    const txt = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${c ? "." + c : ""} "${txt}"`;
  };
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;
    if (r.right <= W + 1 && r.left >= -1) continue;
    let a = el.parentElement, clipped = false;
    while (a && a !== document.body) {
      const s = getComputedStyle(a);
      if (s.overflowX !== "visible" || s.overflow === "hidden") {
        const ar = a.getBoundingClientRect();
        if (ar.right <= W + 1 && ar.left >= -1) { clipped = true; break; }
      }
      a = a.parentElement;
    }
    // report only the outermost offender of a branch
    if (!clipped && !offenders.some((o) => o.startsWith("#") )) {
      const parentOff = el.parentElement && (() => { const pr = el.parentElement!.getBoundingClientRect(); return pr.right > W + 1 || pr.left < -1; })();
      if (!parentOff) offenders.push(`${desc(el)} [${Math.round(r.left)}..${Math.round(r.right)} of ${W}]`);
    }
  }
  return { pageOverflow: document.documentElement.scrollWidth - W, offenders: offenders.slice(0, 6) };
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
let problems = 0, checked = 0;
for (const lang of LANGS) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 800 : 900 }, timezoneId: "Asia/Dubai", hasTouch: width < 700 });
    await ctx.addInitScript((l) => { localStorage.setItem("am.lang", l[0]); localStorage.setItem("am.theme", l[1]); localStorage.setItem("am.swipehint", "0"); }, [lang, THEME]);
    await ctx.addInitScript("window.__name = (f) => f");
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.log(`  page error @${width}/${lang}: ${e.message.slice(0, 150)}`));
    let current: UserKey | null | undefined;
    for (const s of STEPS) {
      if (s.who !== current) {
        await p.goto(BASE + "/login");
        await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); });
        if (s.who) {
          await p.goto(BASE + "/login");
          await p.locator("#email").fill(USERS[s.who].email);
          await p.locator("#password").fill(DEMO_PASSWORD);
          await p.locator("button[type=submit]").click();
          await p.waitForURL((u) => !u.pathname.startsWith("/login"));
        }
        current = s.who;
      }
      await p.goto(BASE + s.path).catch(async () => { await p.waitForTimeout(800); await p.goto(BASE + s.path); });
      await p.waitForLoadState("networkidle");
      await p.waitForTimeout(1300);
      try { if (s.then) await s.then(p); } catch (e) { console.log(`  could not open ${s.name} @${width}/${lang}: ${(e as Error).message.split("\n")[0]}`); }
      const r = await p.evaluate(scan);
      checked++;
      if (r.pageOverflow > 0 || r.offenders.length) {
        problems++;
        console.log(`ISSUE ${lang} ${width}px ${s.name}: page wider by ${r.pageOverflow}px`);
        for (const o of r.offenders) console.log(`      ${o}`);
      }
      if (AXE) {
        await p.addScriptTag({ content: AXE });
        const res = await p.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; impact: string; help: string; nodes: { target: string[]; failureSummary: string }[] }[] }> } }).axe;
          const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
          return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 12).map((n) => `${n.target.join(" ")} :: ${(n.failureSummary ?? "").split(String.fromCharCode(10)).slice(1, 2).join(" ").trim().slice(0, 140)}`) }));
        });
        for (const v of res) {
          const fd = findings.get(v.id) ?? { impact: v.impact, help: v.help, screens: new Set<string>(), examples: new Set<string>() };
          fd.screens.add(`${lang}/${width}/${s.name}`);
          for (const n of v.nodes) { const key = n.split(" :: ")[1] ?? n; if (![...fd.examples].some((e) => e.endsWith(key)) && fd.examples.size < 30) fd.examples.add(`[${s.name}] ${n}`); }
          findings.set(v.id, fd);
        }
      }
      if (SHOTS.split(",").map(Number).includes(width)) await p.screenshot({ path: `${out}/${THEME}-${lang}-${width}-${s.name}.png`, fullPage: !s.then });
      await p.keyboard.press("Escape").catch(() => {});
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${checked} screens checked (${THEME}), ${problems} with sideways overflow`);
if (AXE) {
  console.log(`\nAccessibility: ${findings.size} rule(s) failing`);
  for (const [id, fd] of findings) {
    console.log(`\n[${fd.impact}] ${id}: ${fd.help} (on ${fd.screens.size} screens)`);
    for (const e of fd.examples) console.log(`    ${e}`);
  }
}
