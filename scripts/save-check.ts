// Checks the request form's save path in a real browser, on a throwaway draft (deleted at the end):
// 1) editing a line keeps every line; 2) saving after someone else moved the request on shows
// a clear error instead of a false "Saved"; 3) an oversized quantity is caught by the form.
// Usage: npx tsx scripts/save-check.ts
import { chromium } from "playwright-core";
import { adminClient, clientAs, DEMO_PASSWORD, dubaiDate, USERS } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const TAG = "[automated test]";
const db = adminClient();
const se1 = await clientAs(USERS.se1.email);
const { data: proj } = await db.from("projects").select("id").eq("project_no", "155").single();
const { data: req, error } = await se1.from("purchase_requests")
  .insert({ project_id: proj!.id, required_date: dubaiDate(5), urgency: "normal", purpose: TAG }).select("id").single();
if (error) throw error;
const id = req!.id as string;
await se1.from("request_lines").insert([1, 2, 3].map((n) => ({ request_id: id, line_no: n, description: `Line ${n}`, unit: "PCS", qty: n })));

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };
const lines = async () => (await db.from("request_lines").select("description,qty").eq("request_id", id).order("line_no")).data ?? [];

const b = await chromium.launch({ channel: "chrome", headless: true });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(BASE + "/login");
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); localStorage.setItem("am.lang", "en"); });
  await p.goto(BASE + "/login");
  await p.locator("#email").fill(USERS.se1.email);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.locator("button[type=submit]").click();
  await p.waitForURL((u) => !u.pathname.endsWith("/login"));

  // 1. edit line 2's quantity and save the draft
  await p.goto(`${BASE}/requests/${id}/edit`);
  const qty = p.locator('input[id^="q-"]');
  await qty.nth(1).waitFor();
  await qty.nth(1).fill("25");
  await p.getByRole("button", { name: "Save draft" }).click();
  await p.waitForTimeout(2500);
  const after = await lines();
  check("edit keeps all lines and saves the new quantity", after.length === 3 && Number(after[1].qty) === 25, JSON.stringify(after));

  // 2. oversized quantity can't be typed; a half-finished line blocks the draft save, nothing is lost
  await p.goto(`${BASE}/requests/${id}/edit`);
  await qty.nth(0).waitFor();
  await qty.nth(0).fill("10000000000");
  const capped = await qty.nth(0).inputValue();
  await qty.nth(0).fill("");
  await p.getByRole("button", { name: "Save draft" }).click();
  await p.waitForTimeout(1500);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
  const blocked = await p.getByText("Finish or remove the highlighted lines before saving.").waitFor({ timeout: 8000 }).then(() => 1, () => 0);
  const keptDraft = await lines();
  check("oversized quantity is capped; an unfinished line blocks saving and nothing is lost",
    capped === "100000000" && blocked > 0 && keptDraft.length === 3 && Number(keptDraft[0].qty) === 1, `capped to ${capped}, blocked ${blocked}, lines ${JSON.stringify(keptDraft)}`);

  // 3. someone sends it while the form is open, then the form is saved
  await p.goto(`${BASE}/requests/${id}/edit`);
  await qty.nth(0).waitFor();
  await qty.nth(0).fill("7");
  const sent = await se1.rpc("rpc_send_request", { p_request_id: id });
  if (sent.error) throw sent.error;
  await p.getByRole("button", { name: "Save draft" }).click();
  await p.waitForTimeout(2500);
  const msg = await p.getByText("can no longer be edited").count();
  const kept = await lines();
  check("stale save shows an error and keeps the sent lines", msg > 0 && kept.length === 3 && Number(kept[0].qty) === 1, `message shown: ${msg > 0}`);
} finally {
  await b.close();
  await db.from("purchase_requests").delete().eq("id", id);
}
console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
process.exit(fails ? 1 : 0);
