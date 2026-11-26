import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ActionBar } from "@/components/ActionBar";
import { StatusBadge, UrgentBadge, WaitingBadge } from "@/components/StatusBadge";
import { Stepper } from "@/components/Stepper";
import { Timeline } from "@/components/Timeline";
import { Alert, Card, ListSkeleton } from "@/components/ui";
import { getRequest } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { ItemIcon } from "@/lib/itemIcons";
import { stagger } from "@/lib/motion";

function Info({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  // One <div> per term/description pair: the only wrapper a <dl> allows.
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function RequestDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["request", id], queryFn: () => getRequest(id!) });

  if (q.isLoading) return <ListSkeleton rows={3} />;
  if (q.error) return <Alert>{t("Could not load this request: {msg}", { msg: (q.error as Error).message })}</Alert>;
  const r = q.data;
  if (!r) {
    return (
      <div className="space-y-3">
        <Alert>{t("Request not found, or you do not have access to it.")}</Alert>
        <button onClick={() => nav(-1)} className="text-sm font-medium text-brand-600 hover:underline">{t("Go back")}</button>
      </div>
    );
  }
  const pd = r.procurement_details;

  return (
    <div className="space-y-5">
      <div className="flex animate-fade-up items-start gap-2">
        <button onClick={() => nav(-1)} className="-ms-2 mt-0.5 rounded-xl p-2 text-slate-500 hover:bg-white hover:shadow-sm" aria-label={t("Back")}>
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{r.request_no ?? t("Draft request")}</h1>
            <StatusBadge status={r.status} />
            {r.urgency === "urgent" && <UrgentBadge />}
            <WaitingBadge status={r.status} updatedAt={r.updated_at} />
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            {r.project?.project_no} · {r.project?.name}{r.project?.location ? ` · ${r.project.location}` : ""}
          </p>
        </div>
      </div>

      <Card className="animate-fade-up p-4" style={{ animationDelay: "40ms" }}>
        <Stepper status={r.status} />
      </Card>

      <ActionBar request={r} />

      <div className="grid animate-fade-up grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]" style={{ animationDelay: "120ms" }}>
        <div className="space-y-5">
          <Card className="p-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label={t("Requested by")}>{r.requester?.full_name}</Info>
              <Info label={t("Required on site")}>{fmtDate(r.required_date)}</Info>
              <Info label={t("Sent")}>{r.sent_at ? fmtDateTime(r.sent_at) : t("Not sent yet")}</Info>
              {r.urgency === "urgent" && <Info className="col-span-2 sm:col-span-3" label={t("Why urgent")}>{r.urgency_reason}</Info>}
              {r.purpose && <Info className="col-span-2 sm:col-span-3" label={t("Purpose / BOQ reference")}>{r.purpose}</Info>}
            </dl>
          </Card>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">{t("Items ({n})", { n: r.request_lines.length })}</h2>
            <ul className="space-y-2">
              {r.request_lines.map((l, i) => (
                <li key={l.id} className="flex animate-fade-up items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card" style={stagger(i, 50)}>
                  <ItemIcon category={l.item?.category ?? null} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {l.item
                        ? <span className="font-mono text-xs font-bold text-brand-700">{l.item.item_code}</span>
                        : <span className="rounded bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800">{t("Free text")}</span>}
                      <span className="font-semibold text-slate-900">{l.item?.name ?? l.description}</span>
                    </div>
                    {(l.size_spec || l.notes) && <div className="mt-0.5 truncate text-sm text-slate-500">{[l.size_spec, l.notes].filter(Boolean).join(" · ")}</div>}
                  </div>
                  <div className="shrink-0 text-end">
                    <div className="text-lg font-extrabold leading-none text-slate-900">{Number(l.qty).toLocaleString("en-GB")}</div>
                    <div className="mt-0.5 text-[11px] font-semibold uppercase text-slate-500">{l.unit}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {(pd || r.receipts) && (
            <Card className="p-4">
              <h2 className="mb-3 font-semibold text-slate-900">{t("Order and delivery")}</h2>
              <dl className="grid grid-cols-2 gap-4">
                {pd && <Info label={t("Supplier")}>{pd.supplier?.name}{pd.supplier?.phone && <span className="block text-xs text-slate-500" dir="ltr">{pd.supplier.phone}</span>}</Info>}
                {pd && <Info label={t("Agreed delivery")}>{fmtDate(pd.agreed_delivery_date)}</Info>}
                {r.receipts && <Info label={t("Received")}>{t("{when} by {name}", { when: fmtDateTime(r.receipts.confirmed_at), name: r.receipts.confirmer?.full_name ?? "" })}</Info>}
                {r.receipts?.notes && <Info label={t("Delivery notes")}>{r.receipts.notes}</Info>}
              </dl>
            </Card>
          )}
        </div>

        <section>
          <h2 className="mb-3 font-semibold text-slate-900">{t("Timeline")}</h2>
          <Card className="p-5">
            <Timeline entries={r.activity_log} createdAt={r.created_at} />
          </Card>
        </section>
      </div>
    </div>
  );
}
