import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { expect } from "vitest";
import { adminClient, ANON_KEY, clientAs, dubaiDate, SUPABASE_URL, USERS, type UserKey } from "../scripts/lib";

export const admin = adminClient();
export const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

const clients: Partial<Record<UserKey, SupabaseClient>> = {};
export async function as(k: UserKey) {
  return (clients[k] ??= await clientAs(USERS[k].email));
}

const created: string[] = [];
export const TEST_TAG = "[automated test]";

export async function projectId(no: string) {
  const { data, error } = await admin.from("projects").select("id").eq("project_no", no).single();
  if (error) throw error;
  return data.id as string;
}

export async function supplierId() {
  const { data } = await admin.from("suppliers").select("id").eq("active", true).limit(1).single();
  return data!.id as string;
}

/** Creates a draft (as `who`) with `lines` lines. Tracked for cleanup. */
export async function draft(
  who: UserKey,
  project: string,
  opts: { lines?: number; days?: number; urgency?: "normal" | "urgent"; reason?: string | null } = {},
) {
  const c = await as(who);
  const { data, error } = await c.from("purchase_requests").insert({
    project_id: await projectId(project),
    required_date: dubaiDate(opts.days ?? 5),
    urgency: opts.urgency ?? "normal",
    urgency_reason: opts.reason ?? null,
    purpose: TEST_TAG,
  }).select("id").single();
  if (error) throw new Error(`draft insert: ${error.message}`);
  created.push(data.id);
  const n = opts.lines ?? 1;
  if (n > 0) {
    const { error: le } = await c.from("request_lines").insert(
      Array.from({ length: n }, (_, i) => ({ request_id: data.id, line_no: i + 1, description: `Test line ${i + 1}`, unit: "PCS", qty: 10 })),
    );
    if (le) throw new Error(`lines insert: ${le.message}`);
  }
  return data.id as string;
}

export async function call(who: UserKey, fn: string, args: Record<string, unknown>) {
  const c = await as(who);
  return c.rpc(fn, args);
}

/** Asserts the RPC succeeded and returns its JSON. */
export async function ok(who: UserKey, fn: string, args: Record<string, unknown>) {
  const { data, error } = await call(who, fn, args);
  expect(error?.message ?? null, `${who} ${fn} should succeed`).toBeNull();
  return data as { id: string; status: string; request_no: string | null };
}

/** Asserts the RPC was refused, optionally with a message containing `msg`. */
export async function refused(who: UserKey, fn: string, args: Record<string, unknown>, msg?: string | RegExp) {
  const { error } = await call(who, fn, args);
  expect(error, `${who} ${fn} should be refused`).not.toBeNull();
  if (msg) expect(error!.message).toMatch(msg);
}

export async function statusOf(id: string) {
  const { data } = await admin.from("purchase_requests").select("status,request_no").eq("id", id).single();
  return data as { status: string; request_no: string | null };
}

/** Walks a fresh request (raised by se1 on 155 unless given) up to the given stage. */
export async function requestAt(
  stage: "pending_procurement" | "pending_pm" | "approved_sourcing" | "ordered",
  who: UserKey = "se1",
  project = "155",
) {
  const id = await draft(who, project);
  await ok(who, "rpc_send_request", { p_request_id: id });
  if (stage === "pending_procurement") return id;
  await ok("proc1", "rpc_forward_to_pm", { p_request_id: id });
  if (stage === "pending_pm") return id;
  await ok(project === "162" ? "pm2" : "pm1", "rpc_pm_approve", { p_request_id: id });
  if (stage === "approved_sourcing") return id;
  await ok("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: await supplierId(), p_delivery_date: dubaiDate(2) });
  return id;
}

export async function cleanup() {
  if (created.length) await admin.from("purchase_requests").delete().in("id", created);
  await admin.from("purchase_requests").delete().eq("purpose", TEST_TAG);
}
