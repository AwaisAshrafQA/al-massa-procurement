// Access control: who can read what, and that the database refuses every way around the
// workflow functions (direct status edits, writing to log/approval tables, internal helpers).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dubaiDate } from "../scripts/lib";
import { admin, anon, as, cleanup, draft, projectId, requestAt } from "./helpers";

let req155: string; // a sent request on project 155 (se1 / pm1)

beforeAll(async () => {
  req155 = await requestAt("pending_pm");
});
afterAll(cleanup);

describe("visibility", () => {
  it("se2 (project 162) cannot see any part of a project 155 request", async () => {
    const c = await as("se2");
    for (const [table, col] of [
      ["purchase_requests", "id"], ["request_lines", "request_id"], ["approvals", "request_id"], ["activity_log", "request_id"],
    ] as const) {
      const { data, error } = await c.from(table).select("*").eq(col, req155);
      expect(error).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("pm2 cannot see project 155 requests either", async () => {
    const { data } = await (await as("pm2")).from("purchase_requests").select("id").eq("id", req155);
    expect(data).toEqual([]);
  });

  it("each user sees only their own projects; Procurement and Admin see all", async () => {
    const nos = async (k: Parameters<typeof as>[0]) =>
      ((await (await as(k)).from("projects").select("project_no")).data ?? []).map((p) => p.project_no).sort();
    const all = ((await admin.from("projects").select("project_no")).data ?? []).map((p) => p.project_no).sort();
    expect(all.length).toBeGreaterThan(3);
    expect(await nos("se2")).toEqual(["162"]);
    expect(await nos("se1")).toEqual(["155", "GEN"]);
    expect(await nos("pm2")).toEqual(["162"]);
    expect(await nos("se4")).toEqual(["171", "174", "180"]);
    expect(await nos("proc1")).toEqual(all);
    expect(await nos("admin")).toEqual(all);
  });

  it("Procurement and the project's PM can see the request", async () => {
    for (const k of ["proc1", "pm1", "admin"] as const) {
      const { data } = await (await as(k)).from("purchase_requests").select("id").eq("id", req155);
      expect(data, k).toHaveLength(1);
    }
  });

  it("signed-out visitors can read nothing", async () => {
    const { data, error } = await anon.from("purchase_requests").select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    const items = await anon.from("items").select("id");
    expect(items.error !== null || (items.data ?? []).length === 0).toBe(true);
  });
});

describe("no way around the workflow", () => {
  it("nobody can set status or request number directly, not even Admin", async () => {
    const d = await draft("se1", "155");
    for (const k of ["se1", "admin"] as const) {
      const c = await as(k);
      const s = await c.from("purchase_requests").update({ status: "approved_sourcing" }).eq("id", d);
      expect(s.error, `${k} status`).not.toBeNull();
      const n = await c.from("purchase_requests").update({ request_no: "PR-HACK" }).eq("id", d);
      expect(n.error, `${k} request_no`).not.toBeNull();
    }
    const { data } = await admin.from("purchase_requests").select("status,request_no").eq("id", d).single();
    expect(data).toEqual({ status: "draft", request_no: null });
  });

  it("a new request always starts as the caller's own draft", async () => {
    const c = await as("se1");
    const { data, error } = await c.from("purchase_requests").insert({
      project_id: await projectId("155"), required_date: dubaiDate(3), purpose: "[automated test]",
    }).select("status,requested_by,request_no").single();
    expect(error).toBeNull();
    const me = (await c.auth.getUser()).data.user!.id;
    expect(data).toEqual({ status: "draft", requested_by: me, request_no: null });
  });

  it("cannot raise a request on a project you are not assigned to", async () => {
    const { error } = await (await as("se1")).from("purchase_requests").insert({
      project_id: await projectId("162"), required_date: dubaiDate(3), purpose: "[automated test]",
    });
    expect(error).not.toBeNull();
  });

  it("users without the Site Engineer role cannot raise requests", async () => {
    const { error } = await (await as("proc1")).from("purchase_requests").insert({
      project_id: await projectId("155"), required_date: dubaiDate(3), purpose: "[automated test]",
    });
    expect(error).not.toBeNull();
  });

  it("cannot write approvals, order details, receipts or the activity log directly", async () => {
    const c = await as("admin");
    const companyId = (await admin.from("companies").select("id").limit(1).single()).data!.id;
    const me = (await c.auth.getUser()).data.user!.id;
    const attempts = [
      c.from("activity_log").insert({ request_id: req155, company_id: companyId, actor: me, action: "approved" }),
      c.from("approvals").insert({ request_id: req155, company_id: companyId, step: "pm_approval", decision: "approve", decided_by: me }),
      c.from("procurement_details").insert({ request_id: req155, company_id: companyId, supplier_id: me, agreed_delivery_date: dubaiDate(2), recorded_by: me }),
      c.from("receipts").insert({ request_id: req155, company_id: companyId, confirmed_by: me }),
    ];
    for (const r of await Promise.all(attempts)) expect(r.error).not.toBeNull();
    const del = await c.from("activity_log").delete().eq("request_id", req155).select("id");
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    const { count } = await admin.from("activity_log").select("id", { count: "exact", head: true }).eq("request_id", req155);
    expect(count).toBeGreaterThan(0);
  });

  it("lines of a sent request cannot be changed or added to", async () => {
    const c = await as("se1");
    const before = (await admin.from("request_lines").select("id,qty").eq("request_id", req155)).data!;
    await c.from("request_lines").update({ qty: 9999 }).eq("request_id", req155);
    const ins = await c.from("request_lines").insert({ request_id: req155, line_no: 99, description: "sneaky", unit: "PCS", qty: 1 });
    expect(ins.error).not.toBeNull();
    const after = (await admin.from("request_lines").select("id,qty").eq("request_id", req155)).data!;
    expect(after).toEqual(before);
  });

  it("internal helper functions and the number sequence are not reachable", async () => {
    const c = await as("admin");
    const helper = await c.rpc("_set_status", { r: null, p_to: "received", p_action: "x", p_as: "admin", p_comment: null });
    expect(helper.error).not.toBeNull();
    const seq = await c.from("number_sequences").select("*");
    expect(seq.error !== null || (seq.data ?? []).length === 0).toBe(true);
  });
});
