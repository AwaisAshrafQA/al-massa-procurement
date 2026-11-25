import type { RequestRow } from "./api";
import { fmtDayMonth } from "./format";
import { translate as t } from "./i18n";
import { STATUS_LABEL, type Status } from "./strings";

export type LogRow = { request_id: string; action: string; created_at: string };

/** The requests behind a chart value, optionally with an hours figure per request (for step timings). */
export type Drill = { ids: string[]; hours?: Record<string, number> };

const H = 3_600_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const CLOSED = ["received", "rejected", "cancelled"];

/** First timestamp (ms) of any of the given actions for each request. */
function firstOf(logs: LogRow[], actions: string[]) {
  const m = new Map<string, number>();
  for (const l of logs) {
    if (!actions.includes(l.action)) continue;
    const t = Date.parse(l.created_at);
    const prev = m.get(l.request_id);
    if (prev === undefined || t < prev) m.set(l.request_id, t);
  }
  return m;
}

/** Hours between two events, per request that has both. */
function durations(from: Map<string, number>, to: Map<string, number>) {
  const out: Record<string, number> = {};
  for (const [id, t0] of from) {
    const t1 = to.get(id);
    if (t1 !== undefined && t1 >= t0) out[id] = (t1 - t0) / H;
  }
  return out;
}

export const PIPELINE: Status[] = [
  "pending_procurement", "returned_to_site", "returned_to_procurement", "pending_pm", "approved_sourcing", "ordered", "received", "rejected", "cancelled",
];

export function computeMetrics(rows: RequestRow[], logs: LogRow[]) {
  const sentRows = rows.filter((r) => r.status !== "draft");
  const ids = (xs: RequestRow[]) => xs.map((r) => r.id);
  const sent = firstOf(logs, ["sent"]);
  const forwarded = firstOf(logs, ["forwarded_to_pm"]);
  const decided = firstOf(logs, ["approved", "rejected"]);
  const ordered = firstOf(logs, ["order_recorded"]);
  const received = firstOf(logs, ["receipt_confirmed"]);

  const toDecision = durations(sent, decided);
  const step = (label: string, d: Record<string, number>) => {
    const vals = Object.values(d);
    return { label, value: avg(vals), n: vals.length, drill: { ids: Object.keys(d), hours: d } as Drill };
  };
  const steps = [
    step("Procurement review", durations(sent, forwarded)),
    step("PM decision", durations(forwarded, decided)),
    step("Sourcing", durations(firstOf(logs, ["approved"]), ordered)),
    step("Delivery to site", durations(ordered, received)),
  ];

  const statusCounts = PIPELINE.map((s) => {
    const xs = sentRows.filter((r) => r.status === s);
    return { key: s, label: STATUS_LABEL[s], value: xs.length, drill: { ids: ids(xs) } as Drill };
  }).filter((d) => d.value > 0);

  const proj = new Map<string, { label: string; value: number; drill: Drill }>();
  for (const r of sentRows) {
    const k = r.project_id;
    const cur = proj.get(k) ?? { label: `${r.project?.project_no ?? "?"} · ${r.project?.name ?? ""}`, value: 0, drill: { ids: [] } };
    cur.value++;
    cur.drill.ids.push(r.id);
    proj.set(k, cur);
  }
  const byProject = [...proj.values()].sort((a, b) => b.value - a.value);

  // Per-day series, last 14 days (Dubai dates)
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" });
  const mk = () => {
    const out: { key: string; label: string; value: number; drill: Drill }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      out.push({ key: fmt.format(d), label: fmtDayMonth(d), value: 0, drill: { ids: [] } });
    }
    return out;
  };
  const days = mk();
  for (const r of sentRows) {
    if (!r.sent_at) continue;
    const day = days.find((d) => d.key === fmt.format(new Date(r.sent_at!)));
    if (day) { day.value++; day.drill.ids.push(r.id); }
  }
  const receiptsPerDay = mk();
  for (const [id, ts] of received) {
    const day = receiptsPerDay.find((d) => d.key === fmt.format(new Date(ts)));
    if (day) { day.value++; day.drill.ids.push(id); }
  }

  // Week-over-week: sent volume and time to PM decision (by decision date)
  const now = Date.now();
  const W = 7 * 86_400_000;
  const inWeek = (ts: number, back: number) => ts > now - (back + 1) * W && ts <= now - back * W;
  const sentThisWeek = [...sent.values()].filter((ts) => inWeek(ts, 0)).length;
  const sentLastWeek = [...sent.values()].filter((ts) => inWeek(ts, 1)).length;
  const decisionWeek = (back: number) => {
    const xs: number[] = [];
    for (const [id, t0] of sent) {
      const t1 = decided.get(id);
      if (t1 !== undefined && inWeek(t1, back)) xs.push((t1 - t0) / H);
    }
    return avg(xs);
  };

  // Per project
  const projects = new Map<string, { id: string; total: number; received: number; open: number; urgent: number; decisions: number[]; drill: Drill }>();
  for (const r of sentRows) {
    const p = projects.get(r.project_id) ?? { id: r.project_id, total: 0, received: 0, open: 0, urgent: 0, decisions: [], drill: { ids: [] } };
    p.total++;
    p.drill.ids.push(r.id);
    if (r.status === "received") p.received++;
    if (!CLOSED.includes(r.status)) {
      p.open++;
      if (r.urgency === "urgent") p.urgent++;
    }
    if (toDecision[r.id] !== undefined) p.decisions.push(toDecision[r.id]);
    projects.set(r.project_id, p);
  }
  const perProject = [...projects.values()].map((p) => ({ ...p, avgDecisionH: avg(p.decisions) }));

  const openRows = sentRows.filter((r) => !CLOSED.includes(r.status));
  const urgentOpenRows = openRows.filter((r) => r.urgency === "urgent");
  const receivedRows = sentRows.filter((r) => r.status === "received");
  return {
    total: sentRows.length,
    open: openRows.length,
    received: receivedRows.length,
    urgentOpen: urgentOpenRows.length,
    avgToDecisionH: avg(Object.values(toDecision)),
    decisionsMeasured: Object.keys(toDecision).length,
    drills: {
      open: { ids: ids(openRows) } as Drill,
      urgentOpen: { ids: ids(urgentOpenRows) } as Drill,
      received: { ids: ids(receivedRows) } as Drill,
      toDecision: { ids: Object.keys(toDecision), hours: toDecision } as Drill,
    },
    steps,
    statusCounts,
    byProject,
    perDay: days,
    receiptsPerDay,
    sentThisWeek,
    sentLastWeek,
    decisionThisWeekH: decisionWeek(0),
    decisionLastWeekH: decisionWeek(1),
    perProject,
  };
}

/** 5.2 -> "5.2 h", 30 -> "1.3 d" */
export function fmtHours(h: number): { value: number; unit: string; text: string } {
  if (!Number.isFinite(h)) return { value: 0, unit: "", text: "—" };
  if (h < 48) return { value: Math.round(h * 10) / 10, unit: "h", text: `${(Math.round(h * 10) / 10).toFixed(1)} ${t("h")}` };
  const d = h / 24;
  return { value: Math.round(d * 10) / 10, unit: "d", text: `${d.toFixed(1)} ${t("d")}` };
}
