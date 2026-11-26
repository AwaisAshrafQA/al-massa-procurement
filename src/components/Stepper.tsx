import { Check, CornerUpLeft, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Status } from "@/lib/strings";
import { cn } from "./ui";

const STEPS = ["Sent", "Procurement", "PM approval", "Sourcing", "Ordered", "Received"];

/** Where a status sits on the six-step lifecycle, and whether it is stuck. */
function position(s: Status): { at: number; state: "ok" | "returned" | "rejected" | "cancelled" | "done" } {
  switch (s) {
    case "draft": return { at: -1, state: "ok" };
    case "pending_procurement": return { at: 1, state: "ok" };
    case "returned_to_site": return { at: 0, state: "returned" };
    case "returned_to_procurement": return { at: 1, state: "returned" };
    case "pending_pm": return { at: 2, state: "ok" };
    case "approved_sourcing": return { at: 3, state: "ok" };
    case "ordered": return { at: 4, state: "ok" };
    case "received": return { at: 5, state: "done" };
    case "rejected": return { at: 2, state: "rejected" };
    case "cancelled": return { at: -1, state: "cancelled" };
  }
}

export function Stepper({ status }: { status: Status }) {
  const { t } = useI18n();
  const { at, state } = position(status);
  const pct = at <= 0 ? 0 : (at / (STEPS.length - 1)) * 100;
  const tone = state === "rejected" ? "bg-rose-500" : state === "returned" ? "bg-orange-500" : state === "cancelled" ? "bg-slate-400" : "bg-brand-500";

  return (
    <div className="relative pb-1 pt-2" aria-label={t("Progress: step {n} of {total}", { n: Math.max(at + 1, 0), total: STEPS.length })}>
      {/* line runs from the centre of the first step to the centre of the last (each step is 1/6 wide) */}
      <div className="absolute left-[8.333%] right-[8.333%] top-[17px] h-1 rounded-full bg-slate-200">
        <div className={cn("h-1 origin-left animate-grow-x rounded-full", tone)} style={{ width: `${pct}%`, animationDelay: "200ms" }} />
      </div>
      <ol className="relative flex justify-between">
        {STEPS.map((label, i) => {
          const done = state === "done" ? true : i < at;
          const current = i === at && state !== "done";
          return (
            <li key={label} className="flex w-0 flex-1 flex-col items-center text-center">
              <span
                className={cn(
                  "grid h-[22px] w-[22px] place-items-center rounded-full border-2 bg-white text-white transition-colors",
                  done && "border-brand-500 bg-brand-500",
                  current && state === "ok" && "animate-pulse-ring border-brand-500",
                  current && state === "returned" && "border-orange-500 bg-orange-500",
                  current && state === "rejected" && "border-rose-500 bg-rose-500",
                  !done && !current && "border-slate-300",
                )}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {done && <Check className="h-3 w-3" strokeWidth={3} />}
                {current && state === "ok" && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                {current && state === "returned" && <CornerUpLeft className="h-3 w-3" strokeWidth={3} />}
                {current && state === "rejected" && <X className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className={cn(
                "mt-1.5 hidden text-[11px] font-medium sm:block",
                done || current ? "text-slate-800" : "text-slate-500",
              )}>{t(label)}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 text-center text-xs font-medium text-slate-500 sm:hidden">
        {state === "cancelled" ? t("Cancelled") : state === "done" ? t("All steps complete") : at >= 0 ? t("Step {n} of 6 · {name}", { n: at + 1, name: t(STEPS[at]) }) : t("Not sent yet")}
      </div>
    </div>
  );
}
