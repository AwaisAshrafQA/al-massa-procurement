import type { RequestRow } from "./api";
import type { Me } from "./auth";

/** Requests whose next step belongs to this user (separation of duties: never their own decisions). */
export function waitingOnMe(r: RequestRow, me: Me): boolean {
  const has = (x: string) => me.roles.includes(x as Me["roles"][number]);
  if (r.requested_by === me.id && r.status !== "ordered") return false;
  const proc = has("procurement") || has("admin");
  switch (r.status) {
    case "pending_procurement":
    case "returned_to_procurement":
    case "approved_sourcing":
      return proc;
    case "pending_pm":
      return (has("project_manager") && r.project?.pm_user_id === me.id) || has("admin");
    case "ordered":
      return has("site_engineer") && me.memberProjectIds.includes(r.project_id);
    default:
      return false;
  }
}

export const byPriority = (a: RequestRow, b: RequestRow) =>
  Number(b.urgency === "urgent") - Number(a.urgency === "urgent") ||
  (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at);
