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
  it("delivery date: past (back-entry) and today accepted; over 12 months back refused", async () => {
    const id = await requestAt("approved_sourcing");
    const sup = await supplierId();
    await refused("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(-400) }, /within 12 months of today/);
    await ok("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(-5) });
    await ok("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(0) });
  });
});

describe("input limits and injection attempts", () => {
  const long = (n: number) => "x".repeat(n);

  it("comments over 1,000 characters are refused; 1,000 is fine", async () => {
    const id = await requestAt("pending_procurement");
    await refused("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: long(1001) }, /1000 characters or fewer/);
    await ok("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: long(1000) });
  });

  it("purpose, urgent reason and line text have length limits", async () => {
    const c = await as("se1");
    const id = await draft("se1", "155", { lines: 0 });
    expect((await c.from("purchase_requests").update({ purpose: long(201) }).eq("id", id)).error?.message).toMatch(/Purpose must be 200/);
    expect((await c.from("purchase_requests").update({ urgency_reason: long(301) }).eq("id", id)).error?.message).toMatch(/urgent reason must be 300/);
    const line = { request_id: id, line_no: 1, unit: "PCS", qty: 1 };
    expect((await c.from("request_lines").insert({ ...line, description: long(201) })).error?.message).toMatch(/description must be 200/);
    expect((await c.from("request_lines").insert({ ...line, description: "ok", size_spec: long(101) })).error?.message).toMatch(/Size \/ spec must be 100/);
    expect((await c.from("request_lines").insert({ ...line, description: "ok", notes: long(301) })).error?.message).toMatch(/Line notes must be 300/);
  });

  it("control characters and bidi overrides are stripped; Arabic text is kept", async () => {
    const c = await as("se1");
    const id = await draft("se1", "155", { lines: 0 });
    await c.from("request_lines").insert({ request_id: id, line_no: 1, unit: "PCS", qty: 1, description: "Pipe\u0007‮ 2⁦in\u0000".replace("\u0000", ""), notes: "خرسانة‏ جاهزة" });
    const { data } = await admin.from("request_lines").select("description,notes").eq("request_id", id).single();
    expect(data!.description).toBe("Pipe 2in");
    expect(data!.notes).toBe("خرسانة‏ جاهزة");
  });

  it("HTML, script and SQL typed into fields are stored as plain text and change nothing", async () => {
    const c = await as("se1");
    const nasty = `<script>alert(1)</script><img src=x onerror=alert(2)> '; drop table purchase_requests; -- " or 1=1`;
    const id = await draft("se1", "155", { lines: 0 });
    expect((await c.from("purchase_requests").update({ purpose: nasty.slice(0, 200) }).eq("id", id)).error).toBeNull();
    await c.from("request_lines").insert({ request_id: id, line_no: 1, unit: "PCS", qty: 1, description: nasty.slice(0, 200) });
    const { data } = await admin.from("purchase_requests").select("purpose, request_lines(description)").eq("id", id).single();
    expect(data!.purpose).toBe(nasty.slice(0, 200));
    expect((data!.request_lines as { description: string }[])[0].description).toBe(nasty.slice(0, 200));
    const { count } = await admin.from("purchase_requests").select("id", { count: "exact", head: true });
    expect(count).toBeGreaterThan(50); // table still there
    // a comment with SQL in it is just text too
    await ok("se1", "rpc_send_request", { p_request_id: id });
    await ok("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: "x'); delete from activity_log; --" });
    const log = await admin.from("activity_log").select("comment").eq("request_id", id).eq("action", "returned_to_site").single();
    expect(log.data!.comment).toBe("x'); delete from activity_log; --");
  });

  it("required date more than 12 months ahead is refused on send", async () => {
    const id = await draft("se1", "155", { days: 400 });
    await refused("se1", "rpc_send_request", { p_request_id: id }, /within 12 months of today/);
  });

  it("more than 50 lines is refused on send", async () => {
    const id = await draft("se1", "155", { lines: 51 });
    await refused("se1", "rpc_send_request", { p_request_id: id }, /at most 50 lines/);
  });

  it("delivery date more than 12 months ahead is refused", async () => {
    const id = await requestAt("approved_sourcing");
    await refused("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: await supplierId(), p_delivery_date: dubaiDate(400) }, /within 12 months of today/);
  });

  it("receipt notes over 1,000 characters are refused", async () => {
    const id = await requestAt("ordered");
    await refused("se1", "rpc_confirm_receipt", { p_request_id: id, p_notes: long(1001) }, /Delivery notes must be 1000/);
  });
});

describe("whole-number units", () => {
  it("2.5 PCS is refused, 2.5 KG is fine, 3 PCS is fine", async () => {
    const c = await as("se1");
    const id = await draft("se1", "155", { lines: 0 });
    const line = { request_id: id, line_no: 1, description: "x" };
    expect((await c.from("request_lines").insert({ ...line, unit: "PCS", qty: 2.5 })).error?.message).toMatch(/Quantity in PCS must be a whole number/);
    expect((await c.from("request_lines").insert({ ...line, unit: "KG", qty: 2.5 })).error).toBeNull();
    expect((await c.from("request_lines").insert({ ...line, line_no: 2, unit: "PCS", qty: 3 })).error).toBeNull();
  });
});
