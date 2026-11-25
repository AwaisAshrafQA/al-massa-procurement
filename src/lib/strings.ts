// All user-facing labels live here so an Arabic translation can be added in v1 without
// touching the screens.
export type Status =
  | "draft"
  | "pending_procurement"
  | "pending_pm"
  | "approved_sourcing"
  | "ordered"
  | "received"
  | "returned_to_site"
  | "returned_to_procurement"
  | "rejected"
  | "cancelled";

export type Role = "site_engineer" | "procurement" | "project_manager" | "admin";

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  pending_procurement: "Pending procurement review",
  pending_pm: "Pending PM approval",
  approved_sourcing: "Approved – sourcing",
  ordered: "Ordered – awaiting delivery",
  received: "Received",
  returned_to_site: "Returned to site",
  returned_to_procurement: "Returned to procurement",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  pending_procurement: "bg-amber-50 text-amber-800 ring-amber-200",
  pending_pm: "bg-violet-50 text-violet-800 ring-violet-200",
  approved_sourcing: "bg-sky-50 text-sky-800 ring-sky-200",
  ordered: "bg-blue-50 text-blue-800 ring-blue-200",
  received: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  returned_to_site: "bg-orange-50 text-orange-800 ring-orange-200",
  returned_to_procurement: "bg-orange-50 text-orange-800 ring-orange-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
};

export const OPEN_STATUSES: Status[] = [
  "pending_procurement",
  "pending_pm",
  "approved_sourcing",
  "ordered",
  "returned_to_site",
  "returned_to_procurement",
];

export const ROLE_LABEL: Record<Role, string> = {
  site_engineer: "Site Engineer",
  procurement: "Procurement",
  project_manager: "Project Manager",
  admin: "Admin",
};

export const ACTION_LABEL: Record<string, string> = {
  sent: "Sent to Procurement",
  resent: "Resent to Procurement",
  forwarded_to_pm: "Forwarded to Project Manager",
  returned_to_site: "Returned to site",
  approved: "Approved",
  returned_to_procurement: "Returned to Procurement",
  rejected: "Rejected",
  order_recorded: "Supplier and delivery date recorded",
  order_updated: "Order updated",
  receipt_confirmed: "Receipt confirmed",
  cancelled: "Cancelled",
};
