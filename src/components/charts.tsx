// Small, dependency-free charts. Single-series, one hue (viz blue), thin marks with
// 4px rounded data-ends, recessive grid, hover/focus tooltips and a table view.
import { BarChart3, ChevronRight, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { translate as tr } from "@/lib/i18n";
import { useCountUp } from "@/lib/motion";
import { Card, cn } from "./ui";

export function ChartCard({ title, subtitle, children, table, className, delay = 0 }: {
  title: string; subtitle?: string; children: ReactNode; table: { head: [string, string]; rows: [string, string][] };
  className?: string; delay?: number;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn("animate-fade-up p-5", className)} style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <button
          onClick={() => setAsTable((v) => !v)}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={asTable ? tr("Show chart") : tr("Show as table")}
          title={asTable ? tr("Show chart") : tr("Show as table")}
        >
          {asTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1.5 text-start font-medium">{table.head[0]}</th><th className="py-1.5 text-end font-medium">{table.head[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.rows.map(([a, b]) => (
              <tr key={a}><td className="py-1.5 text-slate-700">{a}</td><td className="py-1.5 text-end tabular-nums text-slate-900">{b}</td></tr>
            ))}
          </tbody>
        </table>
      ) : children}
    </Card>
  );
}

/** Horizontal bars with direct value labels; tooltip on hover/focus. */
export function BarList({ data, format = (v) => String(v), tooltip, onSelect }: {
  data: { label: string; value: number }[];
  format?: (v: number) => string;
  tooltip?: (d: { label: string; value: number }, share: number) => string;
  /** Called with the row index when a bar is clicked / activated (drill-down). */
  onSelect?: (index: number) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <ul className="space-y-3.5">
      {data.map((d, i) => (
        <li
          key={d.label}
          tabIndex={0}
          role={onSelect ? "button" : undefined}
          aria-label={onSelect ? tr("{label}: {value}. Show requests", { label: d.label, value: format(d.value) }) : undefined}
          onClick={onSelect && d.value > 0 ? () => onSelect(i) : undefined}
          onKeyDown={onSelect && d.value > 0 ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i); } } : undefined}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(i)} onBlur={() => setHover(null)}
          className={cn("relative -mx-2 rounded-lg px-2 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500",
            onSelect && d.value > 0 && "cursor-pointer hover:bg-slate-50")}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className={cn("truncate text-slate-600", hover === i && "text-slate-900")}>{d.label}</span>
            <span className="flex items-center gap-1 font-semibold tabular-nums text-slate-900">
              {format(d.value)}
              {onSelect && <ChevronRight className={cn("h-3.5 w-3.5 text-slate-300 transition-opacity rtl:rotate-180", hover === i ? "opacity-100" : "opacity-0")} aria-hidden />}
            </span>
          </div>
          <div className="h-2 w-full rounded" style={{ background: "var(--viz-track)" }}>
            <div
              className="h-2 origin-left animate-grow-x rounded-[4px] transition-[filter] duration-150"
              style={{ width: `${(d.value / max) * 100}%`, background: "var(--viz-1)", animationDelay: `${150 + i * 70}ms`, filter: hover === i ? "brightness(1.12)" : undefined }}
            />
          </div>
          {hover === i && tooltip && (
            <div className="pointer-events-none absolute -top-9 end-0 z-10 animate-fade-in whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
              {tooltip(d, d.value / total)}{onSelect && d.value > 0 ? ` · ${tr("click for details")}` : ""}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns over time; recessive gridlines; tooltip per column. */
export function ColumnChart({ data, height = 150, onSelect }: { data: { label: string; value: number }[]; height?: number; onSelect?: (index: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxRaw = Math.max(1, ...data.map((d) => d.value));
  const max = Math.max(2, Math.ceil(maxRaw / 2) * 2);
  const ticks = [0, max / 2, max];
  return (
    <div className="relative">
      <div className="relative flex" style={{ height }}>
        {/* y ticks */}
        <div className="relative w-6 shrink-0 text-end text-[11px] tabular-nums" style={{ color: "var(--viz-muted)" }}>
          {ticks.map((t) => (
            <span key={t} className="absolute end-1.5 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px" style={{ top: `${100 - (t / max) * 100}%`, background: t === 0 ? "var(--viz-base)" : "var(--viz-grid)" }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px] px-0.5">
            {data.map((d, i) => (
              <button
                key={d.label}
                type="button"
                className={cn("group relative flex h-full flex-1 items-end justify-center outline-none", onSelect && d.value > 0 ? "cursor-pointer" : "cursor-default")}
                onClick={onSelect && d.value > 0 ? () => onSelect(i) : undefined}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={tr("{day}: {n} sent", { day: d.label, n: d.value })}
              >
                {hover === i && <span className="absolute inset-0 rounded-md bg-slate-900/[.04]" />}
                <span
                  className="relative w-full max-w-[18px] origin-bottom animate-grow-y rounded-t-[4px]"
                  style={{
                    height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0,
                    background: "var(--viz-1)", animationDelay: `${120 + i * 35}ms`,
                    filter: hover === i ? "brightness(1.12)" : undefined,
                  }}
                />
                {hover === i && (
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 animate-fade-in whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
                    {tr("{day}: {n} sent", { day: d.label, n: d.value })}{onSelect && d.value > 0 ? ` · ${tr("click for details")}` : ""}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="ms-6 mt-1.5 flex justify-between text-[11px]" style={{ color: "var(--viz-muted)" }}>
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** KPI tile with a count-up number. */
export function StatTile({ label, value, decimals = 0, unit, sub, icon, tone = "brand", delay = 0, spark, onClick }: {
  label: string; value: number; decimals?: number; unit?: string; sub?: ReactNode; icon: ReactNode;
  tone?: "brand" | "accent" | "rose" | "violet"; delay?: number; spark?: number[]; onClick?: () => void;
}) {
  const shown = useCountUp(Number.isFinite(value) ? value : 0, 1000, decimals);
  const tones = {
    brand: "from-brand-500 to-brand-700 shadow-brand-500/30",
    accent: "from-accent-400 to-accent-600 shadow-accent-500/30",
    rose: "from-rose-400 to-rose-600 shadow-rose-500/30",
    violet: "from-violet-400 to-violet-600 shadow-violet-500/30",
  }[tone];
  return (
    <Card className={cn("lift group relative animate-fade-up p-3 min-[380px]:p-4", onClick && "cursor-pointer focus-within:ring-2 focus-within:ring-brand-500")} style={{ animationDelay: `${delay}ms` }}>
      <div
        className="flex items-start justify-between gap-2 outline-none"
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? tr("{label}: show requests", { label }) : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 min-[380px]:text-xs">{label}</div>
        <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg min-[380px]:h-9 min-[380px]:w-9", tones)}>{icon}</div>
      </div>
      <div className="mt-2 text-[1.65rem] font-extrabold tracking-tight text-slate-900 min-[380px]:text-3xl">
        {Number.isFinite(value) ? shown : "—"}
        {unit && Number.isFinite(value) && <span className="ms-1 text-base font-semibold text-slate-500">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      {spark && <div className="mt-3"><Sparkline data={spark} /></div>}
      {onClick && (
        <button type="button" onClick={onClick} className="absolute inset-0 rounded-2xl" aria-hidden tabIndex={-1}>
          <span className="absolute bottom-2 end-3 flex items-center gap-0.5 text-[11px] font-semibold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
            {tr("Details")} <ChevronRight className="h-3 w-3 rtl:rotate-180" />
          </span>
        </button>
      )}
    </Card>
  );
}

/** Tiny trend line for a stat tile (no axes; the tile number is the headline). */
export function Sparkline({ data, height = 30 }: { data: number[]; height?: number }) {
  const max = Math.max(1, ...data);
  const w = 100;
  const pts = data.map((v, i) => [ (i / Math.max(1, data.length - 1)) * w, height - 2 - (v / max) * (height - 4) ] as const);
  const line = pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const area = line + " L" + w + " " + height + " L0 " + height + " Z";
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={"0 0 " + w + " " + height} preserveAspectRatio="none" className="h-8 w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--viz-1)" stopOpacity=".25" />
          <stop offset="1" stopColor="var(--viz-1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="var(--viz-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
        pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: "draw-check 1.1s .3s ease-out forwards" }} />
      {last && <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--viz-1)" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Week-over-week change chip. goodWhen says whether up or down is the good direction. Icon + text, never colour alone. */
export function TrendChip({ now, prev, goodWhen, label }: { now: number; prev: number; goodWhen: "up" | "down"; label: string }) {
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev === 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return <span className="text-xs font-semibold text-slate-500">→ 0% {label}</span>;
  const up = pct > 0;
  const good = (up && goodWhen === "up") || (!up && goodWhen === "down");
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1 rounded-full px-1.5 py-0.5 text-xs font-bold", good ? "bg-emerald-50 text-[#006300]" : "bg-rose-50 text-rose-700")}>
      <span className="whitespace-nowrap">{up ? "↑" : "↓"} {Math.abs(pct)}%</span> <span className="whitespace-nowrap font-medium opacity-80">{label}</span>
    </span>
  );
}

/** Ring showing a share (e.g. delivered / total). */
export function ProgressRing({ value, size = 56, stroke = 6, label }: { value: number; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-1)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c} style={{ ["--ring-to" as string]: String(c * (1 - v)), animation: "ring-fill 1s .2s cubic-bezier(.2,.8,.2,1) forwards" }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-extrabold text-slate-900" aria-label={label}>{Math.round(v * 100)}%</span>
    </div>
  );
}
