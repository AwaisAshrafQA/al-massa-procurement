import { Hourglass, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { waitingTime } from "@/lib/sla";
import { STATUS_LABEL, STATUS_STYLE, type Status } from "@/lib/strings";
import { cn } from "./ui";

const LIVE: Status[] = ["pending_procurement", "pending_pm", "approved_sourcing", "ordered", "returned_to_site", "returned_to_procurement"];

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", STATUS_STYLE[status], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", LIVE.includes(status) && "animate-pulse-dot")} aria-hidden />
      {t(STATUS_LABEL[status])}
    </span>
  );
}

export function UrgentBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm shadow-rose-500/40">
      <Zap className="h-3 w-3" aria-hidden /> {t("Urgent")}
    </span>
  );
}

/** "Waiting 1d 4h" — amber after a day, red after two (the scope's reminder threshold). */
export function WaitingBadge({ status, updatedAt }: { status: Status; updatedAt: string }) {
  const { t } = useI18n();
  const w = waitingTime({ status, updated_at: updatedAt });
  if (!w) return null;
  return (
    <span
      title={t("Time at the current step")}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        w.level === "ok" && "bg-slate-50 text-slate-600 ring-slate-200",
        w.level === "warn" && "bg-amber-50 text-amber-800 ring-amber-300",
        w.level === "late" && "bg-rose-50 text-rose-700 ring-rose-300",
      )}
    >
      <Hourglass className={cn("h-3 w-3", w.level === "late" && "animate-pulse-dot")} aria-hidden />
      {t("Waiting {time}", { time: w.text })}
    </span>
  );
}
