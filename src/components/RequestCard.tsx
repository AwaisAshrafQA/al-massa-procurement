import { CalendarClock, ChevronRight, Layers } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { RequestRow } from "@/lib/api";
import { ago, fmtDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { stagger } from "@/lib/motion";
import { StatusBadge, UrgentBadge, WaitingBadge } from "./StatusBadge";

export function RequestCardBody({ r, showRequester }: { r: RequestRow; showRequester?: boolean }) {
  const { t } = useI18n();
  const lines = r.lines?.[0]?.count ?? 0;
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold tracking-tight text-slate-900">{r.request_no ?? t("Draft")}</span>
        <StatusBadge status={r.status} />
        {r.urgency === "urgent" && <UrgentBadge />}
        <WaitingBadge status={r.status} updatedAt={r.updated_at} />
      </div>
      <div className="truncate text-sm text-slate-600">
        <span className="font-semibold text-slate-700">{r.project?.project_no}</span> · {r.project?.name}
        {r.purpose ? ` · ${r.purpose}` : ""}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{lines === 1 ? t("1 line") : t("{n} lines", { n: lines })}</span>
        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{t("Needed {date}", { date: fmtDate(r.required_date) })}</span>
        {showRequester && r.requester && <span>{t("By {name}", { name: r.requester.full_name })}</span>}
        <span>{t("Updated {ago}", { ago: ago(r.updated_at) })}</span>
      </div>
    </div>
  );
}

export function RequestList({ rows, showRequester, wrap }: {
  rows: RequestRow[]; showRequester?: boolean;
  /** Optional wrapper per row (e.g. swipe actions). */
  wrap?: (r: RequestRow, card: ReactNode) => ReactNode;
}) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => {
        const card = (
          <Link
            to={`/requests/${r.id}`}
            className="lift group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {r.urgency === "urgent" && <span className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-rose-400 to-rose-600" aria-hidden />}
            <RequestCardBody r={r} showRequester={showRequester} />
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500 rtl:rotate-180" aria-hidden />
          </Link>
        );
        return (
          <li key={r.id} className="animate-fade-up" style={stagger(i)}>
            {wrap ? wrap(r, card) : card}
          </li>
        );
      })}
    </ul>
  );
}
