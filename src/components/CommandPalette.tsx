import { useQuery } from "@tanstack/react-query";
import { ClipboardList, CornerDownLeft, Inbox, Kanban, Languages, LayoutDashboard, Moon, Plus, Search, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { listRequests } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { STATUS_LABEL } from "@/lib/strings";
import { StatusBadge } from "./StatusBadge";
import { cn } from "./ui";

type Entry = { key: string; label: string; hint?: ReactNode; icon: ReactNode; run: () => void; words: string };

/** Ctrl/⌘+K command palette: jump to a request by number, project, purpose or requester, or run a command. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, has } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { mode, toggle } = useTheme();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requests = useQuery({ queryKey: ["requests"], queryFn: listRequests, enabled: open });

  useEffect(() => {
    if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const go = (to: string) => () => { nav(to); onClose(); };
    const cmds: Entry[] = [
      { key: "c-overview", label: t("Go to Overview"), icon: <LayoutDashboard className="h-4 w-4" />, run: go("/overview"), words: "overview dashboard home" },
      { key: "c-board", label: t("Go to Pipeline board"), icon: <Kanban className="h-4 w-4" />, run: go("/board"), words: "board pipeline kanban" },
      ...(has("procurement") || has("project_manager") || has("admin")
        ? [{ key: "c-inbox", label: t("Go to Inbox"), icon: <Inbox className="h-4 w-4" />, run: go("/inbox"), words: "inbox waiting" }] : []),
      ...(has("site_engineer")
        ? [
            { key: "c-new", label: t("New request"), icon: <Plus className="h-4 w-4" />, run: go("/requests/new"), words: "new create request" },
            { key: "c-mine", label: t("Go to My requests"), icon: <ClipboardList className="h-4 w-4" />, run: go("/requests"), words: "my requests" },
          ] : []),
      { key: "c-theme", label: mode === "dark" ? t("Switch to light mode") : t("Switch to dark mode"), icon: mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />, run: () => { toggle(); onClose(); }, words: "theme dark light mode" },
      { key: "c-lang", label: lang === "ar" ? "Switch to English" : "التبديل إلى العربية", icon: <Languages className="h-4 w-4" />, run: () => { setLang(lang === "ar" ? "en" : "ar"); onClose(); }, words: "language arabic english عربي" },
    ];
    const reqs: Entry[] = (requests.data ?? []).filter((r) => r.request_no).map((r) => ({
      key: r.id,
      label: `${r.request_no} · ${r.project?.project_no} ${r.project?.name ?? ""}`,
      hint: <StatusBadge status={r.status} />,
      icon: <span className="text-[10px] font-bold text-brand-600">PR</span>,
      run: go(`/requests/${r.id}`),
      words: `${r.request_no} ${r.project?.project_no} ${r.project?.name} ${r.purpose ?? ""} ${r.requester?.full_name ?? ""} ${STATUS_LABEL[r.status]}`.toLowerCase(),
    }));
    return [...cmds, ...reqs];
  }, [requests.data, t, lang, mode, has, nav, onClose, setLang, toggle]);

  const s = q.trim().toLowerCase();
  const results = (s ? entries.filter((e) => s.split(/\s+/).every((w) => e.words.includes(w) || e.label.toLowerCase().includes(w))) : entries.slice(0, 7)).slice(0, 9);

  if (!open || !me) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label={t("Search")}>
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            maxLength={100}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); results[active]?.run(); }
            }}
            placeholder={t("Search requests, projects or commands…")}
            className="h-14 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 sm:block">Esc</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">{t("No matches")}</li>}
          {results.map((e, i) => (
            <li key={e.key}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={e.run}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm", i === active ? "bg-brand-50 text-brand-700" : "text-slate-700")}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">{e.icon}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{e.label}</span>
                <span className="hidden sm:inline-flex">{e.hint}</span>
                {i === active && <CornerDownLeft className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
