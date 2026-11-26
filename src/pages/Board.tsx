import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { WaitingBadge } from "@/components/StatusBadge";
import { Alert, ListSkeleton, PageHeader, cn } from "@/components/ui";
import { listRequests, type RequestRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { stagger } from "@/lib/motion";
import { STATUS_LABEL, type Status } from "@/lib/strings";

type Col = { key: string; title: string; statuses: Status[]; dot: string; filter?: (r: RequestRow) => boolean };

const COLS: Col[] = [
  { key: "site", title: "Returned to site", statuses: ["returned_to_site"], dot: "bg-orange-500" },
  { key: "proc", title: "Procurement review", statuses: ["pending_procurement", "returned_to_procurement"], dot: "bg-amber-500" },
  { key: "pm", title: "PM approval", statuses: ["pending_pm"], dot: "bg-violet-500" },
  { key: "src", title: "Sourcing", statuses: ["approved_sourcing"], dot: "bg-sky-500" },
  { key: "ord", title: "Ordered", statuses: ["ordered"], dot: "bg-blue-600" },
  {
    key: "rec", title: "Received (7 days)", statuses: ["received"], dot: "bg-emerald-500",
    filter: (r) => Date.now() - new Date(r.updated_at).getTime() < 7 * 86_400_000,
  },
];

const byAge = (a: RequestRow, b: RequestRow) =>
  Number(b.urgency === "urgent") - Number(a.urgency === "urgent") || a.updated_at.localeCompare(b.updated_at);

/** Kanban view of the pipeline. Cards move columns live as people act (Realtime refreshes the data). */
export function Board() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["requests"], queryFn: listRequests });

  if (q.isLoading) return <ListSkeleton rows={3} />;
  if (q.error) return <Alert>{t("Could not load requests: {msg}", { msg: (q.error as Error).message })}</Alert>;

  return (
    <div className="space-y-4">
      <PageHeader title={t("Pipeline board")} subtitle={t("Every open request, by stage. Updates live.")} />
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:thin]">
        {COLS.map((c, ci) => {
          const rows = (q.data ?? []).filter((r) => c.statuses.includes(r.status) && (!c.filter || c.filter(r))).sort(byAge);
          return (
            <section key={c.key} className="w-[78vw] max-w-[300px] shrink-0 snap-start animate-fade-up sm:w-[280px] xl:w-0 xl:min-w-0 xl:max-w-none xl:flex-1" style={stagger(ci, 70)}>
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                <h2 className="text-sm font-bold text-slate-800">{t(c.title)}</h2>
                <span className="ms-auto rounded-full bg-slate-200/70 px-2 text-xs font-bold text-slate-600">{rows.length}</span>
              </div>
              <div className="min-h-[120px] space-y-2.5 rounded-2xl bg-slate-100/70 p-2.5 ring-1 ring-inset ring-slate-200/60 dark:bg-white/[.03]">
                {rows.length === 0 && <div className="py-6 text-center text-xs text-slate-500">{t("Nothing here")}</div>}
                {rows.map((r, i) => {
                  const fresh = Date.now() - new Date(r.updated_at).getTime() < 20_000;
                  return (
                    <Link
                      key={r.id}
                      to={`/requests/${r.id}`}
                      className={cn(
                        "lift block animate-scale-in rounded-xl border border-slate-200/70 bg-white p-3 shadow-card",
                        fresh && "ring-2 ring-accent-400",
                        r.urgency === "urgent" && "border-s-4 border-s-rose-500",
                      )}
                      style={stagger(i, 40)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="whitespace-nowrap text-sm font-bold text-slate-900">{r.request_no}</span>
                        {r.urgency === "urgent" && (
                          <span title={t("Urgent")} className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-500/40">
                            <Zap className="h-3 w-3" aria-label={t("Urgent")} />
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-600">
                        <span className="font-semibold">{r.project?.project_no}</span> · {r.purpose || r.project?.name}
                      </div>
                      {c.statuses.length > 1 && <div className="mt-1 text-[11px] font-medium text-slate-500">{t(STATUS_LABEL[r.status])}</div>}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                        <WaitingBadge status={r.status} updatedAt={r.updated_at} />
                        <span className="ms-auto grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-[10px] font-bold text-brand-700" title={r.requester?.full_name}>
                          {(r.requester?.full_name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
