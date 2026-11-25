import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Hand, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { RequestList } from "@/components/RequestCard";
import { SwipeRow, useSwipeHint } from "@/components/SwipeRow";
import { useToast } from "@/components/Toast";
import { Alert, EmptyState, ListSkeleton, PageHeader, Select, cn } from "@/components/ui";
import { listRequests, rpc, type RequestRow } from "@/lib/api";
import { useAuth, type Me } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { byPriority, waitingOnMe } from "@/lib/queue";
import { STATUS_LABEL, type Status } from "@/lib/strings";

/** The one-tap action a swipe can reveal (mirrors the server rules; the server still decides). */
function quickAction(r: RequestRow, me: Me) {
  const has = (x: string) => me.roles.includes(x as Me["roles"][number]);
  if (r.requested_by === me.id) return null;
  if ((r.status === "pending_procurement" || r.status === "returned_to_procurement") && (has("procurement") || has("admin")))
    return { fn: "rpc_forward_to_pm", label: "Forward to PM", tone: "brand" as const };
  if (r.status === "pending_pm" && ((has("project_manager") && r.project?.pm_user_id === me.id) || has("admin")))
    return { fn: "rpc_pm_approve", label: "Approve", tone: "success" as const };
  return null;
}

export function Inbox() {
  const { me, has } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["requests"], queryFn: listRequests });
  const seeAll = has("procurement") || has("admin");
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<"" | Status>("");
  const hint = useSwipeHint();
  const [hintOpen, setHintOpen] = useState(!hint.shown);

  const waiting = useMemo(() => (me ? (q.data ?? []).filter((r) => waitingOnMe(r, me)).sort(byPriority) : []), [q.data, me]);
  const all = useMemo(() => (q.data ?? []).filter((r) => r.status !== "draft" && (!status || r.status === status)), [q.data, status]);
  const anySwipe = me ? waiting.some((r) => quickAction(r, me)) : false;

  const wrap = (r: RequestRow, card: React.ReactNode) => {
    const a = me ? quickAction(r, me) : null;
    return (
      <SwipeRow
        action={a && {
          label: t(a.label),
          tone: a.tone,
          icon: a.tone === "success" ? <CheckCircle2 className="h-5 w-5" /> : <Send className="h-5 w-5 rtl:-scale-x-100" />,
          run: async () => {
            try {
              const res = await rpc(a.fn, { p_request_id: r.id });
              toast("success", t("{no}: {action}", { no: res.request_no ?? "", action: t(a.label) }), t("It is now with the next person."));
              await qc.invalidateQueries();
            } catch (e) {
              toast("error", t("Not allowed"), e instanceof Error ? e.message : String(e));
            }
          },
        }}
      >
        {card}
      </SwipeRow>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("Inbox")} subtitle={t("Urgent first, then oldest first")} />

      {hintOpen && anySwipe && tab === "mine" && (
        <div className="flex animate-fade-up items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-50 to-accent-400/10 px-4 py-3 text-sm text-brand-800 ring-1 ring-inset ring-brand-100 md:hidden">
          <Hand className="h-5 w-5 shrink-0 animate-[nudge_1.6s_ease-in-out_infinite]" />
          <span className="flex-1">{hint.text}</span>
          <button onClick={() => { hint.dismiss(); setHintOpen(false); }} className="rounded-lg p-1 hover:bg-white/60" aria-label={t("Dismiss")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {seeAll && (
        <div className="flex animate-fade-up flex-wrap items-center gap-2" style={{ animationDelay: "60ms" }}>
          <div className="relative inline-flex rounded-xl bg-slate-200/60 p-1 text-sm font-semibold" role="tablist">
            <span className="absolute inset-y-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-out"
              style={{ insetInlineStart: tab === "mine" ? 4 : "50%", width: "calc(50% - 4px)" }} aria-hidden />
            <button role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")} className={cn("relative z-10 flex-1 whitespace-nowrap rounded-lg px-3 py-1.5", tab === "mine" ? "text-slate-900" : "text-slate-500")}>
              {t("Waiting on me")} {q.data && <span className="ms-1 rounded-full bg-brand-500 px-1.5 text-xs text-white">{waiting.length}</span>}
            </button>
            <button role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className={cn("relative z-10 flex-1 whitespace-nowrap rounded-lg px-3 py-1.5", tab === "all" ? "text-slate-900" : "text-slate-500")}>
              {t("All requests")}
            </button>
          </div>
          {tab === "all" && (
            <Select value={status} onChange={(e) => setStatus(e.target.value as Status | "")} className="w-auto min-w-36 animate-fade-in py-2" aria-label={t("Filter by status")}>
              <option value="">{t("All statuses")}</option>
              {(Object.keys(STATUS_LABEL) as Status[]).filter((s) => s !== "draft").map((s) => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}
            </Select>
          )}
        </div>
      )}

      {q.isLoading ? <ListSkeleton /> : q.error ? (
        <Alert>{t("Could not load requests: {msg}", { msg: (q.error as Error).message })}</Alert>
      ) : tab === "mine" || !seeAll ? (
        waiting.length === 0
          ? <EmptyState title={t("All caught up")}>{t("Nothing is waiting on you. New requests will appear here.")}</EmptyState>
          : <RequestList key="mine" rows={waiting} showRequester wrap={wrap} />
      ) : all.length === 0 ? (
        <EmptyState title={t("No requests")} />
      ) : (
        <RequestList key={`all-${status}`} rows={all} showRequester />
      )}
    </div>
  );
}
