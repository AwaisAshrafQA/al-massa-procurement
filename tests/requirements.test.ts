// Extra checks traced to MVP requirements not covered by workflow/rls tests.
import { afterAll, describe, expect, it } from "vitest";
import { dubaiDate } from "../scripts/lib";
import { admin, as, cleanup, draft, ok, projectId, refused, requestAt, statusOf } from "./helpers";

afterAll(cleanup);

describe("request form rules (D-04, F-01, F-02)", () => {
  it("a line needs an item or a description", async () => {
    const id = await draft("se1", "155", { lines: 0 });
    const { error } = await (await as("se1")).from("request_lines").insert({ request_id: id, line_no: 1, unit: "PCS", qty: 1, description: "  " });
    expect(error).not.toBeNull();
  });

  it("quantity must be above zero", async () => {
    const id = await draft("se1", "155", { lines: 0 });
    const { error } = await (await as("se1")).from("request_lines").insert({ request_id: id, line_no: 1, unit: "PCS", qty: 0, description: "x" });
    expect(error).not.toBeNull();
  });

  it("unit must exist in the unit list", async () => {
    const id = await draft("se1", "155", { lines: 0 });
    const { error } = await (await as("se1")).from("request_lines").insert({ request_id: id, line_no: 1, unit: "BOGUS", qty: 1, description: "x" });
    expect(error).not.toBeNull();
  });

  it("catalogue and free-text lines are both stored", async () => {
    const c = await as("se1");
    const id = await draft("se1", "155", { lines: 0 });
    const { data: item } = await admin.from("items").select("id").eq("item_code", "C1").single();
    const { error } = await c.from("request_lines").insert([
      { request_id: id, line_no: 1, item_id: item!.id, unit: "BAG", qty: 10 },
      { request_id: id, line_no: 2, description: "Special sealant", unit: "PCS", qty: 2 },
    ]);
    expect(error).toBeNull();
    expect((await ok("se1", "rpc_send_request", { p_request_id: id })).status).toBe("pending_procurement");
  });

  it("a required date of today is accepted", async () => {
    const id = await draft("se1", "155", { days: 0 });
    expect((await ok("se1", "rpc_send_request", { p_request_id: id })).status).toBe("pending_procurement");
  });

  it("urgent with a reason is accepted", async () => {
    const id = await draft("se1", "155", { urgency: "urgent", reason: "Pour tomorrow" });
    expect((await ok("se1", "rpc_send_request", { p_request_id: id })).status).toBe("pending_procurement");
  });
});

describe("returned requests can be corrected (D1, S2)", () => {
  it("the requester can edit header and lines while returned to site, then resend", async () => {
    const id = await requestAt("pending_procurement");
    await ok("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: "Add quantity for line 1" });
    const c = await as("se1");
    const h = await c.from("purchase_requests").update({ purpose: "Corrected" }).eq("id", id).select("id");
    expect(h.error).toBeNull();
    expect(h.data).toHaveLength(1);
    const l = await c.from("request_lines").update({ qty: 25 }).eq("request_id", id).select("qty");
    expect(l.error).toBeNull();
    expect(Number(l.data![0].qty)).toBe(25);
    expect((await ok("se1", "rpc_send_request", { p_request_id: id })).status).toBe("pending_procurement");
  });

  it("other users cannot edit someone else's returned request", async () => {
    const id = await requestAt("pending_procurement", "se1", "GEN");
    await ok("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: "Fix" });
    const r = await (await as("pm1")).from("purchase_requests").update({ purpose: "hijack" }).eq("id", id).select("id");
    expect(r.data ?? []).toHaveLength(0);
  });
});

describe("roles (D5, D11)", () => {
  it("Admin can act for Procurement, and is logged as Admin", async () => {
    const id = await requestAt("pending_procurement");
    expect((await ok("admin", "rpc_forward_to_pm", { p_request_id: id })).status).toBe("pending_pm");
    const { data } = await admin.from("activity_log").select("acted_as").eq("request_id", id).eq("action", "forwarded_to_pm").single();
    expect(data!.acted_as).toBe("admin");
  });

  it("another Site Engineer on the same project can confirm receipt", async () => {
    // se1 raises on GEN; pm1 also holds the Site Engineer role and is a member of GEN.
    const id = await requestAt("pending_pm", "se1", "GEN");
    await ok("pm1", "rpc_pm_approve", { p_request_id: id });
    const { data: sup } = await admin.from("suppliers").select("id").limit(1).single();
    await ok("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup!.id, p_delivery_date: dubaiDate(1) });
    expect((await ok("pm1", "rpc_confirm_receipt", { p_request_id: id })).status).toBe("received");
  });
});

describe("closed projects", () => {
  it("cannot raise or send requests on a closed project", async () => {
    const gen = await projectId("GEN");
    const pending = await draft("se1", "GEN");
    await admin.from("projects").update({ status: "closed" }).eq("id", gen);
    try {
      const ins = await (await as("se1")).from("purchase_requests").insert({ project_id: gen, required_date: dubaiDate(3), purpose: "[automated test]" });
      expect(ins.error).not.toBeNull();
      await refused("se1", "rpc_send_request", { p_request_id: pending }, /closed/);
    } finally {
      await admin.from("projects").update({ status: "active" }).eq("id", gen);
    }
    expect((await statusOf(pending)).status).toBe("draft");
  });
});
