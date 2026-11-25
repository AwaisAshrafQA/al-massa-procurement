// How long a request has been waiting at its current step. Thresholds follow the scope's
// "idle more than 2 working days" reminder rule (calendar days in the MVP).
import type { RequestRow } from "./api";
import { fmtDuration } from "./format";

const OPEN = ["pending_procurement", "pending_pm", "approved_sourcing", "ordered", "returned_to_site", "returned_to_procurement"];
const DAY = 86_400_000;

export type Waiting = { ms: number; text: string; level: "ok" | "warn" | "late" };

export function waitingTime(r: Pick<RequestRow, "status" | "updated_at">): Waiting | null {
  if (!OPEN.includes(r.status)) return null;
  const ms = Date.now() - new Date(r.updated_at).getTime();
  return { ms, text: fmtDuration(ms), level: ms > 2 * DAY ? "late" : ms > DAY ? "warn" : "ok" };
}
