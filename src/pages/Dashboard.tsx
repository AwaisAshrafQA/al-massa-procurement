import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, Inbox as InboxIcon, MapPin, PackageCheck, Plus, Timer, UserRound, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarList, ChartCard, ColumnChart, ProgressRing, StatTile, TrendChip } from "@/components/charts";
import { DrillPanel, type DrillState } from "@/components/DrillPanel";
import { SiteMap } from "@/components/SiteMap";
import { Alert, Card, ListSkeleton, PageHeader } from "@/components/ui";
import { listActivity, listProjects, listRecentEvents, listRequests } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ago, fmtLongToday } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { computeMetrics, fmtHours } from "@/lib/metrics";
import { stagger } from "@/lib/motion";
import { waitingOnMe } from "@/lib/queue";
import { ACTION_LABEL } from "@/lib/strings";

export function Dashboard() {
  const { me, has } = useAuth();
  const { t } = useI18n();
  const requests = useQuery({ queryKey: ["requests"], queryFn: listRequests });
  const logs = useQuery({ queryKey: ["activity"], queryFn: listActivity });
  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const recent = useQuery({ queryKey: ["recent-events"], queryFn: () => listRecentEvents(8) });

  const m = useMemo(() => (requests.data && logs.data ? computeMetrics(requests.data, logs.data) : null), [requests.data, logs.data]);
  const [drill, setDrill] = useState<DrillState>(null);
  const waiting = useMemo(() => (me && requests.data ? requests.data.filter((r) => waitingOnMe(r, me)).length : 0), [requests.data, me]);
  const decides = has("procurement") || has("project_manager") || has("admin");

  if (requests.error || logs.error) {
    return <Alert>{t("Could not load the overview: {msg}", { msg: ((requests.error ?? logs.error) as Error).message })}</Alert>;
  }

  const decision = fmtHours(m?.avgToDecisionH ?? NaN);
  const heroCount = decides
    ? waiting
    : (requests.data ?? []).filter((r) => r.requested_by === me?.id && !["received", "rejected", "cancelled", "draft"].includes(r.status)).length;

  const projectCards = (projects.data ?? []).map((p) => {
    const s = m?.perProject.find((x) => x.id === p.id);
    return { p, total: s?.total ?? 0, received: s?.received ?? 0, open: s?.open ?? 0, urgent: s?.urgent ?? 0, avg: s?.avgDecisionH ?? NaN };
  });
  projectCards.sort((a, b) => Number(a.p.status === "closed") - Number(b.p.status === "closed") || b.open - a.open || b.total - a.total);
  const sites = projectCards
    .filter((c) => c.p.lat != null && c.p.lng != null && c.p.status !== "closed")
    .map((c) => ({ id: c.p.id, no: c.p.project_no, name: c.p.name, lat: Number(c.p.lat), lng: Number(c.p.lng), open: c.open, urgent: c.urgent }));

  return (
    <div className="space-y-5">
      <PageHeader title={t("Hello, {name}", { name: me?.fullName ?? "" })} subtitle={fmtLongToday()} />

      {/* Hero */}
      <div className="relative animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-5 text-white shadow-lift" style={{ animationDelay: "60ms" }}>
        <div className="pointer-events-none absolute -end-10 -top-16 h-48 w-48 animate-float rounded-full bg-accent-400/25 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 start-10 h-44 w-44 animate-float rounded-full bg-white/10 blur-2xl [animation-delay:-6s]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-white/75">{decides ? t("Waiting on you right now") : t("Your open requests")}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight">{heroCount}</span>
              <span className="text-white/80">{heroCount === 1 ? t("request") : t("requests")}</span>
            </div>
          </div>
          <Link to={decides ? "/inbox" : "/requests/new"}
            className="on-brand press inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-lg hover:bg-brand-50">
            {decides ? <><InboxIcon className="h-4 w-4" /> {t("Open Inbox")}</> : <><Plus className="h-4 w-4" /> {t("New request")}</>}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>

      {/* KPIs */}
      {!m ? <ListSkeleton rows={2} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("Open requests")} value={m.open} icon={<ClipboardList className="h-4 w-4" />} delay={100}
            onClick={() => setDrill({ title: t("Open requests"), subtitle: t("Not yet received, rejected or cancelled"), drill: m.drills.open })}
            sub={<span className="flex flex-wrap items-center gap-1.5">{t("{n} sent this week", { n: m.sentThisWeek })} <TrendChip now={m.sentThisWeek} prev={m.sentLastWeek} goodWhen="up" label={t("vs last week")} /></span>}
            spark={m.perDay.map((d) => d.value)} />
          <StatTile label={t("Urgent open")} value={m.urgentOpen} tone="rose" icon={<Zap className="h-4 w-4" />} sub={t("flagged by site")} delay={160}
            onClick={() => setDrill({ title: t("Urgent open"), subtitle: t("flagged by site"), drill: m.drills.urgentOpen })} />
          <StatTile label={t("Sent → PM decision")} value={decision.value} decimals={1} unit={t(decision.unit)} tone="violet" icon={<Timer className="h-4 w-4" />} delay={220}
            onClick={() => setDrill({ title: t("Sent → PM decision"), subtitle: t("Time from sending to the PM's decision"), drill: m.drills.toDecision, hoursLabel: t("to decision") })}
            sub={<span className="flex flex-wrap items-center gap-1.5">{t("average over {n} requests", { n: m.decisionsMeasured })} <TrendChip now={m.decisionThisWeekH} prev={m.decisionLastWeekH} goodWhen="down" label={t("vs last week")} /></span>} />
          <StatTile label={t("Delivered")} value={m.received} tone="accent" icon={<PackageCheck className="h-4 w-4" />} sub={t("receipt confirmed on site")} delay={280}
            onClick={() => setDrill({ title: t("Delivered"), subtitle: t("receipt confirmed on site"), drill: m.drills.received })}
            spark={m.receiptsPerDay.map((d) => d.value)} />
        </div>
      )}

      {/* Projects + map */}
      {m && projects.data && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="grid grid-cols-1 content-start gap-3 md:grid-cols-2 lg:grid-cols-1">
            {projectCards.map((c, i) => (
              <Card key={c.p.id} className="lift animate-fade-up p-0" style={stagger(i + 6, 60)}>
                <button type="button" className="block w-full rounded-2xl p-4 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  onClick={() => { const s = m.perProject.find((x) => x.id === c.p.id); if (s) setDrill({ title: `${c.p.project_no} · ${c.p.name}`, subtitle: c.p.location ?? undefined, drill: s.drill }); }}>
                <div className="flex items-center gap-4">
                  <ProgressRing value={c.total ? c.received / c.total : 0} label={t("{pct} delivered", { pct: c.total ? Math.round((c.received / c.total) * 100) + "%" : "0%" })} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-extrabold text-brand-700">{c.p.project_no}</span>
                      <span className="truncate font-semibold text-slate-900">{c.p.name}</span>
                      {c.p.status === "closed" && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{t("Closed")}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.p.location}</span>
                      {c.p.pm && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{t("PM {name}", { name: c.p.pm.full_name })}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{t("{n} open", { n: c.open })}</span>
                      {c.urgent > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">{t("{n} urgent", { n: c.urgent })}</span>}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{t("{n} total", { n: c.total })}</span>
                      {Number.isFinite(c.avg) && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">{t("{t} to decision", { t: fmtHours(c.avg).text })}</span>}
                    </div>
                  </div>
                </div>
                </button>
              </Card>
            ))}
          </div>
          <Card className="animate-fade-up p-5" style={{ animationDelay: "420ms" }}>
            <h3 className="font-semibold text-slate-900">{t("Sites")}</h3>
            <p className="mb-3 text-xs text-slate-500">{t("Open requests by site")}</p>
            <SiteMap sites={sites} />
          </Card>
        </div>
      )}

      {/* Charts */}
      {m && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ChartCard title={t("Requests sent per day")} subtitle={t("Last 14 days")} delay={320}
            table={{ head: [t("Day"), t("Sent")], rows: m.perDay.map((d) => [d.label, String(d.value)]) }}>
            <ColumnChart data={m.perDay} onSelect={(i) => setDrill({ title: t("Requests sent on {day}", { day: m.perDay[i].label }), drill: m.perDay[i].drill })} />
          </ChartCard>

          <ChartCard title={t("Average time at each step")} subtitle={t("Where requests wait longest")} delay={380}
            table={{ head: [t("Step"), t("Average")], rows: m.steps.map((s) => [t(s.label), fmtHours(s.value).text]) }}>
            <BarList
              onSelect={(i) => setDrill({ title: t(m.steps[i].label), subtitle: t("Time spent at this step"), drill: m.steps[i].drill, hoursLabel: t("at this step") })}
              data={m.steps.map((s) => ({ label: t(s.label), value: Number.isFinite(s.value) ? s.value : 0 }))}
              format={(v) => fmtHours(v).text}
              tooltip={(d) => t("{label}: {time} on average", { label: d.label, time: fmtHours(d.value).text })}
            />
          </ChartCard>

          <ChartCard title={t("Where requests are now")} subtitle={t("By status")} delay={440}
            table={{ head: [t("Status"), t("Requests")], rows: m.statusCounts.map((s) => [t(s.label), String(s.value)]) }}>
            <BarList data={m.statusCounts.map((s) => ({ label: t(s.label), value: s.value }))}
              onSelect={(i) => setDrill({ title: t(m.statusCounts[i].label), subtitle: t("By status"), drill: m.statusCounts[i].drill })}
              tooltip={(d, share) => t("{n} requests · {pct}%", { n: d.value, pct: Math.round(share * 100) })} />
          </ChartCard>

          <ChartCard title={t("Requests by project")} subtitle={t("All time")} delay={500}
            table={{ head: [t("Project"), t("Requests")], rows: m.byProject.map((p) => [p.label, String(p.value)]) }}>
            <BarList data={m.byProject} onSelect={(i) => setDrill({ title: m.byProject[i].label, subtitle: t("All time"), drill: m.byProject[i].drill })} tooltip={(d, share) => t("{n} requests · {pct}%", { n: d.value, pct: Math.round(share * 100) })} />
          </ChartCard>
        </div>
      )}

      <DrillPanel state={drill} rows={requests.data ?? []} onClose={() => setDrill(null)} />

      {/* Recent activity */}
      <Card className="animate-fade-up p-5" style={{ animationDelay: "560ms" }}>
        <h3 className="mb-3 font-semibold text-slate-900">{t("Latest activity")}</h3>
        {!recent.data ? <ListSkeleton rows={2} /> : (
          <ul className="divide-y divide-slate-100">
            {recent.data.map((e, i) => (
              <li key={e.id} className="animate-fade-up" style={stagger(i, 60)}>
                <Link to={`/requests/${e.request?.id}`} className="flex items-center gap-3 rounded-xl px-1 py-2.5 hover:bg-slate-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-xs font-bold text-brand-700">
                    {(e.actor?.full_name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate">
                      <span className="font-semibold text-slate-900">{e.actor?.full_name}</span>
                      <span className="text-slate-600"> · {t(ACTION_LABEL[e.action] ?? e.action)}</span>
                    </div>
                    <div className="text-xs text-slate-500">{e.request?.request_no} · {t("project {no}", { no: e.request?.project?.project_no ?? "" })} · {ago(e.created_at)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
