// Lists every UI string that needs an Arabic translation and reports any missing from i18n.ar.ts.
// Usage: npx tsx scripts/i18n-check.ts [--list]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { AR } from "../src/lib/i18n.ar";
import { ACTION_LABEL, ROLE_LABEL, STATUS_LABEL } from "../src/lib/strings";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|)$/.test(f) ? [p] : [];
  });
}

const keys = new Set<string>();
const call = /\b(?:t|tr|translate)\(\s*"((?:[^"\\]|\\.)*)"/g;
for (const file of walk("src")) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(call)) keys.add(JSON.parse(`"${m[1]}"`));
}
// Labels translated via t(VARIABLE)
for (const v of [...Object.values(STATUS_LABEL), ...Object.values(ACTION_LABEL), ...Object.values(ROLE_LABEL)]) keys.add(v);
// Arrays of labels translated at render
for (const file of ["src/components/Stepper.tsx", "src/pages/Board.tsx", "src/lib/metrics.ts", "src/components/SiteMap.tsx", "src/pages/Login.tsx", "src/pages/Inbox.tsx"]) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?:title|label|name): "([^"]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\["[^"]+@example\.com", "([^"]+)"\]/g)) keys.add(m[1]);
}
for (const s of ["Sent", "Procurement", "PM approval", "Sourcing", "Ordered", "Received"]) keys.add(s);
// Server (database) messages shown to users
for (const file of readdirSync("supabase/migrations")) {
  const sql = readFileSync(join("supabase/migrations", file), "utf8");
  for (const m of sql.matchAll(/_fail\('((?:[^']|'')*)'\)/g)) keys.add(m[1].replace(/''/g, "'"));
}
// Auth messages
keys.add("Wrong email or password.");
keys.add("This account is not set up for Al Massa Procurement. Contact the Technical Office.");

const all = [...keys].filter((k) => k.trim() && !/^[\d\s.:/·-]+$/.test(k)).sort();
const missing = all.filter((k) => !(k in AR));
if (process.argv.includes("--list")) console.log(JSON.stringify(all, null, 1));
console.log(`${all.length} strings, ${all.length - missing.length} translated, ${missing.length} missing`);
if (missing.length) console.log(JSON.stringify(missing, null, 1));
