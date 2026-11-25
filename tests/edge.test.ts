// Edge cases: blank-looking comments, races, tampering through the table API, odd inputs.
import { afterAll, describe, expect, it } from "vitest";
import { dubaiDate } from "../scripts/lib";
import { admin, as, call, cleanup, draft, ok, projectId, refused, requestAt, statusOf, supplierId } from "./helpers";

afterAll(cleanup);

const BLANKS = ["\n", "\t", " \n\t ", " ", "\r\n"];

describe("mandatory comments cannot be bypassed with invisible characters", () => {
  for (const blank of BLANKS) {
    const label = JSON.stringify(blank);
    it(`Procurement return to site with ${label} is refused`, async () => {
      const id = await requestAt("pending_procurement");
      await refused("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: blank }, /comment is required/);
      expect((await statusOf(id)).status).toBe("pending_procurement");
    });
  }
  it("PM reject / return and cancel with a newline are refused", async () => {
    const id = await requestAt("pending_pm");
    await refused("pm1", "rpc_pm_reject", { p_request_id: id, p_comment: "\n" }, /comment is required/);
    await refused("pm1", "rpc_pm_return", { p_request_id: id, p_comment: "\t\n" }, /comment is required/);
    await refused("admin", "rpc_cancel_request", { p_request_id: id, p_comment: "\r\n" }, /comment is required/);
    expect((await statusOf(id)).status).toBe("pending_pm");
  });
  it("a real comment keeps its text, trimmed", async () => {
    const id = await requestAt("pending_procurement");
    await ok("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: "\n  Please add sizes \n" });
    const { data } = await admin.from("activity_log").select("comment").eq("request_id", id).eq("action", "returned_to_site").single();
    expect(data!.comment).toBe("Please add sizes");
  });
});

describe("line descriptions", () => {
  it("a free-text line whose description is only a newline is refused", async () => {
    const id = await draft("se1", "155", { lines: 0 });
    const c = await as("se1");
    const { error } = await c.from("request_lines").insert({ request_id: id, line_no: 1, description: "\n\t", unit: "PCS", qty: 1 });
    expect(error, "blank description should be refused").not.toBeNull();
  });
  it("zero or negative quantity is refused", async () => {
    const id = await draft("se1", "155", { lines: 0 });
    const c = await as("se1");
    for (const qty of [0, -1]) {
      const { error } = await c.from("request_lines").insert({ request_id: id, line_no: 1, description: "x", unit: "PCS", qty });
      expect(error, `qty ${qty}`).not.toBeNull();
    }
  });
});

describe("races: two people press the button at the same moment", () => {
  it("double approve: exactly one wins", async () => {
    const id = await requestAt("pending_pm");
    const rs = await Promise.all([call("pm1", "rpc_pm_approve", { p_request_id: id }), call("admin", "rpc_pm_reject", { p_request_id: id, p_comment: "race" })]);
    expect(rs.filter((r) => !r.error).length).toBe(1);
    const { count } = await admin.from("approvals").select("id", { count: "exact", head: true }).eq("request_id", id).eq("step", "pm_approval");
    expect(count).toBe(1);
  });
  it("double confirm receipt: exactly one receipt", async () => {
    const id = await requestAt("ordered");
    const rs = await Promise.all([call("se1", "rpc_confirm_receipt", { p_request_id: id }), call("se1", "rpc_confirm_receipt", { p_request_id: id })]);
    expect(rs.filter((r) => !r.error).length).toBe(1);
    const { count } = await admin.from("receipts").select("request_id", { count: "exact", head: true }).eq("request_id", id);
    expect(count).toBe(1);
  });
  it("double send of a draft: one number only", async () => {
    const id = await draft("se1", "155");
    const rs = await Promise.all([call("se1", "rpc_send_request", { p_request_id: id }), call("se1", "rpc_send_request", { p_request_id: id })]);
    expect(rs.filter((r) => !r.error).length).toBe(1);
    const { count } = await admin.from("activity_log").select("id", { count: "exact", head: true }).eq("request_id", id).eq("action", "sent");
    expect(count).toBe(1);
  });
});

describe("tampering through the table API", () => {
  it("requester cannot edit a request once it is with Procurement", async () => {
    const id = await requestAt("pending_procurement");
    const c = await as("se1");
    const { data } = await c.from("purchase_requests").update({ purpose: "changed" }).eq("id", id).select("id");
    expect(data ?? []).toHaveLength(0);
    const { error } = await c.from("request_lines").insert({ request_id: id, line_no: 9, description: "sneaky", unit: "PCS", qty: 1 });
    expect(error).not.toBeNull();
  });
  it("requester cannot move a draft to a project they are not on", async () => {
    // se1 is on 155 only among these; 162 belongs to another team.
    const id = await draft("se1", "155");
    const c = await as("se1");
    const { error, data } = await c.from("purchase_requests").update({ project_id: await projectId("162") }).eq("id", id).select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
  it("nobody can write status, number or approvals directly", async () => {
    const id = await requestAt("pending_pm");
    const c = await as("pm1");
    const s = await c.from("purchase_requests").update({ status: "approved_sourcing" } as never).eq("id", id);
    expect(s.error).not.toBeNull();
    const a = await c.from("approvals").insert({ request_id: id, step: "pm_approval", decision: "approve" } as never);
    expect(a.error).not.toBeNull();
    expect((await statusOf(id)).status).toBe("pending_pm");
  });
});

describe("order details", () => {
  it("delivery date today is accepted, yesterday refused", async () => {
    const id = await requestAt("approved_sourcing");
    const sup = await supplierId();
    await refused("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(-1) }, /past/);
    await ok("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(0) });
  });
});
