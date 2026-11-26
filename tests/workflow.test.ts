// Every workflow transition: allowed once, and blocked for the wrong role, wrong status,
// missing comment and separation-of-duties cases. Runs against the linked Supabase project.
import { afterAll, describe, expect, it } from "vitest";
import { dubaiDate } from "../scripts/lib";
import { admin, cleanup, draft, ok, refused, requestAt, statusOf, supplierId } from "./helpers";

afterAll(cleanup);

describe("send", () => {
  it("assigns PR-YYYY-NNNN on first send and moves to pending_procurement", async () => {
    const id = await draft("se1", "155");
    expect((await statusOf(id)).request_no).toBeNull();
    const r = await ok("se1", "rpc_send_request", { p_request_id: id });
    expect(r.status).toBe("pending_procurement");
    expect(r.request_no).toMatch(/^PR-\d{4}-\d{4}$/);
  });

  it("gives consecutive numbers", async () => {
    const nums: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await ok("se1", "rpc_send_request", { p_request_id: await draft("se1", "155") });
      nums.push(Number(r.request_no!.slice(-4)));
    }
    expect(nums[1]).toBe(nums[0] + 1);
    expect(nums[2]).toBe(nums[1] + 1);
  });

  it("refuses a request with no lines", async () => {
    await refused("se1", "rpc_send_request", { p_request_id: await draft("se1", "155", { lines: 0 }) }, /at least one line/);
  });

  it("accepts a past required date (back-entry) but not more than 12 months back", async () => {
    expect((await ok("se1", "rpc_send_request", { p_request_id: await draft("se1", "155", { days: -3 }) })).status).toBe("pending_procurement");
    await refused("se1", "rpc_send_request", { p_request_id: await draft("se1", "155", { days: -400 }) }, /within 12 months of today/);
  });

  it("refuses urgent without a reason", async () => {
    await refused("se1", "rpc_send_request", { p_request_id: await draft("se1", "155", { urgency: "urgent", reason: "  " }) }, /reason/);
  });

  it("refuses sending someone else's draft", async () => {
    const id = await draft("pm1", "GEN"); // se1 is also on GEN, so can see it
    await refused("se1", "rpc_send_request", { p_request_id: id }, /Only the person who raised/);
  });

  it("refuses sending twice", async () => {
    const id = await requestAt("pending_procurement");
    await refused("se1", "rpc_send_request", { p_request_id: id }, /Cannot send/);
  });
});

describe("procurement review", () => {
  it("only Procurement (or Admin) can forward", async () => {
    const id = await requestAt("pending_procurement");
    await refused("se1", "rpc_forward_to_pm", { p_request_id: id }, /Only Procurement/);
    await refused("pm1", "rpc_forward_to_pm", { p_request_id: id }, /Only Procurement/);
    expect((await ok("proc1", "rpc_forward_to_pm", { p_request_id: id })).status).toBe("pending_pm");
  });

  it("cannot forward from the wrong status", async () => {
    const id = await requestAt("pending_pm");
    await refused("proc1", "rpc_forward_to_pm", { p_request_id: id }, /Cannot forward/);
  });

  it("return to site requires a real comment, then the requester can edit and resend with the same number", async () => {
    const id = await requestAt("pending_procurement");
    const no = (await statusOf(id)).request_no;
    await refused("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: "" }, /comment is required/);
    await refused("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: "   " }, /comment is required/);
    expect((await ok("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: "Specify size" })).status).toBe("returned_to_site");
    const r = await ok("se1", "rpc_send_request", { p_request_id: id });
    expect(r.status).toBe("pending_procurement");
    expect(r.request_no).toBe(no);
  });
});

describe("PM decision", () => {
  it("only the project's PM (or Admin) can approve", async () => {
    const id = await requestAt("pending_pm");
    await refused("se1", "rpc_pm_approve", { p_request_id: id }, /Project Manager/);
    await refused("proc1", "rpc_pm_approve", { p_request_id: id }, /Project Manager/);
    await refused("pm2", "rpc_pm_approve", { p_request_id: id }, /not found/); // pm2 cannot even see project 155
    expect((await ok("pm1", "rpc_pm_approve", { p_request_id: id })).status).toBe("approved_sourcing");
    await refused("pm1", "rpc_pm_approve", { p_request_id: id }, /Cannot approve/);
  });

  it("two simultaneous approvals: exactly one succeeds", async () => {
    const id = await requestAt("pending_pm");
    const { call } = await import("./helpers");
    const results = await Promise.all([
      call("pm1", "rpc_pm_approve", { p_request_id: id }),
      call("pm1", "rpc_pm_approve", { p_request_id: id }),
    ]);
    expect(results.filter((r) => !r.error).length).toBe(1);
    const { count } = await admin.from("approvals").select("id", { count: "exact", head: true })
      .eq("request_id", id).eq("decision", "approve");
    expect(count).toBe(1);
  });

  it("return to Procurement requires a comment; Procurement can then re-forward or return to site", async () => {
    const id = await requestAt("pending_pm");
    await refused("pm1", "rpc_pm_return", { p_request_id: id, p_comment: "" }, /comment is required/);
    expect((await ok("pm1", "rpc_pm_return", { p_request_id: id, p_comment: "Check qty" })).status).toBe("returned_to_procurement");
    expect((await ok("proc1", "rpc_forward_to_pm", { p_request_id: id })).status).toBe("pending_pm");
    await ok("pm1", "rpc_pm_return", { p_request_id: id, p_comment: "Still unclear" });
    expect((await ok("proc1", "rpc_return_to_site", { p_request_id: id, p_comment: "Site to clarify" })).status).toBe("returned_to_site");
  });

  it("reject requires a comment and closes the request", async () => {
    const id = await requestAt("pending_pm");
    await refused("pm1", "rpc_pm_reject", { p_request_id: id, p_comment: " " }, /comment is required/);
    expect((await ok("pm1", "rpc_pm_reject", { p_request_id: id, p_comment: "Not needed" })).status).toBe("rejected");
    await refused("proc1", "rpc_forward_to_pm", { p_request_id: id });
    await refused("se1", "rpc_send_request", { p_request_id: id });
    await refused("pm1", "rpc_pm_approve", { p_request_id: id });
  });
});

describe("separation of duties", () => {
  it("a PM cannot approve their own request; Admin can, and is recorded as Admin", async () => {
    const id = await requestAt("pending_pm", "pm1", "GEN");
    await refused("pm1", "rpc_pm_approve", { p_request_id: id }, /raised yourself/);
    await refused("pm1", "rpc_pm_reject", { p_request_id: id, p_comment: "x" }, /raised yourself/);
    expect((await ok("admin", "rpc_pm_approve", { p_request_id: id })).status).toBe("approved_sourcing");
    const { data } = await admin.from("activity_log").select("acted_as").eq("request_id", id).eq("action", "approved").single();
    expect(data!.acted_as).toBe("admin");
  });
});

describe("order and receipt", () => {
  it("record order: Procurement only, past dates allowed within 12 months; updates are logged", async () => {
    const id = await requestAt("approved_sourcing");
    const sup = await supplierId();
    await refused("se1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(2) }, /Only Procurement/);
    await refused("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(-400) }, /within 12 months of today/);
    expect((await ok("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(2) })).status).toBe("ordered");
    await ok("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: sup, p_delivery_date: dubaiDate(4) });
    const { data } = await admin.from("activity_log").select("action").eq("request_id", id).order("created_at");
    expect(data!.map((r) => r.action)).toContain("order_updated");
  });

  it("cannot record an order before PM approval", async () => {
    const id = await requestAt("pending_pm");
    await refused("proc1", "rpc_record_order", { p_request_id: id, p_supplier_id: await supplierId(), p_delivery_date: dubaiDate(2) }, /Cannot record/);
  });

  it("receipt: only once ordered, only by a site engineer on the project", async () => {
    const early = await requestAt("approved_sourcing");
    await refused("se1", "rpc_confirm_receipt", { p_request_id: early }, /Cannot confirm/);

    const id = await requestAt("ordered");
    await refused("se2", "rpc_confirm_receipt", { p_request_id: id }, /not found/);
    await refused("proc1", "rpc_confirm_receipt", { p_request_id: id }, /site engineer/);
    expect((await ok("se1", "rpc_confirm_receipt", { p_request_id: id, p_notes: "All good" })).status).toBe("received");
    await refused("se1", "rpc_confirm_receipt", { p_request_id: id });
  });
});

describe("cancel and delete", () => {
  it("requester can cancel before PM review, with a comment", async () => {
    const id = await requestAt("pending_procurement");
    await refused("se1", "rpc_cancel_request", { p_request_id: id, p_comment: "" }, /comment is required/);
    expect((await ok("se1", "rpc_cancel_request", { p_request_id: id, p_comment: "Duplicate" })).status).toBe("cancelled");
  });

  it("requester cannot cancel once with the PM; others cannot cancel; Admin can cancel an order", async () => {
    const id = await requestAt("pending_pm");
    await refused("se1", "rpc_cancel_request", { p_request_id: id, p_comment: "x" }, /Cannot cancel/);
    await refused("proc1", "rpc_cancel_request", { p_request_id: id, p_comment: "x" }, /requester or Admin/);
    const ordered = await requestAt("ordered");
    expect((await ok("admin", "rpc_cancel_request", { p_request_id: ordered, p_comment: "Supplier failed" })).status).toBe("cancelled");
  });

  it("unsent drafts can be deleted by their owner only; sent requests cannot", async () => {
    const d = await draft("se1", "GEN");
    await refused("pm1", "rpc_delete_draft", { p_request_id: d }, /Only the person/);
    await ok("se1", "rpc_delete_draft", { p_request_id: d });
    const { data } = await admin.from("purchase_requests").select("id").eq("id", d);
    expect(data).toEqual([]);
    const sent = await requestAt("pending_procurement");
    await refused("se1", "rpc_delete_draft", { p_request_id: sent }, /Only unsent drafts/);
  });
});

describe("timeline", () => {
  it("records every step with actor, from/to status and comment", async () => {
    const id = await requestAt("ordered");
    await ok("se1", "rpc_confirm_receipt", { p_request_id: id });
    const { data } = await admin.from("activity_log").select("action,from_status,to_status,actor,comment").eq("request_id", id).order("created_at");
    expect(data!.map((r) => r.action)).toEqual(["sent", "forwarded_to_pm", "approved", "order_recorded", "receipt_confirmed"]);
    expect(data!.every((r) => r.actor && r.to_status)).toBe(true);
    expect(data![3].comment).toMatch(/^Supplier: /);
  });
});
