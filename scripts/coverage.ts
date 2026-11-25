// Reports which data types and workflow paths exist in the demo data. Usage: npx tsx scripts/coverage.ts
import { adminClient } from "./lib";

const db = adminClient();
const all = async <T,>(table: string, cols: string) => ((await db.from(table).select(cols).limit(5000)).data ?? []) as T[];

const reqs = await all<{ id: string; status: string; urgency: string; updated_at: string; project_id: string }>("purchase_requests", "id,status,urgency,updated_at,project_id");
const logs = await all<{ request_id: string; action: string; acted_as: string | null; comment: string | null }>("activity_log", "request_id,action,acted_as,comment");
const lines = await all<{ item_id: string | null; notes: string | null }>("request_lines", "item_id,notes");
const projects = await all<{ id: string; project_no: string; status: string; lat: number | null }>("projects", "id,project_no,status,lat");
const receipts = await all<{ notes: string | null }>("receipts", "notes");
const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});

const byReq = new Map<string, string[]>();
for (const l of logs) byReq.set(l.request_id, [...(byReq.get(l.request_id) ?? []), l.action]);
const path = (pred: (a: string[]) => boolean) => [...byReq.values()].filter(pred).length;
const OPEN = ["pending_procurement", "pending_pm", "approved_sourcing", "ordered", "returned_to_site", "returned_to_procurement"];
const age = (r: { updated_at: string }) => (Date.now() - Date.parse(r.updated_at)) / 86_400_000;

console.log(JSON.stringify({
  requests: reqs.length,
  byStatus: count(reqs.map((r) => r.status)),
  urgent: reqs.filter((r) => r.urgency === "urgent").length,
  projects: projects.map((p) => `${p.project_no}${p.status === "closed" ? " (closed)" : ""}: ${reqs.filter((r) => r.project_id === p.id).length}`),
  projectsOnMap: projects.filter((p) => p.lat != null).length,
  lines: { total: lines.length, freeText: lines.filter((l) => !l.item_id).length, withNotes: lines.filter((l) => l.notes).length },
  paths: {
    delivered: path((a) => a.includes("receipt_confirmed")),
    returnedToSiteThenResent: path((a) => a.includes("returned_to_site") && a.includes("resent")),
    pmReturnedToProcurement: path((a) => a.includes("returned_to_procurement")),
    rejected: path((a) => a.includes("rejected")),
    cancelled: path((a) => a.includes("cancelled")),
    cancelledAfterOrder: path((a) => a.includes("cancelled") && a.includes("order_recorded")),
    supplierChanged: path((a) => a.includes("order_updated")),
    approvedByAdmin: logs.filter((l) => l.action === "approved" && l.acted_as === "admin").length,
    shortDeliveryNotes: receipts.filter((r) => r.notes && /short|partial|damaged/i.test(r.notes)).length,
  },
  waitingBadges: {
    amber_1to2_days: reqs.filter((r) => OPEN.includes(r.status) && age(r) > 1 && age(r) <= 2).length,
    red_over_2_days: reqs.filter((r) => OPEN.includes(r.status) && age(r) > 2).length,
  },
}, null, 1));
