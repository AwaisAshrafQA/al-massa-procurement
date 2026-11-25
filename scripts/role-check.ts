// UI role matrix: signs in as each role through the real login screen and checks that each
// request shows exactly the expected action buttons (or is hidden). Read-only: clicks nothing.
// Needs the dev server. Usage: npx tsx scripts/role-check.ts
import { chromium, type Page } from "playwright-core";
import { adminClient, DEMO_PASSWORD, USERS, type UserKey } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const db = adminClient();
const ALL = ["Send to Procurement", "Resend to Procurement", "Edit", "Delete draft", "Cancel request", "Forward to PM", "Return to site",
  "Approve", "Return to Procurement", "Reject", "Record supplier & delivery", "Update supplier / date", "Confirm receipt"];

const uid = async (k: UserKey) => (await db.from("profiles").select("id").eq("email", USERS[k].email).single()).data!.id as string;
async function find(status: string, opts: { project?: string; by?: UserKey; notBy?: UserKey } = {}) {
  let q = db.from("purchase_requests").select("id,request_no,project:projects!inner(project_no)").eq("status", status);
  if (opts.project) q = q.eq("project.project_no", opts.project);
  if (opts.by) q = q.eq("requested_by", await uid(opts.by));
  if (opts.notBy) q = q.neq("requested_by", await uid(opts.notBy));
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  if (!data?.length) throw new Error(`no request with status ${status} ${JSON.stringify(opts)}`);
  return data[0] as unknown as { id: string; request_no: string | null };
}

type Case = { who: UserKey; what: string; req: () => Promise<{ id: string; request_no: string | null }>; expect: string[] | "hidden" };
const CASES: Case[] = [
  { who: "se1", what: "own draft", req: () => find("draft", { by: "se1" }), expect: ["Send to Procurement", "Edit", "Delete draft"] },
  { who: "se1", what: "own request returned to site", req: () => find("returned_to_site", { by: "se1" }), expect: ["Resend to Procurement", "Edit", "Cancel request"] },
  { who: "se1", what: "own request pending Procurement", req: () => find("pending_procurement", { by: "se1" }), expect: ["Cancel request"] },
  { who: "se1", what: "own request pending PM (can no longer cancel)", req: () => find("pending_pm", { project: "GEN", by: "se1" }), expect: [] },
  { who: "se1", what: "ordered request on own project", req: () => find("ordered", { project: "155" }), expect: ["Confirm receipt"] },
  { who: "se2", what: "request on another project (155)", req: () => find("pending_procurement", { project: "155" }), expect: "hidden" },
  { who: "proc1", what: "pending Procurement review", req: () => find("pending_procurement", { project: "155" }), expect: ["Forward to PM", "Return to site"] },
  { who: "proc2", what: "returned to Procurement by PM", req: () => find("returned_to_procurement"), expect: ["Forward to PM", "Return to site"] },
  { who: "proc1", what: "approved, needs sourcing", req: () => find("approved_sourcing"), expect: ["Record supplier & delivery"] },
  { who: "proc1", what: "ordered (can update supplier)", req: () => find("ordered"), expect: ["Update supplier / date"] },
  { who: "proc1", what: "pending PM (not Procurement's turn)", req: () => find("pending_pm"), expect: [] },
  { who: "pm1", what: "pending PM on own project 155/GEN", req: () => find("pending_pm", { project: "GEN", notBy: "pm1" }), expect: ["Approve", "Return to Procurement", "Reject"] },
  { who: "pm1", what: "request pm1 raised (separation of duties)", req: () => find("pending_pm", { by: "pm1" }), expect: [] },
  { who: "pm2", what: "pending PM on someone else's project (155)", req: () => find("pending_pm", { project: "GEN" }), expect: "hidden" },
  { who: "pm3", what: "pending PM on own project", req: async () => { try { return await find("pending_pm", { project: "171" }); } catch { return find("pending_pm", { project: "168" }); } }, expect: ["Approve", "Return to Procurement", "Reject"] },
  { who: "admin", what: "PM's own request (Admin steps in)", req: () => find("pending_pm", { by: "pm1" }), expect: ["Approve", "Return to Procurement", "Reject", "Cancel request"] },
  { who: "admin", what: "ordered (Admin can cancel)", req: () => find("ordered"), expect: ["Confirm receipt", "Update supplier / date", "Cancel request"] },
  { who: "se1", what: "received (closed)", req: () => find("received", { project: "155" }), expect: [] },
  { who: "proc1", what: "rejected (closed)", req: () => find("rejected"), expect: [] },
  { who: "admin", what: "cancelled (closed)", req: () => find("cancelled"), expect: [] },
];

async function signIn(page: Page, who: UserKey) {
  await page.goto(BASE + "/login");
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); localStorage.setItem("am.lang", "en"); });
  await page.goto(BASE + "/login");
  await page.locator("#email").fill(USERS[who].email);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.locator("button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let current: UserKey | null = null;
let fails = 0;
for (const c of CASES) {
  const r = await c.req();
  if (current !== c.who) { await signIn(page, c.who); current = c.who; }
  await page.goto(`${BASE}/requests/${r.id}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  const hidden = (await page.getByText("Request not found, or you do not have access to it.").count()) > 0;
  let got: string[] | "hidden";
  if (hidden) got = "hidden";
  else {
    got = [];
    for (const label of ALL) if ((await page.getByRole("button", { name: label, exact: true }).count()) > 0) got.push(label);
  }
  const ok = JSON.stringify(got) === JSON.stringify(c.expect === "hidden" ? "hidden" : [...c.expect].sort((a, b) => ALL.indexOf(a) - ALL.indexOf(b)));
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.who.padEnd(5)} ${(r.request_no ?? "draft").padEnd(13)} ${c.what}${ok ? "" : `\n        expected ${JSON.stringify(c.expect)}\n        got      ${JSON.stringify(got)}`}`);
}
await browser.close();
console.log(`\n${CASES.length - fails}/${CASES.length} role checks passed`);
process.exit(fails ? 1 : 0);
