// Browses the app with the Content-Security-Policy from vercel.json applied and reports anything
// it blocks, so the policy can be proven before it goes live. Against the live site it simply
// checks the real headers. Usage: npm run build && npx vite preview --port 4173, then
//   DEMO_URL=http://localhost:4173 npx tsx scripts/csp-check.ts
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { DEMO_PASSWORD, USERS } from "./lib";

const BASE = process.env.DEMO_URL ?? "http://localhost:4173";
const local = BASE.includes("localhost");
const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const headers: Record<string, string> = Object.fromEntries(cfg.headers[0].headers.map((h: { key: string; value: string }) => [h.key.toLowerCase(), h.value]));
// upgrade-insecure-requests would break plain-http localhost; drop it for the local run only
if (local) headers["content-security-policy"] = headers["content-security-policy"].replace("; upgrade-insecure-requests", "");

const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript("window.__name = (f) => f");
await ctx.addInitScript(() => {
  (window as unknown as { __csp: string[] }).__csp = [];
  document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
if (local) {
  await ctx.route(`${BASE}/**`, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), ...headers } });
  });
}
const p = await ctx.newPage();
const violations: string[] = [];
p.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text().slice(0, 200)); });
const collect = async () => violations.push(...(await p.evaluate(() => (window as unknown as { __csp: string[] }).__csp.splice(0))));

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };

const first = await p.goto(BASE + "/login");
if (!local) {
  const h = first!.headers();
  for (const k of Object.keys(headers)) check(`live header ${k}`, (h[k] ?? "") === headers[k]);
}
await p.locator("#email").fill(USERS.admin.email);
await p.locator("#password").fill(DEMO_PASSWORD);
await p.locator("button[type=submit]").click();
await p.waitForURL((u) => !u.pathname.startsWith("/login"));
for (const path of ["/overview", "/inbox", "/board", "/requests"]) {
  await p.goto(BASE + path);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1200);
  await collect();
}
const fontsOk = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check("16px Inter"); });
const dark = await p.evaluate(() => { localStorage.setItem("am.theme", "dark"); return true; });
await p.reload();
await p.waitForLoadState("networkidle");
const bootRan = await p.evaluate(() => document.documentElement.classList.contains("dark"));
await p.evaluate(() => localStorage.setItem("am.theme", "light"));
await collect();
check("signed in and browsed every main page", true);
check("web fonts load under the policy", fontsOk);
check("theme script (boot.js) runs under the policy", dark && bootRan);
check("no Content-Security-Policy violations", violations.length === 0, violations.slice(0, 5).join(" | "));
await b.close();
console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
process.exit(fails ? 1 : 0);
