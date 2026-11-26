import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Inbox, Kanban, Languages, LayoutDashboard, LogOut, Moon, Plus, Search, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { listRequests } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useLiveUpdates } from "@/lib/live";
import { waitingOnMe } from "@/lib/queue";
import { ROLE_LABEL } from "@/lib/strings";
import { useTheme } from "@/lib/theme";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { cn } from "./ui";

function UserMenu() {
  const { me, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { mode, toggle } = useTheme();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  if (!me) return null;
  const initials = me.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={t("Account menu")} aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xs font-bold ring-2 ring-white/20 transition hover:ring-white/50">
        {initials}
      </button>
      {open && (
        <div className="absolute end-0 top-12 z-50 w-64 animate-scale-in overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-lift">
          <div className="px-3 py-2.5">
            <div className="font-semibold text-slate-900">{me.fullName}</div>
            <div className="text-xs text-slate-500">{me.roles.map((r) => t(ROLE_LABEL[r])).join(" · ")}</div>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50">
            {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {mode === "dark" ? t("Light mode") : t("Dark mode")}
          </button>
          <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50">
            <Languages className="h-4 w-4" /> {lang === "ar" ? "English" : "العربية"}
          </button>
          <div className="my-1 h-px bg-slate-100" />
          <button onClick={() => signOut().then(() => nav("/login"))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50">
            <LogOut className="h-4 w-4" /> {t("Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { me, has } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const [palette, setPalette] = useState(false);
  const requests = useQuery({ queryKey: ["requests"], queryFn: listRequests, enabled: !!me });
  useLiveUpdates(me);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!me) return null;
  const decides = has("procurement") || has("project_manager") || has("admin");
  const raises = has("site_engineer");
  const waiting = (requests.data ?? []).filter((r) => waitingOnMe(r, me)).length;

  const links = [
    { to: "/overview", label: t("Overview"), icon: LayoutDashboard, badge: 0 },
    decides && { to: "/inbox", label: t("Inbox"), icon: Inbox, badge: waiting },
    raises && { to: "/requests", label: t("My requests"), icon: ClipboardList, badge: 0 },
    { to: "/board", label: t("Board"), icon: Kanban, badge: 0 },
  ].filter(Boolean) as { to: string; label: string; icon: typeof Inbox; badge: number }[];

  return (
    <div className="min-h-dvh pb-24 sm:pb-0">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 text-white shadow-lg shadow-brand-900/20 dark:from-[#070d19] dark:via-[#0b1630] dark:to-[#0f2141]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <NavLink to="/" aria-label="Al Massa Procurement"><Logo /></NavLink>
          <nav className="ms-6 hidden gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) => cn("relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white")}>
                {l.label}
                {l.badge > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-400 px-1.5 text-[11px] font-bold text-brand-900">{l.badge}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1.5">
            <button onClick={() => setPalette(true)}
              className="flex items-center gap-2 rounded-xl p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white lg:bg-white/10 lg:px-3"
              aria-label={t("Search")}>
              <Search className="h-5 w-5 lg:h-4 lg:w-4" />
              <span className="hidden text-sm lg:inline">{t("Search")}</span>
              <kbd className="hidden rounded-md bg-white/15 px-1.5 text-[11px] font-semibold lg:inline">Ctrl K</kbd>
            </button>
            {raises && (
              <button onClick={() => nav("/requests/new")} className="on-brand press me-1 hidden items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-brand-700 shadow-md hover:bg-brand-50 md:inline-flex">
                <Plus className="h-4 w-4" /> {t("New request")}
              </button>
            )}
            <NotificationBell />
            <div className="ms-1 hidden text-end leading-tight lg:block">
              <div className="text-sm font-semibold">{me.fullName}</div>
              <div className="text-[11px] text-white/60">{me.roles.map((r) => t(ROLE_LABEL[r])).join(" · ")}</div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main key={loc.pathname} className="mx-auto max-w-6xl animate-fade-in px-4 py-6">
        <Outlet />
      </main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />

      {/* Phone bottom navigation */}
      <nav className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-30 rounded-2xl border border-slate-200/80 bg-white/90 shadow-lift backdrop-blur-md md:hidden">
        <div className="flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end
              className={({ isActive }) => cn("relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors", isActive ? "text-brand-600" : "text-slate-500")}>
              {({ isActive }) => (
                <>
                  <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-all", isActive && "bg-brand-50")}>
                    <l.icon className="h-5 w-5" />
                  </span>
                  {l.label}
                  {l.badge > 0 && <span className="absolute end-[calc(50%-1.6rem)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{l.badge}</span>}
                </>
              )}
            </NavLink>
          ))}
          {raises && (
            <NavLink to="/requests/new" aria-label={t("New request")} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-slate-500">
              {({ isActive }) => (
                <>
                  <span className={cn("grid h-8 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/40", isActive && "ring-2 ring-brand-200")}>
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className={cn(isActive && "text-brand-600")}>{t("New")}</span>
                </>
              )}
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  );
}
