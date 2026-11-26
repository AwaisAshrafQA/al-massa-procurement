import { clsx } from "clsx";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import {
  Children, Fragment, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
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
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none ring-1 ring-inset ring-slate-200 transition-shadow placeholder:text-slate-400 hover:ring-slate-300 focus:shadow-glow focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn(field, className)} />;
}

// App-drawn dropdown. Native <select> lists are drawn by the browser: desktop Chrome shows
// them at desktop size even in a phone-sized window (spilling past the screen), and every
// phone has its own picker. This one looks the same everywhere, stays on screen (opens
// upwards when there is no room below), follows Arabic right-to-left, and keeps the
// <select> API (<option> children, onChange(e) with e.target.value), so call sites are unchanged.
// Keyboard: arrows / Home / End / type-ahead, Enter or Space to choose, Esc to close.
// A disabled <option> is a prompt ("Select project…"): shown on the button while nothing is
// chosen, never offered in the list.
type Opt = { value: string; label: string; prompt: boolean };
function optionsFrom(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (c.type === Fragment) { out.push(...optionsFrom(p.children)); return; }
    out.push({ value: String(p.value ?? ""), label: Children.toArray(p.children).join(""), prompt: !!p.disabled });
  });
  return out;
}

type SelectProps = {
  id?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

export function Select({ id, value = "", onChange, children, className, disabled, ...aria }: SelectProps) {
  const all = useMemo(() => optionsFrom(children), [children]);
  const opts = useMemo(() => all.filter((o) => !o.prompt), [all]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ s: "", t: 0 });
  const listId = useId();
  const current = all.find((o) => o.value === value) ?? all[0];

  const place = useCallback(() => {
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, margin = 8, gap = 6;
    const want = Math.min(288, opts.length * 44 + 8);
    const below = vh - r.bottom - margin - gap, above = r.top - margin - gap;
    const up = below < Math.min(want, 220) && above > below;
    const maxH = Math.max(132, Math.min(288, up ? above : below));
    const width = Math.min(Math.max(r.width, 176), vw - margin * 2);
    const rtl = document.documentElement.dir === "rtl";
    const left = Math.min(Math.max(margin, rtl ? r.right - width : r.left), vw - margin - width);
    setPos(up ? { left, bottom: vh - r.top + gap, width, maxH } : { left, top: r.bottom + gap, width, maxH });
  }, [opts.length]);

  function show() {
    if (disabled) return;
    typed.current = { s: "", t: 0 };
    place();
    setActive(Math.max(0, opts.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function pick(i: number) {
    const o = opts[i];
    setOpen(false);
    btn.current?.focus();
    if (o && o.value !== value) onChange?.({ target: { value: o.value }, currentTarget: { value: o.value } } as unknown as ChangeEvent<HTMLSelectElement>);
  }

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    const follow = (e: Event) => { if (!(e.target instanceof Node && list.current?.contains(e.target))) place(); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", follow, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", follow, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, opts.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = { s: (now - typed.current.t < 700 ? typed.current.s : "") + e.key.toLowerCase(), t: now };
      const i = opts.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.s));
      if (i >= 0) setActive(i);
    }
  }

  return (
    <>
      <button
        type="button"
        id={id}
        ref={btn}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={aria["aria-label"]}
        aria-invalid={aria["aria-invalid"]}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={cn(field, "flex min-h-11 cursor-pointer items-center gap-2 text-start", open && "shadow-glow ring-2 ring-brand-500", className)}
      >
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-slate-500")}>{current?.label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>
      {open && pos && createPortal(
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={aria["aria-label"]}
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH }}
          className="z-[90] animate-scale-in overflow-y-auto overscroll-contain rounded-xl bg-white p-1 text-sm text-slate-800 shadow-lift ring-1 ring-slate-200"
        >
          {opts.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              id={`${listId}-${i}`}
              data-i={i}
              role="option"
              aria-selected={o.value === value}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2",
                i === active && "bg-brand-50",
                o.value === value && "font-semibold text-brand-700",
              )}
            >
              <span className="min-w-0 flex-1">{o.label}</span>
              {o.value === value && <Check className="h-4 w-4 shrink-0" aria-hidden />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body>: page containers animate with transforms, which would trap the sheet
  // underneath the fixed bottom nav on phones.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl sm:animate-scale-in sm:rounded-3xl">
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} className="-me-2 rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label={translate("Close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
