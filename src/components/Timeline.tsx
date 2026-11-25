import { CheckCircle2, CircleDot, CornerUpLeft, PackageCheck, Send, Truck, XCircle } from "lucide-react";
import type { TimelineEntry } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { ACTION_LABEL, ROLE_LABEL } from "@/lib/strings";
import { cn } from "./ui";

const ICON: Record<string, { icon: typeof Send; tone: string }> = {
  sent: { icon: Send, tone: "bg-brand-500" },
  resent: { icon: Send, tone: "bg-brand-500" },
  forwarded_to_pm: { icon: Send, tone: "bg-violet-500" },
  approved: { icon: CheckCircle2, tone: "bg-emerald-600" },
  returned_to_site: { icon: CornerUpLeft, tone: "bg-orange-500" },
  returned_to_procurement: { icon: CornerUpLeft, tone: "bg-orange-500" },
  rejected: { icon: XCircle, tone: "bg-rose-600" },
  cancelled: { icon: XCircle, tone: "bg-slate-500" },
  order_recorded: { icon: Truck, tone: "bg-blue-600" },
  order_updated: { icon: Truck, tone: "bg-blue-600" },
  receipt_confirmed: { icon: PackageCheck, tone: "bg-emerald-600" },
};

export function Timeline({ entries, createdAt }: { entries: TimelineEntry[]; createdAt: string }) {
  const { t } = useI18n();
  return (
    <ol className="relative space-y-5 border-s-2 border-slate-200 ps-6">
      <li className="relative">
        <span className="absolute -start-[33px] grid h-6 w-6 place-items-center rounded-full bg-slate-300 text-white ring-4 ring-white">
          <CircleDot className="h-3.5 w-3.5" />
        </span>
        <div className="text-sm font-medium text-slate-700">{t("Draft created")}</div>
        <div className="text-xs text-slate-500">{fmtDateTime(createdAt)}</div>
      </li>
      {entries.map((e) => {
        const meta = ICON[e.action] ?? { icon: CircleDot, tone: "bg-slate-400" };
        const Icon = meta.icon;
        return (
          <li key={e.id} className="relative">
            <span className={cn("absolute -start-[33px] grid h-6 w-6 place-items-center rounded-full text-white ring-4 ring-white", meta.tone)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="text-sm font-semibold text-slate-900">{t(ACTION_LABEL[e.action] ?? e.action)}</div>
            <div className="text-xs text-slate-500">
              {e.actor?.full_name ?? t("Unknown")}
              {e.acted_as && <> · {e.acted_as === "admin" ? <span className="font-semibold text-rose-700">{t("as Admin")}</span> : t(ROLE_LABEL[e.acted_as])}</>}
              {" · "}{fmtDateTime(e.created_at)}
            </div>
            {e.comment && <p className="mt-1.5 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">{e.comment}</p>}
          </li>
        );
      })}
    </ol>
  );
}
