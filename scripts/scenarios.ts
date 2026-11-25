// Rich demo data: extra master data and ~100 historical requests covering every workflow path.
// Every request goes through the real workflow functions; afterwards only timestamps are moved
// back in time (service key, seed only) so charts, timelines and waiting badges look realistic.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserKey } from "./lib";

export const MORE_UNITS: [string, string][] = [["DRUM", "Drum"], ["CTN", "Carton"]];

// [code, name, category, unit, size]
export const MORE_ITEMS: [string, string, string, string, string | null][] = [
  ["W4", "Ice blocks", "Water", "PCS", null],
  ["D3", "Petrol for small plant", "Fuel", "LTR", null],
  ["DB3", "Skip hire (monthly)", "Debris", "LS", "20 yd"],
  ["S6", "Road base (sub-base)", "Sand & aggregate", "TON", null],
  ["S7", "Gabbro 40 mm", "Sand & aggregate", "TON", "40 mm"],
  ["C5", "White cement", "Cement", "BAG", "40 kg"],
  ["C6", "Ready-mix concrete C30", "Cement", "M3", "C30"],
  ["C7", "Non-shrink grout", "Cement", "BAG", "25 kg"],
  ["R7", "Rebar 8 mm", "Steel", "TON", "8 mm, 12 m"],
  ["R8", "Welded mesh A142", "Steel", "PCS", "2.4 x 4.8 m"],
  ["R9", "Steel angle", "Steel", "PCS", "50 x 50 x 5, 6 m"],
  ["B4", "Thermal block", "Blocks", "NOS", "20 x 20 x 40 cm"],
  ["B5", "Interlock paver", "Blocks", "SQM", "80 mm"],
  ["B6", "Kerb stone", "Blocks", "NOS", "50 x 30 x 15 cm"],
  ["T4", "Formwork plywood", "Timber", "PCS", "12 mm, 4 x 8 ft"],
  ["T5", "Wooden pallet", "Timber", "PCS", null],
  ["N4", "Chemical anchor", "Fixings", "PCS", "M16"],
  ["N5", "Drywall screws", "Fixings", "PKT", "Box of 1000"],
  ["WP4", "Crystalline waterproofing", "Waterproofing", "BAG", "25 kg"],
  ["P3", "uPVC elbow", "Plumbing", "PCS", "4 in"],
  ["P4", "PPR pipe", "Plumbing", "PCS", "25 mm, 4 m"],
  ["P5", "Water storage tank", "Plumbing", "PCS", "5,000 L"],
  ["E3", "Power cable", "Electrical", "ROLL", "4 mm², 100 m"],
  ["E4", "LED flood light", "Electrical", "PCS", "200 W"],
  ["E5", "Distribution board", "Electrical", "PCS", "12-way"],
  ["SC3", "Scaffold board", "Scaffolding", "PCS", "3.9 m"],
  ["SC4", "Base jack", "Scaffolding", "PCS", null],
  ["SF8", "Ear defenders", "PPE", "PCS", null],
  ["SF9", "Coverall (summer)", "PPE", "PCS", null],
  ["SF10", "First-aid kit", "PPE", "SET", null],
  ["SF11", "Cooling vest", "PPE", "PCS", null],
  ["TL4", "Angle grinder", "Tools", "PCS", "9 in"],
  ["TL5", "Concrete vibrator", "Tools", "PCS", "38 mm poker"],
  ["TL6", "Spirit level", "Tools", "PCS", "1.2 m"],
  ["PT1", "Emulsion paint (white)", "Paint", "DRUM", "18 L"],
  ["PT2", "Wall primer", "Paint", "DRUM", "18 L"],
  ["PT3", "Road marking paint", "Paint", "DRUM", "20 L"],
];

export const MORE_SUPPLIERS: [string, string][] = [
  ["Sharjah Cement Trading (demo)", "+971 50 000 0007"],
  ["Northern Emirates Blocks (demo)", "+971 50 000 0008"],
  ["Coastal Timber & Plywood (demo)", "+971 50 000 0009"],
  ["PipeLine Plumbing Supplies (demo)", "+971 50 000 0010"],
  ["BrightSpark Electrical (demo)", "+971 50 000 0011"],
  ["Scaffold Pro Rentals (demo)", "+971 50 000 0012"],
];

export const EXTRA_PROJECTS = [
  { no: "168", name: "School Extension", location: "Sharjah", lat: 25.3463, lng: 55.4209, pm: "pm3" as UserKey, members: ["se3"] as UserKey[], closed: false },
  { no: "171", name: "Residential Tower", location: "Dubai Marina", lat: 25.0805, lng: 55.1403, pm: "pm3" as UserKey, members: ["se3", "se4"] as UserKey[], closed: false },
  { no: "174", name: "Labour Accommodation", location: "Ruwais", lat: 24.1103, lng: 52.7306, pm: "pm1" as UserKey, members: ["se4"] as UserKey[], closed: false },
  { no: "180", name: "Road & Utilities", location: "Fujairah", lat: 25.1288, lng: 56.3265, pm: "pm1" as UserKey, members: ["se4"] as UserKey[], closed: false },
  { no: "149", name: "Mall Fit-out (handed over)", location: "Abu Dhabi", lat: 24.4539, lng: 54.3773, pm: "pm3" as UserKey, members: ["se3"] as UserKey[], closed: true },
];

// ---------- deterministic randomness ----------
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261125);
const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
const between = (a: number, b: number) => a + rng() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));

// ---------- request themes ----------
type Line = { code?: string; text?: string; unit: string; qty: number; notes?: string };
type Theme = { purpose: string[]; items: [string, string, number, number][]; suppliers: string[]; projects?: string[] };
const AREAS = ["footings", "ground floor slab", "first floor columns", "roof slab", "basement walls", "podium", "staircase core", "boundary wall"];
const THEMES: Theme[] = [
  { purpose: ["Site water and fuel", "Weekly water & diesel"], items: [["W2", "TANKER", 1, 3], ["W1", "TANKER", 1, 2], ["D1", "LTR", 200, 800], ["D2", "TRIP", 1, 2], ["W3", "PKT", 10, 40]], suppliers: ["Desert Water", "Gulf Fuel"] },
  { purpose: ["Concrete pour – {area}", "Concrete for {area}"], items: [["C3", "M3", 12, 60], ["C6", "M3", 8, 40], ["C1", "BAG", 50, 300], ["S1", "TON", 5, 25], ["S4", "TON", 5, 20], ["C7", "BAG", 10, 40]], suppliers: ["Emirates Building", "Sharjah Cement"] },
  { purpose: ["Rebar for {area}", "Reinforcement – {area}"], items: [["R2", "TON", 1, 6], ["R3", "TON", 1, 5], ["R4", "TON", 1, 4], ["R1", "TON", 1, 3], ["R6", "ROLL", 4, 20], ["R8", "PCS", 20, 80], ["R7", "TON", 1, 2]], suppliers: ["Steel Line"] },
  { purpose: ["Blockwork – {area}", "Masonry for {area}"], items: [["B1", "NOS", 500, 3000], ["B2", "NOS", 300, 1500], ["B4", "NOS", 200, 1200], ["C1", "BAG", 40, 200], ["S2", "TRIP", 1, 3]], suppliers: ["Northern Emirates Blocks", "Emirates Building"] },
  { purpose: ["PPE top-up", "PPE for new labour batch", "Summer safety kit"], items: [["SF1", "PCS", 10, 60], ["SF2", "PCS", 10, 60], ["SF3", "PCS", 10, 40], ["SF4", "PCS", 20, 100], ["SF7", "PKT", 2, 10], ["SF9", "PCS", 10, 50], ["SF11", "PCS", 10, 30], ["SF10", "SET", 1, 4]], suppliers: ["SafeSite"] },
  { purpose: ["MEP first fix – {area}", "Plumbing & electrical – {area}"], items: [["P1", "PCS", 10, 60], ["P2", "PCS", 10, 60], ["P3", "PCS", 20, 100], ["P4", "PCS", 20, 120], ["E1", "PCS", 30, 200], ["E3", "ROLL", 2, 10], ["E5", "PCS", 1, 4]], suppliers: ["PipeLine Plumbing", "BrightSpark Electrical"] },
  { purpose: ["Formwork – {area}", "Shuttering for {area}"], items: [["T1", "PCS", 40, 200], ["T4", "PCS", 40, 150], ["T2", "PCS", 50, 300], ["T3", "LTR", 40, 200], ["N1", "KG", 20, 100]], suppliers: ["Coastal Timber", "Emirates Building"] },
  { purpose: ["Waterproofing – {area}", "Roof waterproofing"], items: [["WP1", "ROLL", 10, 60], ["WP2", "ROLL", 5, 20], ["WP3", "LTR", 40, 200], ["WP4", "BAG", 10, 50]], suppliers: ["Emirates Building"] },
  { purpose: ["Scaffolding – {area}", "Façade scaffolding"], items: [["SC1", "PCS", 50, 300], ["SC2", "PCS", 100, 600], ["SC3", "PCS", 40, 200], ["SC4", "PCS", 20, 100]], suppliers: ["Scaffold Pro"] },
  { purpose: ["Debris removal", "Skip collection"], items: [["DB1", "TRIP", 1, 4], ["DB2", "TRIP", 1, 3], ["DB3", "LS", 1, 1]], suppliers: ["Emirates Building"] },
  { purpose: ["Painting – {area}", "Internal finishes"], items: [["PT1", "DRUM", 10, 60], ["PT2", "DRUM", 5, 30]], suppliers: ["Emirates Building"] },
  { purpose: ["Tools replacement", "Small plant & tools"], items: [["TL1", "PCS", 2, 10], ["TL2", "PCS", 5, 20], ["TL4", "PCS", 1, 4], ["TL5", "PCS", 1, 3], ["TL6", "PCS", 2, 8]], suppliers: ["Emirates Building"] },
  { purpose: ["Road works section {n}", "Road base and kerbs"], items: [["S6", "TON", 40, 200], ["S7", "TON", 20, 100], ["B5", "SQM", 100, 600], ["B6", "NOS", 100, 400], ["PT3", "DRUM", 4, 20]], suppliers: ["Al Ain Sand", "Northern Emirates Blocks"], projects: ["180"] },
];
const FREE_TEXT = ["Hessian cloth for curing", "Tarpaulin 6 x 8 m", "Temporary site signage", "Masking tape 2 in", "Drinking water dispenser", "Cable ties (assorted)", "Consultant-approved sealant", "Safety barrier tape"];

function makeLines(theme: Theme): Line[] {
  const n = int(1, Math.min(5, theme.items.length));
  const chosen = [...theme.items].sort(() => rng() - 0.5).slice(0, n);
  const lines: Line[] = chosen.map(([code, unit, a, b]) => ({ code, unit, qty: Math.max(1, Math.round(between(a, b) / (b > 50 ? 10 : 1)) * (b > 50 ? 10 : 1)) }));
  if (rng() < 0.22) lines.push({ text: pick(FREE_TEXT), unit: "PCS", qty: int(2, 30) });
  if (rng() < 0.15 && lines[0]) lines[0].notes = pick(["Consultant-approved brand only", "Deliver before 10 am", "Gate 2 access", "Coordinate with foreman"]);
  return lines;
}

// ---------- flows ----------
type Step = "send" | "return" | "resend" | "forward" | "pmReturn" | "approve" | "adminApprove" | "reject" | "order" | "orderUpdate" | "receive" | "receiveShort" | "cancelReq" | "cancelAdmin";
const FLOWS: Record<string, { steps: Step[]; weight: number }> = {
  delivered: { steps: ["send", "forward", "approve", "order", "receive"], weight: 46 },
  returnedToSite: { steps: ["send", "return", "resend", "forward", "approve", "order", "receive"], weight: 9 },
  pmReturned: { steps: ["send", "forward", "pmReturn", "forward", "approve", "order", "receive"], weight: 8 },
  rejected: { steps: ["send", "forward", "reject"], weight: 8 },
  cancelledByRequester: { steps: ["send", "cancelReq"], weight: 5 },
  supplierFailed: { steps: ["send", "forward", "approve", "order", "cancelAdmin"], weight: 3 },
  supplierChanged: { steps: ["send", "forward", "approve", "order", "orderUpdate", "receive"], weight: 6 },
  shortDelivery: { steps: ["send", "forward", "approve", "order", "receiveShort"], weight: 5 },
};
// Open requests left waiting (drive the amber/red badges and the board)
const STALE: { steps: Step[]; staleH: [number, number] }[] = [
  { steps: ["send"], staleH: [60, 90] },
  { steps: ["send", "forward"], staleH: [80, 110] },
  { steps: ["send", "forward"], staleH: [26, 40] },
  { steps: ["send", "forward", "approve"], staleH: [55, 70] },
  { steps: ["send", "forward", "approve"], staleH: [28, 36] },
  { steps: ["send", "forward", "approve", "order"], staleH: [100, 130] },
  { steps: ["send", "forward", "approve", "order"], staleH: [20, 30] },
  { steps: ["send", "return"], staleH: [50, 60] },
  { steps: ["send", "forward", "pmReturn"], staleH: [30, 40] },
  { steps: ["send"], staleH: [6, 14] },
  { steps: ["send", "forward"], staleH: [3, 8] },
];
const ACTION_OF: Record<Step, string> = {
  send: "sent", return: "returned_to_site", resend: "resent", forward: "forwarded_to_pm", pmReturn: "returned_to_procurement",
  approve: "approved", adminApprove: "approved", reject: "rejected", order: "order_recorded", orderUpdate: "order_updated",
  receive: "receipt_confirmed", receiveShort: "receipt_confirmed", cancelReq: "cancelled", cancelAdmin: "cancelled",
};
const HOURS: Record<Step, [number, number]> = {
  send: [0, 0], return: [1, 6], resend: [2, 20], forward: [0.5, 8], pmReturn: [2, 24], approve: [1, 30], adminApprove: [6, 30],
  reject: [2, 24], order: [3, 36], orderUpdate: [4, 24], receive: [10, 72], receiveShort: [10, 72], cancelReq: [1, 10], cancelAdmin: [24, 72],
};
const COMMENTS = {
  return: ["Please confirm quantity against the BOQ.", "Specify the size and grade.", "Attach the consultant approval reference.", "Split into two requests: urgent items first."],
  pmReturn: ["Check if stock is available from another site.", "Get a second quotation first.", "Quantity looks high, please verify with the site."],
  reject: ["Material available from project 162, transfer instead.", "Not in the approved budget for this stage.", "Duplicate of an earlier request."],
  cancelReq: ["Duplicate request.", "No longer needed, design changed.", "Raised on the wrong project."],
  cancelAdmin: ["Supplier could not deliver. Re-raise with a new supplier.", "Order cancelled after supplier delay."],
  forward: ["Quantities checked.", "Checked against BOQ.", "Urgent, please approve today.", ""],
  receive: ["Received in full.", "All items delivered in good condition.", "Delivered, checked by foreman.", ""],
  short: ["Short delivery: 10% missing, supplier to deliver balance.", "Two items damaged, replacement requested.", "Partial delivery received, balance next week."],
};

type Ctx = {
  db: SupabaseClient;
  check: <R extends { data: unknown; error: { message: string } | null }>(res: R, what: string) => NonNullable<R["data"]>;
  create: (who: UserKey, project: string, lines: Line[], opts: { days: number; urgent?: string; purpose?: string }) => Promise<string>;
  rpc: (who: UserKey, fn: string, args: Record<string, unknown>) => Promise<void>;
  sup: (prefix: string) => string;
  projects: { no: string; pm: UserKey; members: UserKey[] }[];
};

type Plan = { project: string; requester: UserKey; pm: UserKey; theme: Theme; steps: Step[]; times: number[]; urgent?: string; purpose: string };

const H = 3_600_000;
const DAY = 24 * H;

function planTimes(steps: Step[], start: number) {
  const times: number[] = [];
  let t = start;
  for (const s of steps) {
    const [a, b] = HOURS[s];
    t += between(a, b) * H;
    times.push(t);
  }
  return times;
}

export async function seedScenarios(ctx: Ctx) {
  const now = Date.now();
  const plans: Plan[] = [];
  const weighted = Object.values(FLOWS).flatMap((f) => Array(f.weight).fill(f.steps) as Step[][]);
  const active = ctx.projects.filter((p) => p.no !== "GEN");

  const makePlan = (steps: Step[], start: number | null, endAt: number | null, projectNo?: string): Plan => {
    const p = projectNo ? ctx.projects.find((x) => x.no === projectNo)! : pick(active);
    const theme = pick(THEMES.filter((th) => !th.projects || th.projects.includes(p.no)));
    const urgent = rng() < 0.18 ? pick(["Pour scheduled tomorrow", "Generators running low", "Inspection on Thursday", "Crane booked for Saturday"]) : undefined;
    let times = planTimes(steps, 0);
    const total = times[times.length - 1];
    const t0 = endAt !== null ? endAt - total : start!;
    times = times.map((x) => x + t0);
    const purpose = pick(theme.purpose).replace("{area}", pick(AREAS)).replace("{n}", String(int(1, 6)));
    return { project: p.no, requester: pick(p.members.filter((m) => m.startsWith("se"))), pm: p.pm, theme, steps, times, urgent, purpose };
  };

  // Closed history over the last 6 weeks (project 149 only before it was handed over)
  for (let i = 0; i < 82; i++) {
    const daysAgo = between(3, 42);
    const workHour = int(7, 15);
    const start = now - daysAgo * DAY;
    const startAt = start - (new Date(start).getUTCHours() + 4 - workHour) * H; // ~work hours in Dubai
    let plan = makePlan(pick(weighted), startAt, null);
    if (plan.project === "149" && daysAgo < 25) plan = makePlan(plan.steps, startAt, null, "155");
    if (plan.times[plan.times.length - 1] > now - 2 * H) continue;
    plans.push(plan);
  }
  // A PM raising a request on the general project: Admin approves it (separation of duties)
  for (const d of [30, 12]) {
    const steps: Step[] = ["send", "forward", "adminApprove", "order", "receive"];
    const plan = makePlan(steps, now - d * DAY, null, "GEN");
    plan.requester = "pm1";
    plan.purpose = "Site office supplies";
    plans.push(plan);
  }
  // Open requests that have been waiting
  for (const s of STALE) {
    const endAt = now - between(s.staleH[0], s.staleH[1]) * H;
    plans.push(makePlan(s.steps, null, endAt, pick(active.filter((p) => p.no !== "149")).no));
  }

  plans.sort((a, b) => a.times[0] - b.times[0]);
  let done = 0;
  for (const p of plans) {
    await runPlan(ctx, p, now);
    if (++done % 20 === 0) console.log(`  … ${done}/${plans.length} history requests`);
  }
  console.log(`History: ${plans.length} requests over 6 weeks (all workflow paths, ${STALE.length} still waiting).`);
}

async function runPlan(ctx: Ctx, p: Plan, now: number) {
  const { db, check, create, rpc, sup } = ctx;
  const id = await create(p.requester, p.project, makeLines(p.theme), { days: 3, urgent: p.urgent, purpose: p.purpose });
  const proc: UserKey = rng() < 0.6 ? "proc1" : "proc2";
  const supplierA = sup(pick(p.theme.suppliers));
  const supplierB = sup(pick(["Emirates Building", "Sharjah Cement", "Coastal Timber", "Al Ain Sand"]));
  const receiver: UserKey = p.requester.startsWith("se") ? p.requester : "se1";
  for (const s of p.steps) {
    const a = { p_request_id: id };
    switch (s) {
      case "send": case "resend": await rpc(p.requester, "rpc_send_request", a); break;
      case "return": await rpc(proc, "rpc_return_to_site", { ...a, p_comment: pick(COMMENTS.return) }); break;
      case "forward": { const c = pick(COMMENTS.forward); await rpc(proc, "rpc_forward_to_pm", c ? { ...a, p_comment: c } : a); break; }
      case "pmReturn": await rpc(p.pm, "rpc_pm_return", { ...a, p_comment: pick(COMMENTS.pmReturn) }); break;
      case "approve": await rpc(p.pm, "rpc_pm_approve", a); break;
      case "adminApprove": await rpc("admin", "rpc_pm_approve", { ...a, p_comment: "PM raised this request; approved by the Technical Office." }); break;
      case "reject": await rpc(p.pm, "rpc_pm_reject", { ...a, p_comment: pick(COMMENTS.reject) }); break;
      case "order": await rpc(proc, "rpc_record_order", { ...a, p_supplier_id: supplierA, p_delivery_date: dubai(1) }); break;
      case "orderUpdate": await rpc(proc, "rpc_record_order", { ...a, p_supplier_id: supplierB, p_delivery_date: dubai(2), p_comment: "First supplier out of stock, switched supplier." }); break;
      case "receive": { const n = pick(COMMENTS.receive); await rpc(receiver, "rpc_confirm_receipt", n ? { ...a, p_notes: n } : a); break; }
      case "receiveShort": await rpc(receiver, "rpc_confirm_receipt", { ...a, p_notes: pick(COMMENTS.short) }); break;
      case "cancelReq": await rpc(p.requester, "rpc_cancel_request", { ...a, p_comment: pick(COMMENTS.cancelReq) }); break;
      case "cancelAdmin": await rpc("admin", "rpc_cancel_request", { ...a, p_comment: pick(COMMENTS.cancelAdmin) }); break;
    }
  }

  // ---- backdate to the planned times
  const logs = check(await db.from("activity_log").select("id,action").eq("request_id", id).order("id"), "logs");
  const approvals = check(await db.from("approvals").select("id").eq("request_id", id).order("decided_at"), "approvals");
  let ai = 0;
  const at: Record<string, string> = {};
  for (let i = 0; i < logs.length; i++) {
    const iso = new Date(Math.min(p.times[i] ?? p.times[p.times.length - 1], now - 60_000)).toISOString();
    at[logs[i].action] = iso;
    check(await db.from("activity_log").update({ created_at: iso }).eq("id", logs[i].id), "log time");
    if (["forwarded_to_pm", "returned_to_site", "returned_to_procurement", "approved", "rejected"].includes(logs[i].action) && approvals[ai]) {
      check(await db.from("approvals").update({ decided_at: iso }).eq("id", approvals[ai++].id), "approval time");
    }
  }
  const sent = new Date(p.times[0]);
  const lastOrder = at.order_updated ?? at.order_recorded;
  if (lastOrder) {
    const delivery = new Date(new Date(lastOrder).getTime() + int(1, 3) * DAY).toISOString().slice(0, 10);
    check(await db.from("procurement_details").update({ recorded_at: lastOrder, agreed_delivery_date: delivery }).eq("request_id", id), "order time");
  }
  if (at.receipt_confirmed) check(await db.from("receipts").update({ confirmed_at: at.receipt_confirmed }).eq("request_id", id), "receipt time");
  check(await db.from("purchase_requests").update({
    created_at: new Date(sent.getTime() - between(0.2, 3) * H).toISOString(),
    sent_at: sent.toISOString(),
    updated_at: new Date(Math.min(p.times[p.times.length - 1], now - 60_000)).toISOString(),
    required_date: new Date(sent.getTime() + int(2, 6) * DAY).toISOString().slice(0, 10),
  }).eq("id", id), "request times");
}

function dubai(offsetDays: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(Date.now() + offsetDays * DAY));
}
