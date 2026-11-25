import { supabase } from "./supabase";
import type { Role, Status } from "./strings";

export type RequestRow = {
  id: string;
  request_no: string | null;
  status: Status;
  urgency: "normal" | "urgent";
  urgency_reason: string | null;
  purpose: string | null;
  required_date: string;
  created_at: string;
  sent_at: string | null;
  updated_at: string;
  requested_by: string;
  project_id: string;
  project: { project_no: string; name: string; location: string | null; pm_user_id: string | null } | null;
  requester: { full_name: string } | null;
  lines: { count: number }[];
};

const LIST_SELECT =
  "id,request_no,status,urgency,urgency_reason,purpose,required_date,created_at,sent_at,updated_at,requested_by,project_id," +
  "project:projects(project_no,name,location,pm_user_id),requester:profiles(full_name),lines:request_lines(count)";

export async function listRequests(): Promise<RequestRow[]> {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select(LIST_SELECT)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data as unknown as RequestRow[];
}

export type Line = {
  id?: string;
  line_no: number;
  item_id: string | null;
  description: string | null;
  unit: string;
  size_spec: string | null;
  qty: number;
  notes: string | null;
  item?: { item_code: string; name: string; category?: string | null } | null;
};

export type TimelineEntry = {
  id: number;
  action: string;
  from_status: Status | null;
  to_status: Status | null;
  comment: string | null;
  acted_as: Role | null;
  created_at: string;
  actor: { full_name: string } | null;
};

export type RequestDetail = RequestRow & {
  request_lines: Line[];
  activity_log: TimelineEntry[];
  procurement_details: {
    agreed_delivery_date: string;
    recorded_at: string;
    supplier: { id: string; name: string; phone: string | null } | null;
  } | null;
  receipts: { confirmed_at: string; notes: string | null; confirmer: { full_name: string } | null } | null;
};

export async function getRequest(id: string): Promise<RequestDetail | null> {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select(
      LIST_SELECT +
        ",request_lines(id,line_no,item_id,description,unit,size_spec,qty,notes,item:items(item_code,name,category))" +
        ",activity_log(id,action,from_status,to_status,comment,acted_as,created_at,actor:profiles(full_name))" +
        ",procurement_details(agreed_delivery_date,recorded_at,supplier:suppliers(id,name,phone))" +
        ",receipts(confirmed_at,notes,confirmer:profiles(full_name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = data as unknown as RequestDetail;
  d.request_lines.sort((a, b) => a.line_no - b.line_no);
  d.activity_log.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return d;
}

/** Workflow events for the requests this user can see (RLS-scoped), for the Overview charts. */
export async function listActivity(): Promise<{ request_id: string; action: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("request_id,action,created_at")
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error) throw error;
  return data as { request_id: string; action: string; created_at: string }[];
}

export type RecentEvent = {
  id: number;
  actor_id: string;
  action: string;
  created_at: string;
  comment: string | null;
  actor: { full_name: string } | null;
  request: { id: string; request_no: string | null; project: { project_no: string } | null } | null;
};

export async function listRecentEvents(limit = 8): Promise<RecentEvent[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id,action,created_at,comment,actor_id:actor,actor:profiles(full_name),request:purchase_requests(id,request_no,project:projects(project_no))")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as RecentEvent[];
}

export type Item = { id: string; item_code: string; name: string; category: string | null; default_unit: string; size: string | null };
export type Unit = { code: string; name: string };
export type Project = {
  id: string; project_no: string; name: string; location: string | null; status: string; pm_user_id: string | null;
  lat?: number | null; lng?: number | null; pm?: { full_name: string } | null;
};
export type Supplier = { id: string; name: string; phone: string | null };

export async function listItems(): Promise<Item[]> {
  const { data, error } = await supabase.from("items").select("id,item_code,name,category,default_unit,size").eq("active", true).order("item_code");
  if (error) throw error;
  return data as Item[];
}

export async function listUnits(): Promise<Unit[]> {
  const { data, error } = await supabase.from("units").select("code,name").order("code");
  if (error) throw error;
  return data as Unit[];
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select("id,project_no,name,location,status,pm_user_id,lat,lng,pm:profiles!projects_pm_user_id_fkey(full_name)").order("project_no");
  if (error) throw error;
  return data as unknown as Project[];
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from("suppliers").select("id,name,phone").eq("active", true).order("name");
  if (error) throw error;
  return data as Supplier[];
}

export type HeaderInput = {
  project_id: string;
  required_date: string;
  urgency: "normal" | "urgent";
  urgency_reason: string | null;
  purpose: string | null;
};

/** Creates or updates a draft/returned request and replaces its lines. Returns the request id. */
export async function saveRequest(id: string | null, header: HeaderInput, lines: Line[]): Promise<string> {
  let requestId = id;
  if (requestId) {
    const { error } = await supabase.from("purchase_requests").update(header).eq("id", requestId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("purchase_requests").insert(header).select("id").single();
    if (error) throw error;
    requestId = data.id as string;
  }
  const del = await supabase.from("request_lines").delete().eq("request_id", requestId);
  if (del.error) throw del.error;
  if (lines.length) {
    const { error } = await supabase.from("request_lines").insert(
      lines.map((l, i) => ({
        request_id: requestId,
        line_no: i + 1,
        item_id: l.item_id,
        description: l.description?.trim() || null,
        unit: l.unit,
        size_spec: l.size_spec?.trim() || null,
        qty: l.qty,
        notes: l.notes?.trim() || null,
      })),
    );
    if (error) throw error;
  }
  return requestId!;
}

/** Calls a workflow function; throws an Error carrying the server's readable message. */
export async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as { id: string; status: Status; request_no: string | null };
}
