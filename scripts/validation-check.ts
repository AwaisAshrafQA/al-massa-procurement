// Browser check of form validation and injection handling on every form:
// login, new request, comment pop-up, supplier/delivery pop-up.
// Creates one throwaway draft (deleted at the end); everything else is read-only.
// Usage: npx tsx scripts/validation-check.ts   (needs the dev server, or DEMO_URL)
import { chromium, type Page } from "playwright-core";
import { adminClient, DEMO_PASSWORD, dubaiDate, USERS, type UserKey } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const db = adminClient();
let fails = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };
const XSS = `<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>'; drop table purchase_requests; --`;

const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript("window.__name = (f) => f");
await ctx.addInitScript(() => { localStorage.setItem("am.lang", "en"); localStorage.setItem("am.swipehint", "0"); });
const p = await ctx.newPage();
let dialogs = 0;
p.on("dialog", (d) => { dialogs++; d.dismiss(); });
const pwned = () => p.evaluate(() => (window as unknown as { __pwned?: number }).__pwned ?? 0);
const text = async (sel: string) => (await p.locator(sel).count()) > 0;

async function login(who: UserKey) {
  await p.goto(BASE + "/login");
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); });
  await p.goto(BASE + "/login");
  await p.locator("#email").fill(USERS[who].email);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.locator("button[type=submit]").click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}

// ---- Login
{
  let authCalls = 0;
  p.on("request", (r) => { if (r.url().includes("/auth/v1/token")) authCalls++; });
  await p.goto(BASE + "/login");
  await p.locator("button[type=submit]").click();
  check("login: empty form shows both messages, no sign-in attempt",
    (await p.getByText("Enter your company email.").count()) === 1 && (await p.getByText("Enter your password.").count()) === 1 && authCalls === 0);
  await p.locator("#email").fill("not-an-email");
  await p.locator("#password").fill("x");
  await p.locator("button[type=submit]").click();
  check("login: bad email format is caught in the form", (await p.getByText("Enter a valid email address").count()) === 1 && authCalls === 0);
  await p.locator("#email").fill(`${XSS}@x.com`);
  await p.locator("button[type=submit]").click();
  await p.waitForTimeout(800);
  check("login: script in the email box does nothing", (await pwned()) === 0 && dialogs === 0);
}

// ---- New request form
let draftId: string | null = null;
{
  await login("se1");
  await p.goto(BASE + "/requests/new");
  await p.waitForLoadState("networkidle");
  await p.locator("form button[type=submit]").click();
  const need = ["Choose the date it is needed on site.", "Pick an item or type a description.", "Enter a number above 0, with up to 3 decimals.", "Choose a unit."];
  const shown = await Promise.all(need.map(async (m) => (await p.getByText(m).count()) > 0));
  check("form: sending empty shows every required-field message", shown.every(Boolean), need.filter((_, i) => !shown[i]).join(" | "));

  await p.locator("#rdate").fill(dubaiDate(400));
  await p.locator("form button[type=submit]").click();
  check("form: date more than 12 months ahead is caught", (await p.getByText("Choose a date within the next 12 months.").count()) === 1);
  await p.locator("#rdate").fill(dubaiDate(5));

  const qty = p.locator("input[id^=q-]").first();
  for (const bad of ["0", "-3", "1.2345", "abc", "1e5", "9999999999"]) {
    await qty.fill(bad);
    const ok = (await p.getByText("Enter a number above 0, with up to 3 decimals.").count()) === 1;
    if (!ok) check(`form: quantity "${bad}" is refused`, false);
  }
  await qty.fill("12.5");
  check("form: bad quantities refused, 12.5 accepted", (await p.getByText("Enter a number above 0, with up to 3 decimals.").count()) === 0);

  await p.locator("#purpose").fill("p".repeat(260));
  const len = (await p.locator("#purpose").inputValue()).length;
  check("form: purpose capped at 200 with a counter", len === 200 && (await p.getByText("200/200").count()) === 1, `length ${len}`);

  // Injection: save a draft whose text is HTML/script/SQL, then view it
  await p.locator("#project").click();
  await p.getByRole("option").first().click();
  await p.locator("#purpose").fill(XSS.slice(0, 200));
  await p.locator("input[role=combobox]").first().fill(XSS.slice(0, 120));
  await p.getByRole("option").last().click(); // "use as free text"
  await p.locator("button[id^=u-]").first().click();
  await p.getByRole("option", { name: "PCS" }).click();
  await p.getByRole("button", { name: "Save draft" }).click();
  await p.waitForURL(/\/requests\/[0-9a-f-]{36}$/);
  draftId = p.url().split("/").pop()!;
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  const shownLiterally = (await p.getByText("<script>window.__pwned=2</script>", { exact: false }).count()) > 0;
  check("form: HTML/script/SQL is saved and shown as plain text, never runs", shownLiterally && (await pwned()) === 0 && dialogs === 0 && (await text("img[src=x]")) === false);
}

// ---- Comment pop-up (Procurement returns a request)
{
  await login("proc1");
  const id = (await db.from("purchase_requests").select("id").eq("request_no", "PR-2026-0100").single()).data!.id;
  await p.goto(`${BASE}/requests/${id}`);
  await p.getByRole("button", { name: "Return to site" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Return to site" }).click();
  check("comment: empty required comment is caught", (await p.getByText("A comment is required.").count()) === 1);
  await p.locator("#comment").fill("c".repeat(1200));
  const n = (await p.locator("#comment").inputValue()).length;
  check("comment: capped at 1000 with a counter", n === 1000 && (await p.getByText("1000/1000").count()) === 1, `length ${n}`);
  await p.keyboard.press("Escape");

  // ---- Supplier & delivery pop-up
  const id2 = (await db.from("purchase_requests").select("id").eq("request_no", "PR-2026-0098").single()).data!.id;
  await p.goto(`${BASE}/requests/${id2}`);
  await p.getByRole("button", { name: "Record supplier & delivery" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  check("order: supplier and date both required", (await p.getByText("Choose a supplier.").count()) === 1 && (await p.getByText("Choose the agreed delivery date.").count()) === 1);
  await p.locator("#ddate").fill(dubaiDate(400));
  await p.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  check("order: delivery date more than 12 months ahead is caught", (await p.getByText("Choose a date within the next 12 months.").count()) === 1);
  await p.locator("#onote").fill("n".repeat(400));
  check("order: note capped at 300", (await p.locator("#onote").inputValue()).length === 300);
}

await b.close();
if (draftId) await db.from("purchase_requests").delete().eq("id", draftId);
console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
process.exit(fails ? 1 : 0);
