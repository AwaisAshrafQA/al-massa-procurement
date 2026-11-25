import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listRecentEvents } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ago } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getSeen, markSeen } from "@/lib/live";
import { ACTION_LABEL } from "@/lib/strings";
import { cn } from "./ui";

export function NotificationBell() {
  const { me } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => (me ? getSeen(me.id) : 0));
  const ref = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => listRecentEvents(25), enabled: !!me, refetchInterval: 60_000 });

  const events = (q.data ?? []).filter((e) => e.actor_id !== me?.id).slice(0, 12);
  const unread = events.filter((e) => new Date(e.created_at).getTime() > seen).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!me) return null;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={t("Notifications")} aria-expanded={open}
      >
        <Bell className={cn("h-5 w-5", unread > 0 && "origin-top animate-[bell_1.2s_ease-in-out_2]")} />
        {unread > 0 && (
          <span dir="ltr" className="absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] animate-scale-in place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-brand-800">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[4.25rem] z-50 animate-scale-in overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-lift sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-semibold">{t("Notifications")}</span>
            <button
              onClick={() => { markSeen(me.id); setSeen(Date.now()); }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {t("Mark all read")}
            </button>
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-auto">
            {events.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">{t("No notifications yet")}</li>}
            {events.map((e) => {
              const isNew = new Date(e.created_at).getTime() > seen;
              return (
                <li key={e.id}>
                  <Link to={`/requests/${e.request?.id}`} onClick={() => setOpen(false)} className={cn("flex gap-3 px-4 py-3 hover:bg-slate-50", isNew && "bg-brand-50/60")}>
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", isNew ? "bg-brand-500" : "bg-transparent")} />
                    <div className="min-w-0 text-sm">
                      <div><span className="font-semibold">{e.actor?.full_name}</span> <span className="text-slate-600">· {t(ACTION_LABEL[e.action] ?? e.action)}</span></div>
                      <div className="text-xs text-slate-500">{e.request?.request_no} · {t("project {no}", { no: e.request?.project?.project_no ?? "" })} · {ago(e.created_at)}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
