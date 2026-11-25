import type { RequestRow } from "./api";
import { fmtDayMonth } from "./format";
import { translate as t } from "./i18n";
import { STATUS_LABEL, type Status } from "./strings";

export type LogRow = { request_id: string; action: string; created_at: string };

const H = 3_600_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

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

function durations(from: Map<string, number>, to: Map<string, number>) {
  const out: number[] = [];
  for (const [id, t0] of from) {
    const t1 = to.get(id);
    if (t1 !== undefined && t1 >= t0) out.push((t1 - t0) / H);
  }
  return out;
}

export const PIPELINE: Status[] = [
  "pending_procurement", "returned_to_site", "returned_to_procurement", "pending_pm", "approved_sourcing", "ordered", "received", "rejected", "cancelled",
];

export function computeMetrics(rows: RequestRow[], logs: LogRow[]) {
  const sentRows = rows.filter((r) => r.status !== "draft");
  const sent = firstOf(logs, ["sent"]);
  const forwarded = firstOf(logs, ["forwarded_to_pm"]);
  const decided = firstOf(logs, ["approved", "rejected"]);
  const ordered = firstOf(logs, ["order_recorded"]);
  const received = firstOf(logs, ["receipt_confirmed"]);

  const toDecision = durations(sent, decided);
  const steps = [
    { label: "Procurement review", value: avg(durations(sent, forwarded)), n: durations(sent, forwarded).length },
    { label: "PM decision", value: avg(durations(forwarded, decided)), n: durations(forwarded, decided).length },
    { label: "Sourcing", value: avg(durations(firstOf(logs, ["approved"]), ordered)), n: durations(firstOf(logs, ["approved"]), ordered).length },
    { label: "Delivery to site", value: avg(durations(ordered, received)), n: durations(ordered, received).length },
  ];

  const statusCounts = PIPELINE.map((s) => ({ key: s, label: STATUS_LABEL[s], value: sentRows.filter((r) => r.status === s).length }))
    .filter((d) => d.value > 0);

  const proj = new Map<string, { label: string; value: number }>();
  for (const r of sentRows) {
    const k = r.project?.project_no ?? "?";
    const cur = proj.get(k) ?? { label: `${k} · ${r.project?.name ?? ""}`, value: 0 };
    cur.value++;
    proj.set(k, cur);
  }
  const byProject = [...proj.values()].sort((a, b) => b.value - a.value);

  // Per-day series, last 14 days (Dubai dates)
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" });
  const mk = () => {
    const out: { key: string; label: string; value: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      out.push({ key: fmt.format(d), label: fmtDayMonth(d), value: 0 });
    }
    return out;
  };
  const days = mk();
  for (const r of sentRows) {
    if (!r.sent_at) continue;
    const day = days.find((d) => d.key === fmt.format(new Date(r.sent_at!)));
    if (day) day.value++;
  }
  const receiptsPerDay = mk();
  for (const t of received.values()) {
    const day = receiptsPerDay.find((d) => d.key === fmt.format(new Date(t)));
    if (day) day.value++;
  }

  // Week-over-week: sent volume and time to PM decision (by decision date)
  const now = Date.now();
  const W = 7 * 86_400_000;
  const inWeek = (t: number, back: number) => t > now - (back + 1) * W && t <= now - back * W;
  const sentThisWeek = [...sent.values()].filter((t) => inWeek(t, 0)).length;
  const sentLastWeek = [...sent.values()].filter((t) => inWeek(t, 1)).length;
  const decisionWeek = (back: number) => {
    const xs: number[] = [];
    for (const [id, t0] of sent) {
      const t1 = decided.get(id);
      if (t1 !== undefined && inWeek(t1, back)) xs.push((t1 - t0) / H);
    }
    return avg(xs);
  };

  // Per project
  const projects = new Map<string, { id: string; total: number; received: number; open: number; urgent: number; decisions: number[] }>();
  for (const r of sentRows) {
    const p = projects.get(r.project_id) ?? { id: r.project_id, total: 0, received: 0, open: 0, urgent: 0, decisions: [] };
    p.total++;
    if (r.status === "received") p.received++;
    if (!["received", "rejected", "cancelled"].includes(r.status)) {
      p.open++;
      if (r.urgency === "urgent") p.urgent++;
    }
    const t0 = sent.get(r.id), t1 = decided.get(r.id);
    if (t0 !== undefined && t1 !== undefined) p.decisions.push((t1 - t0) / H);
    projects.set(r.project_id, p);
  }
  const perProject = [...projects.values()].map((p) => ({ ...p, avgDecisionH: avg(p.decisions) }));

  const closed = sentRows.filter((r) => ["received", "rejected", "cancelled"].includes(r.status)).length;
  return {
    total: sentRows.length,
    open: sentRows.length - closed,
    received: sentRows.filter((r) => r.status === "received").length,
    urgentOpen: sentRows.filter((r) => r.urgency === "urgent" && !["received", "rejected", "cancelled"].includes(r.status)).length,
    avgToDecisionH: avg(toDecision),
    decisionsMeasured: toDecision.length,
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
