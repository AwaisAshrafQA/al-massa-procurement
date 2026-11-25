import { Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "./ui";

type Kind = "success" | "error" | "info" | "live";
type ToastItem = { id: number; kind: Kind; title: string; body?: string; href?: string };
type Push = (kind: Kind, title: string, body?: string, href?: string) => void;

const ToastCtx = createContext<Push>(() => {});
let nextId = 1;

/** Animated tick that draws itself. */
function CheckDraw() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#10b981" className="origin-center animate-scale-in" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="20" strokeDashoffset="20" style={{ animation: "draw-check .45s .15s ease-out forwards" }} />
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nav = useNavigate();
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback<Push>((kind, title, body, href) => {
    const id = nextId++;
    setItems((xs) => [...xs.slice(-2), { id, kind, title, body, href }]);
    setTimeout(() => dismiss(id), kind === "error" ? 7000 : kind === "live" ? 6500 : 4200);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
            onClick={() => { if (t.href) { nav(t.href); dismiss(t.id); } }}
            className={cn(
              "pointer-events-auto flex w-full max-w-md animate-toast-in items-start gap-3 rounded-2xl border bg-white/95 px-4 py-3 shadow-lift backdrop-blur",
              t.href && "cursor-pointer hover:bg-white",
              t.kind === "success" && "border-emerald-200",
              t.kind === "error" && "border-rose-200",
              t.kind === "info" && "border-sky-200",
              t.kind === "live" && "border-brand-200",
            )}>
            {t.kind === "success" && <CheckDraw />}
            {t.kind === "error" && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />}
            {t.kind === "info" && <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />}
            {t.kind === "live" && (
              <span className="relative mt-1.5 flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-500" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">{t.title}</div>
              {t.body && <div className="mt-0.5 text-sm text-slate-600">{t.body}</div>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); dismiss(t.id); }} className="-me-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
