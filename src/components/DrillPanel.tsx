// Drill-down: the requests behind a chart value. Bottom sheet on phones, centred panel on desktop.
import { ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { RequestRow } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import { fmtHours, type Drill } from "@/lib/metrics";
import { stagger } from "@/lib/motion";
import { StatusBadge, UrgentBadge } from "./StatusBadge";
import { cn } from "./ui";

export type DrillState = { title: string; subtitle?: string; drill: Drill; hoursLabel?: string } | null;

export function DrillPanel({ state, rows, onClose }: { state: DrillState; rows: RequestRow[]; onClose: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!state) return;
    setQ("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [state, onClose]);

  const list = useMemo(() => {
    if (!state) return [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const hours = state.drill.hours;
    const xs = state.drill.ids.map((id) => byId.get(id)).filter((r): r is RequestRow => !!r);
    xs.sort((a, b) => (hours ? (hours[b.id] ?? 0) - (hours[a.id] ?? 0) : b.updated_at.localeCompare(a.updated_at)));
    const s = q.trim().toLowerCase();
    return s
      ? xs.filter((r) => `${r.request_no} ${r.project?.project_no} ${r.project?.name} ${r.purpose ?? ""} ${r.requester?.full_name ?? ""}`.toLowerCase().includes(s))
      : xs;
  }, [state, rows, q]);

  if (!state) return null;
  const hours = state.drill.hours;
  const maxH = hours ? Math.max(1, ...Object.values(hours)) : 1;

  // Portal to <body> so the panel is never trapped under the fixed bottom nav.
  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={state.title}>
      <div className="absolute inset-0 animate-fade-in bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full max-w-2xl animate-sheet-up flex-col rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" aria-hidden />
        <div className="flex items-start gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{state.title}</h2>
            <p className="text-sm text-slate-500">
              {state.subtitle ? `${state.subtitle} · ` : ""}
              {list.length === 1 ? t("1 request") : t("{n} requests", { n: list.length })}
              {hours ? ` · ${t("slowest first")}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="-me-2 rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label={t("Close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {state.drill.ids.length > 6 && (
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={q} maxLength={LIMITS.search} aria-label={t("Filter by number, project, purpose or person…")} onChange={(e) => setQ(e.target.value)} placeholder={t("Filter by number, project, purpose or person…")}
                className="block w-full rounded-xl border-0 bg-slate-50 py-2 pe-3 ps-9 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
        )}
        <ul className="flex-1 space-y-2 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          {list.length === 0 && <li className="py-10 text-center text-sm text-slate-500">{t("No matches")}</li>}
          {list.map((r, i) => {
            const h = hours?.[r.id];
            return (
              <li key={r.id} className="animate-fade-up" style={stagger(i, 25, 20)}>
                <Link to={`/requests/${r.id}`} onClick={onClose}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 transition-colors hover:border-brand-200 hover:bg-brand-50/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="whitespace-nowrap text-sm font-bold text-slate-900">{r.request_no}</span>
                      <StatusBadge status={r.status} />
                      {r.urgency === "urgent" && <UrgentBadge />}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">{r.project?.project_no}</span> · {r.purpose || r.project?.name}
                      {r.requester ? ` · ${r.requester.full_name}` : ""}
                    </div>
                    {h === undefined && (
                      <div className="mt-0.5 text-xs text-slate-500 sm:hidden">{t("Needed {date}", { date: fmtDate(r.required_date) })}</div>
                    )}
                    {h !== undefined && (
                      <div className="mt-1.5 h-1.5 w-full rounded-full" style={{ background: "var(--viz-track)" }}>
                        <div className="h-1.5 rounded-[3px]" style={{ width: `${(h / maxH) * 100}%`, background: "var(--viz-1)" }} />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-end">
                    {h !== undefined
                      ? <div className={cn("text-sm font-extrabold", h > 48 ? "text-rose-700" : h > 24 ? "text-amber-800" : "text-slate-900")}>{fmtHours(h).text}</div>
                      : <div className="hidden text-xs text-slate-500 sm:block">{t("Needed {date}", { date: fmtDate(r.required_date) })}</div>}
                    {h !== undefined && state.hoursLabel && <div className="text-[11px] text-slate-500">{state.hoursLabel}</div>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand-500 rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
