// Records a detailed, captioned demo video by driving the real app in Chrome (phone size).
// It creates ONE new request, takes it through the whole cycle (including a return and resend),
// and deletes it at the end, so the demo data is left as it was. Nothing else is changed.
// Usage: DEMO_URL=https://al-massa-procurement.vercel.app npx tsx scripts/demo-video.ts
//        -> demo/al-massa-demo-detailed.webm
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { adminClient, DEMO_PASSWORD, dubaiDate, USERS, type UserKey } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const OUT_DIR = "demo";
const OUT = `${OUT_DIR}/al-massa-demo-detailed.webm`;
const SIZE = { width: 430, height: 932 };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const db = adminClient();

// ---------- on-screen captions and title cards ----------
async function caption(page: Page, text: string, ms = 2800) {
  await page.evaluate((t) => {
    let el = document.getElementById("__demo_caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_caption";
      Object.assign(el.style, {
        position: "fixed", left: "12px", right: "12px", top: "74px", zIndex: "99999",
        background: "rgba(15,23,42,0.93)", color: "#fff", font: "600 16px/1.4 'Segoe UI', system-ui, sans-serif",
        padding: "12px 14px", borderRadius: "14px", boxShadow: "0 10px 28px rgba(0,0,0,.28)", pointerEvents: "none",
        borderLeft: "5px solid #F09020", direction: "ltr", textAlign: "left",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.display = "block";
  }, text);
  await pause(ms);
}
async function hideCaption(page: Page) {
  await page.evaluate(() => { const el = document.getElementById("__demo_caption"); if (el) el.style.display = "none"; });
}

async function card(page: Page, kicker: string, title: string, body: string, ms = 4200) {
  await page.evaluate(([k, t, b]) => {
    const el = document.createElement("div");
    el.id = "__demo_card";
    el.innerHTML = `<div style="font:700 13px/1 'Segoe UI',system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#F09020;margin-bottom:14px">${k}</div>
      <div style="font:800 30px/1.15 'Segoe UI',system-ui,sans-serif;margin-bottom:16px">${t}</div>
      <div style="font:400 17px/1.55 'Segoe UI',system-ui,sans-serif;opacity:.92">${b}</div>`;
    Object.assign(el.style, {
      position: "fixed", inset: "0", zIndex: "100000", display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "38px", background: "linear-gradient(160deg,#16213a,#203050 55%,#2c4a8a)", color: "#fff", textAlign: "left", direction: "ltr",
    });
    document.body.appendChild(el);
  }, [kicker, title, body]);
  await pause(ms);
  await page.evaluate(() => document.getElementById("__demo_card")?.remove());
}

// ---------- helpers ----------
async function open(page: Page, path: string) {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  await pause(500);
}

async function signOut(page: Page) {
  if (page.url().includes("/login")) return;
  await hideCaption(page);
  await page.getByRole("button", { name: "Account menu" }).click();
  await pause(500);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
}

async function signIn(page: Page, who: UserKey, label: string) {
  await signOut(page);
  await caption(page, label, 1400);
  await page.locator("#email").pressSequentially(USERS[who].email, { delay: 30 });
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
  await pause(700);
}

/** Opens an action pop-up, optionally types a comment, and confirms. */
async function dialogAction(page: Page, button: string, text?: string, confirmLabel = button) {
  await hideCaption(page);
  await page.getByRole("button", { name: button }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  await pause(500);
  if (text) await dlg.locator("textarea, input").first().pressSequentially(text, { delay: 22 });
  await pause(600);
  await dlg.getByRole("button", { name: confirmLabel }).click();
  await dlg.waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle");
  await pause(600);
}

async function scrollTo(page: Page, text: string) {
  await page.getByText(text, { exact: true }).first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  await pause(1000);
}
/** Brings an element to the middle of the screen (clear of the fixed bars), then taps it. */
async function tap(page: Page, loc: ReturnType<Page["locator"]>) {
  if (process.env.DEBUG_TAP) console.log("TAP", await page.evaluate(() => JSON.stringify({ y: scrollY, h: document.documentElement.scrollHeight, vh: innerHeight, body: getComputedStyle(document.body).overflow, html: getComputedStyle(document.documentElement).overflow })));
  await loc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
  await pause(600);
  await loc.click();
}
/** Clicks an item in the account menu, opening the menu first only if it is closed. */
async function menu(page: Page, item: string) {
  const target = page.getByRole("button", { name: item, exact: true });
  if (!(await target.isVisible())) {
    await page.getByRole("button", { name: /^(Account menu|قائمة الحساب)$/ }).click();
    await pause(600);
  }
  await target.click();
  await pause(900);
}
const scrollBy = async (page: Page, y: number, ms = 1400) => { await page.evaluate((d) => window.scrollBy({ top: d, behavior: "smooth" }), y); await pause(ms); };

async function main() {
  const own = (await db.from("purchase_requests").select("id,request_no,status").eq("purpose", "Site office").single()).data!;
  const adminEx = (await db.from("activity_log").select("request_id, purchase_requests(request_no)").eq("acted_as", "admin").eq("action", "approved").limit(1).single()).data!;

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: SIZE, deviceScaleFactor: 1, hasTouch: true, recordVideo: { dir: OUT_DIR, size: SIZE },
    locale: "en-GB", timezoneId: "Asia/Dubai",
  });
  await context.addInitScript(() => { localStorage.setItem("am.lang", "en"); localStorage.setItem("am.theme", "light"); localStorage.setItem("am.swipehint", "0"); });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  let createdId: string | null = null;

  try {
    await open(page, "/login");
    await card(page, "Al Massa · MVP demo", "Site purchase requests,<br>tracked end to end",
      "Site Engineer → Procurement → Project Manager → supplier & delivery → receipt on site.<br><br>One cycle instead of WhatsApp threads. Rules enforced in the database. Works on any phone, in English and Arabic.", 5200);

    // ---------- 1. Sign-in ----------
    await card(page, "1 · Sign-in", "Each person signs in with their company email", "Four roles: Site Engineer, Procurement, Project Manager and Technical Office (Admin). Everyone sees only their own projects.", 3600);
    await caption(page, "The form checks itself before anything is sent", 1400);
    await page.getByRole("button", { name: "Sign in" }).click();
    await caption(page, "Empty fields are flagged in place, in plain language", 2600);

    // ---------- 2. Site Engineer raises a request ----------
    await card(page, "2 · Site Engineer", "Raise a request in under two minutes", "Ahmed is on site at project 155, Villa Complex, and needs a water tanker and curing cloth for tomorrow's slab pour.", 3800);
    await signIn(page, "se1", "Ahmed (Site Engineer) signs in on his phone");
    await caption(page, "Everyone starts on a live Overview of their projects", 2400);
    await page.getByRole("link", { name: "New request" }).first().click();
    await page.waitForLoadState("networkidle");
    await caption(page, "Pick the project from the app's own dropdown: same look on every phone", 1600);
    await page.locator("#project").click();
    await pause(900);
    await page.getByRole("option", { name: "155 · Villa Complex (Al Ain)" }).click();
    await page.locator("#rdate").fill(dubaiDate(1));
    await caption(page, "Urgent requests need a reason, and are sorted first for Procurement", 1600);
    await page.getByRole("radio", { name: "Urgent" }).click();
    await page.locator("#reason").pressSequentially("Slab pour tomorrow morning", { delay: 28 });
    await page.locator("#purpose").pressSequentially("Slab level 1, curing", { delay: 28 });

    await caption(page, "Search the catalogue by code or name: \"W2\" is the construction water tanker", 1500);
    const search = page.locator("input[role=combobox]");
    await search.first().click();
    await search.first().pressSequentially("W2", { delay: 120 });
    await pause(1300);
    await search.first().press("Enter");
    await caption(page, "The unit fills in by itself: TANKER", 1600);

    const qty = page.locator("input[id^=q-]");
    await qty.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await caption(page, "Quantity only accepts real numbers: typing \"-2.5\" keeps just 2.5", 1400);
    await qty.first().pressSequentially("-2.5", { delay: 160 });
    await tap(page, page.locator("input[id^=s-]").first());
    await caption(page, "And tankers are counted in whole numbers, so 2.5 is flagged straight away", 3000);
    await qty.first().fill("");
    await qty.first().pressSequentially("2", { delay: 120 });
    await tap(page, page.locator("input[id^=s-]").first());
    await caption(page, "Fixed: the message clears as soon as the value is right", 2000);

    await page.getByRole("button", { name: "Add line" }).click();
    await caption(page, "Not in the catalogue? Just type it: it is kept as free text", 1400);
    await tap(page, search.last());
    await search.last().pressSequentially("Hessian cloth for curing", { delay: 40 });
    await pause(1200); // suggestions are visible (opening upwards on the last line)
    await search.last().press("Tab"); // moving on keeps the typed text as free text
    await pause(600);
    await tap(page, page.locator("input[id^=q-]").last());
    await page.locator("input[id^=q-]").last().pressSequentially("10", { delay: 120 });
    await tap(page, page.locator("button[id^=u-]").last());
    await pause(800);
    await page.getByRole("option", { name: "ROLL", exact: true }).click();
    await pause(900);
    await caption(page, "Send. The request gets its number and goes to Procurement", 1600);
    await page.getByRole("button", { name: "Send to Procurement" }).click();
    await page.waitForURL(/\/requests\/[0-9a-f-]{36}$/);
    await page.waitForLoadState("networkidle");
    const reqPath = new URL(page.url()).pathname;
    createdId = reqPath.split("/").pop()!;
    const no = (await page.locator("h1").innerText()).trim();
    await caption(page, `${no}: the tracker shows where it is, and every step is logged`, 3000);
    await scrollTo(page, "Timeline");
    await pause(1200);

    // ---------- 3. Procurement reviews ----------
    await card(page, "3 · Procurement", "Review, return or forward", "Sara in Procurement sees everything waiting on her, urgent first, then oldest.", 3400);
    await signIn(page, "proc1", "Sara (Procurement) signs in");
    await caption(page, "The Overview: live numbers for the whole pipeline", 2200);
    await page.locator("button.absolute.inset-0[aria-hidden]").first().click({ force: true });
    await caption(page, "Tap any number or bar to see the requests behind it", 2800);
    await hideCaption(page);
    await page.keyboard.press("Escape");
    await pause(500);
    await open(page, "/inbox");
    await caption(page, `Inbox: urgent first, then oldest. ${no} is waiting here`, 2600);
    await page.locator(`a[href="${reqPath}"]`).first().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    await pause(900);
    await page.locator(`a[href="${reqPath}"]`).first().click();
    await page.waitForLoadState("networkidle");
    await caption(page, "Something is missing: the cloth width. Sara returns it to site", 1600);
    await page.getByRole("button", { name: "Return to site" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Return to site" }).click();
    await caption(page, "A return without a comment is refused, in the app and in the database", 2600);
    await hideCaption(page);
    await page.locator("#comment").pressSequentially("Please add the roll width for the hessian cloth.", { delay: 20 });
    await pause(500);
    await page.getByRole("dialog").getByRole("button", { name: "Return to site" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle");
    await caption(page, "Returned to site, with the reason on the timeline", 2400);

    // ---------- 4. Site fixes and resends ----------
    await signIn(page, "se1", "Back to Ahmed: the request is waiting on him");
    await open(page, reqPath);
    await caption(page, "He sees exactly what to fix, and edits the same request", 2400);
    await hideCaption(page);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.waitForLoadState("networkidle");
    await caption(page, "Procurement's comment is shown at the top of the form", 2400);
    const size = page.locator("input[id^=s-]").last();
    await tap(page, size);
    await size.pressSequentially("2 m wide", { delay: 50 });
    await pause(600);
    await page.getByRole("button", { name: "Resend to Procurement" }).click();
    await page.waitForURL(/\/requests\/[0-9a-f-]{36}$/);
    await page.waitForLoadState("networkidle");
    await caption(page, `Resent, keeping the same number ${no}`, 2400);

    // ---------- 5. Forward to PM ----------
    await signIn(page, "proc1", "Sara forwards it to the Project Manager");
    await open(page, reqPath);
    await dialogAction(page, "Forward to PM", "Checked against BOQ. Width now given.");
    await caption(page, "Now waiting for the PM of project 155", 2200);

    // ---------- 6. PM approves ----------
    await card(page, "4 · Project Manager", "Approve, return or reject", "Only the PM of this project gets these buttons. Return and Reject always need a reason.", 3400);
    await signIn(page, "pm1", "Omar (PM of project 155) signs in");
    await open(page, "/inbox");
    await caption(page, "Omar's Inbox shows what needs his decision", 2200);
    await page.locator(`a[href="${reqPath}"]`).first().click();
    await page.waitForLoadState("networkidle");
    await dialogAction(page, "Approve", "Approved for tomorrow's pour.");
    await caption(page, "Approved. Back to Procurement for sourcing", 2200);

    // ---------- 7. Procurement orders ----------
    await card(page, "5 · Ordering", "Record the supplier and delivery date", "The site can then see who is delivering and when.", 3000);
    await signIn(page, "proc1", "Sara records the supplier and agreed delivery date");
    await open(page, reqPath);
    await hideCaption(page);
    await page.getByRole("button", { name: "Record supplier & delivery" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    await dlg.locator("#supplier").click();
    await pause(900);
    await page.getByRole("option", { name: "Desert Water Transport (demo)" }).click();
    await dlg.locator("#ddate").fill(dubaiDate(3));
    await caption(page, "A date later than the site needs it gets a gentle warning", 2600);
    await dlg.locator("#ddate").fill(dubaiDate(1));
    await hideCaption(page);
    await dlg.locator("#onote").pressSequentially("Quote by phone, 07:00 delivery", { delay: 24 });
    await pause(600);
    await dlg.getByRole("button", { name: "Save" }).click();
    await dlg.waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle");
    await caption(page, "Ordered. Supplier, date and note are on the request", 2400);

    // ---------- 8. Receipt ----------
    await card(page, "6 · Receipt on site", "Close the loop", "Ahmed confirms the goods arrived, with an optional note for short or damaged deliveries.", 3000);
    await signIn(page, "se1", "Ahmed confirms delivery on site");
    await open(page, reqPath);
    await dialogAction(page, "Confirm receipt", "Tanker and cloth received, all good.");
    await caption(page, "Closed. The full history: who did what, when, and why", 2400);
    await scrollTo(page, "Timeline");
    await scrollBy(page, 420, 2200);
    await scrollBy(page, 420, 2400);

    // ---------- 9. Security ----------
    await card(page, "7 · Security", "Rules live in the database", "Not just hidden buttons: the database itself refuses what a role may not do.", 3200);
    await signIn(page, "se2", "Rashid works on another project (162) and opens the same link");
    await open(page, reqPath);
    await caption(page, "Nothing to see: other projects' requests are invisible to him", 3000);
    await signIn(page, "pm1", `Separation of duties: Omar raised ${own.request_no} himself`);
    await open(page, `/requests/${own.id}`);
    await caption(page, "So he gets no Approve button. Nobody can approve their own request", 3000);
    await signIn(page, "admin", "The Technical Office (Admin) can step in for an absent PM");
    await open(page, `/requests/${adminEx.request_id}`);
    await scrollTo(page, "Timeline");
    await scrollBy(page, 300, 900);
    await caption(page, `Here on ${(adminEx.purchase_requests as unknown as { request_no: string }).request_no}: the timeline records "as Admin"`, 3200);

    // ---------- 10. Oversight ----------
    await card(page, "8 · Oversight", "Board, search, Arabic and dark mode", "The Technical Office sees the whole pipeline live.", 3000);
    await open(page, "/board");
    await caption(page, "Pipeline board: every open request by stage, with waiting time", 2400);
    await page.evaluate(() => { const s = document.querySelector("main .overflow-x-auto, main [class*='overflow-x']"); s?.scrollBy({ left: 600, behavior: "smooth" }); });
    await pause(2200);
    await open(page, "/overview");
    await page.getByRole("button", { name: "Search" }).first().click();
    await pause(500);
    await page.keyboard.type(no, { delay: 60 });
    await caption(page, "Quick search jumps straight to any request", 2400);
    await page.keyboard.press("Escape");
    await hideCaption(page);
    await menu(page, "العربية");
    await page.waitForLoadState("networkidle");
    await caption(page, "Full Arabic interface, right to left", 3000);
    await hideCaption(page);
    await menu(page, "الوضع الداكن");
    await caption(page, "Dark mode, for site offices and night shifts", 2800);
    await hideCaption(page);
    await menu(page, "English");
    await menu(page, "Light mode");

    await card(page, "Summary", "What the MVP proves",
      "✓ One tracked cycle, site to receipt<br>✓ Return, resend, approve, reject, cancel<br>✓ Mandatory reasons; nobody approves their own request<br>✓ Each user sees only their projects<br>✓ Every form validated, in the app and the database<br>✓ Phone, tablet and desktop · English & Arabic · light & dark<br><br>70 automated tests · role, layout and accessibility checks · test log in the repo", 7000);
  } catch (e) {
    if (process.env.FAILSHOT) await page.screenshot({ path: process.env.FAILSHOT }).catch(() => {});
    throw e;
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    if (createdId) {
      await db.from("purchase_requests").delete().eq("id", createdId);
      console.log(`Removed the demo request ${createdId} so the demo data is unchanged.`);
    }
    const path = await video!.path();
    renameSync(path, OUT);
    console.log(`Saved ${OUT}`);
  }
}

main().catch((e) => {
  console.error("Demo recording failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
