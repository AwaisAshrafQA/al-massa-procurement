// Records a captioned demo video of the MVP by driving the real app in Chrome.
// Needs: the dev server on http://localhost:5173 (npm run dev), and freshly reset demo data (npm run reset).
// Usage: npx tsx scripts/demo-video.ts   -> demo/al-massa-mvp-demo.webm
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { adminClient, DEMO_PASSWORD, dubaiDate, USERS, type UserKey } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const OUT_DIR = "demo";
const SIZE = { width: 430, height: 932 };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function caption(page: Page, text: string, ms = 2600) {
  await page.evaluate((t) => {
    let el = document.getElementById("__demo_caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_caption";
      Object.assign(el.style, {
        position: "fixed", left: "12px", right: "12px", bottom: "84px", zIndex: "99999",
        background: "rgba(15,23,42,0.92)", color: "#fff", font: "600 16px/1.35 'Segoe UI', system-ui, sans-serif",
        padding: "12px 14px", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,.25)", pointerEvents: "none",
        transition: "opacity .25s",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.opacity = "1";
  }, text);
  await pause(ms);
}

async function card(page: Page, title: string, sub: string, ms = 3800) {
  await page.evaluate(([t, s]) => {
    const el = document.createElement("div");
    el.id = "__demo_card";
    el.innerHTML = `<div style="font:700 28px/1.2 'Segoe UI',system-ui,sans-serif;margin-bottom:12px">${t}</div>
      <div style="font:400 17px/1.5 'Segoe UI',system-ui,sans-serif;opacity:.9">${s}</div>`;
    Object.assign(el.style, {
      position: "fixed", inset: "0", zIndex: "100000", display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "36px", background: "linear-gradient(160deg,#154c70,#1f6fa3)", color: "#fff", textAlign: "left",
    });
    document.body.appendChild(el);
  }, [title, sub]);
  await pause(ms);
  await page.evaluate(() => document.getElementById("__demo_card")?.remove());
}

async function signIn(page: Page, who: UserKey, label: string) {
  if (!page.url().includes("/login")) {
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/login");
  }
  await caption(page, label, 1200);
  await page.locator("#email").pressSequentially(USERS[who].email, { delay: 35 });
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

async function open(page: Page, path: string) {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
}

async function dialogAction(page: Page, button: string, text?: string) {
  await page.getByRole("button", { name: button }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  if (text) await dlg.locator("textarea, input").first().pressSequentially(text, { delay: 25 });
  await pause(500);
  await dlg.getByRole("button", { name: button }).click();
  await dlg.waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle");
}

async function scrollToText(page: Page, text: string) {
  await page.getByText(text, { exact: true }).first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  await pause(900);
}

async function main() {
  const { data: pm1Own } = await adminClient().from("purchase_requests").select("id,request_no").eq("purpose", "Site office").eq("status", "pending_pm").maybeSingle();
  if (!pm1Own) throw new Error("Run `npm run reset` first (pm1's 'Site office' request not found).");

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT_DIR, size: SIZE }, locale: "en-GB", timezoneId: "Asia/Dubai" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  await open(page, "/login");
  await card(page, "Al Massa Procurement", "MVP demo<br><br>Site request → Procurement review → PM approval → supplier → receipt on site.<br><br>One tracked cycle instead of WhatsApp.");

  // 1. Site Engineer raises an urgent request
  await signIn(page, "se1", "Ahmed (Site Engineer) signs in on a phone");
  await caption(page, "Site Engineers see only their own projects, with live status");
  await page.getByRole("link", { name: "New", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await caption(page, "New request: kept short so it takes under two minutes on site", 1800);
  await page.locator("#project").selectOption({ label: "155 · Villa Complex (Al Ain)" });
  await page.locator("#rdate").fill(dubaiDate(2));
  await page.getByRole("radio", { name: "Urgent" }).click();
  await page.locator("#reason").pressSequentially("Curing water for slab pour", { delay: 30 });
  await page.locator("#purpose").pressSequentially("Slab level 1", { delay: 30 });
  await caption(page, "Search the catalogue by code or name", 1200);
  const pickers = page.getByRole("combobox", { name: /Search code or name/ });
  await pickers.first().pressSequentially("water const", { delay: 70 });
  await pause(1200);
  await pickers.first().press("Enter");
  await caption(page, "Unit and size fill in automatically. Arabic digits are accepted: ٢ becomes 2", 1200);
  await page.locator("input[inputmode=decimal]").first().pressSequentially("٢", { delay: 80 });
  await pause(1600);
  await page.getByRole("button", { name: "Add line" }).click();
  await caption(page, "Items not in the catalogue can be typed as free text", 1000);
  await pickers.first().pressSequentially("Hessian cloth for curing", { delay: 45 });
  await pause(900);
  await pickers.first().press("Enter");
  await page.locator("input[inputmode=decimal]").nth(1).pressSequentially("10", { delay: 80 });
  await page.locator("select[id^=u-]").nth(1).selectOption("ROLL");
  await pause(800);
  await page.getByRole("button", { name: "Send to Procurement" }).click();
  await page.waitForURL(/\/requests\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");
  const reqPath = new URL(page.url()).pathname;
  await caption(page, "Sent. The system gives it a number, and every step is timestamped", 2800);
  await scrollToText(page, "Timeline");
  await pause(1500);

  // 2. Procurement
  await signIn(page, "proc1", "Sara (Procurement) signs in");
  await caption(page, "Everyone lands on a live Overview of the procurement pipeline", 2600);
  await open(page, "/inbox");
  await caption(page, "The Inbox shows what is waiting: urgent first, then oldest", 3000);
  await page.locator(`a[href="${reqPath}"]`).click();
  await page.waitForLoadState("networkidle");
  await caption(page, "Returning a request needs a comment, so the site knows what to fix", 1400);
  await page.getByRole("button", { name: "Return to site" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Return to site" }).click();
  await caption(page, "An empty comment is refused, in the app and in the database", 2200);
  await page.keyboard.press("Escape");
  await caption(page, "This one is fine, so it goes to the Project Manager", 1400);
  await dialogAction(page, "Forward to PM", "Quantities checked");
  await pause(1200);

  // 3. PM approves
  await signIn(page, "pm1", "Omar (Project Manager for project 155) signs in");
  await open(page, reqPath);
  await caption(page, "Only this project's PM gets Approve, Return and Reject", 2200);
  await dialogAction(page, "Approve");
  await caption(page, "Approved. Back to Procurement for sourcing", 2000);

  // 4. Procurement records the order
  await signIn(page, "proc1", "Sara (Procurement) records the supplier and delivery date");
  await open(page, reqPath);
  await page.getByRole("button", { name: "Record supplier & delivery" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("#supplier").selectOption({ label: "Desert Water Transport (demo)" });
  await dlg.locator("#ddate").fill(dubaiDate(1));
  await dlg.locator("#onote").pressSequentially("Quote by phone", { delay: 30 });
  await pause(700);
  await dlg.getByRole("button", { name: "Save" }).click();
  await dlg.waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle");
  await caption(page, "Ordered. The site can see the supplier and delivery date", 2200);

  // 5. Site confirms receipt
  await signIn(page, "se1", "Ahmed confirms the goods arrived on site");
  await open(page, reqPath);
  await dialogAction(page, "Confirm receipt", "All delivered");
  await caption(page, "Closed. The full history: who did what, when, and why", 1800);
  await scrollToText(page, "Timeline");
  await page.evaluate(() => window.scrollBy({ top: 500, behavior: "smooth" }));
  await pause(3000);

  // 6. Security
  await signIn(page, "se2", "Security: Rashid (Site Engineer) works on another project, 162");
  await open(page, reqPath);
  await caption(page, "The same link shows nothing. Access is enforced by the database", 3200);

  await signIn(page, "pm1", `Separation of duties: Omar (PM) raised ${pm1Own.request_no}`);
  await open(page, `/requests/${pm1Own.id}`);
  await caption(page, "No Approve button: nobody can approve a request they raised", 3000);
  await signIn(page, "admin", "The Technical Office (Admin) can step in");
  await open(page, `/requests/${pm1Own.id}`);
  await dialogAction(page, "Approve", "Approved by Technical Office");
  await scrollToText(page, "Timeline");
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await caption(page, "The timeline records that Admin approved it", 3000);

  await card(page, "What the MVP proves",
    "✓ One tracked cycle from site to receipt<br>✓ Mandatory comments on returns and rejections<br>✓ Each user sees only their projects<br>✓ Rules enforced in the database<br>✓ 45 automated tests passing<br><br>Next: LPO PDF, email alerts, Arabic interface.", 5500);

  const video = page.video();
  await context.close();
  await browser.close();
  const path = await video!.path();
  renameSync(path, `${OUT_DIR}/al-massa-mvp-demo.webm`);
  console.log(`Saved ${OUT_DIR}/al-massa-mvp-demo.webm`);
}

main().catch((e) => {
  console.error("Demo recording failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
