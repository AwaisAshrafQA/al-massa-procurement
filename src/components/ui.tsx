import { clsx } from "clsx";
import { Loader2, X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";
import { translate } from "@/lib/i18n";

export const cn = (...a: Parameters<typeof clsx>) => twMerge(clsx(...a));

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_6px_16px_-6px_rgba(32,48,80,.55)] hover:from-brand-400 hover:to-brand-600 disabled:opacity-50",
  secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-200 shadow-sm hover:bg-slate-50 hover:ring-slate-300 disabled:text-slate-400",
  danger: "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_6px_16px_-6px_rgba(225,29,72,.55)] hover:from-rose-400 disabled:opacity-50",
  success: "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_6px_16px_-6px_rgba(5,150,105,.55)] hover:from-emerald-400 disabled:opacity-50",
  ghost: "text-slate-700 hover:bg-slate-100",
};

export function Button({
  variant = "primary", loading, className, children, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cn(
        "press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed",
        VARIANT[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const field =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 transition-shadow placeholder:text-slate-400 hover:ring-slate-300 focus:shadow-glow focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn(field, className)} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(field, "pr-8", className)}>{children}</select>;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(field, className)} />;
}

export function Field({ label, htmlFor, hint, error, required, children }: {
  label: string; htmlFor?: string; hint?: string; error?: string | null; required?: boolean; children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="animate-fade-in text-sm text-rose-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: React.CSSProperties }) {
  return <div style={style} className={cn("rounded-2xl border border-slate-200/70 bg-white shadow-card", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex animate-fade-up items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {label ?? translate("Loading…")}
    </div>
  );
}

/** Shimmering placeholder rows while lists load. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label={translate("Loading…")}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-3 h-3 w-3/4" />
          <div className="skeleton mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "success"; children: ReactNode }) {
  const s = {
    error: "bg-rose-50 text-rose-800 ring-rose-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={cn("animate-fade-in rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset", s)}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="animate-fade-up rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 px-6 py-12 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-accent-400/20 text-2xl">✓</div>
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md animate-sheet-up rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl sm:animate-scale-in sm:rounded-3xl">
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} className="-me-2 rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label={translate("Close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
