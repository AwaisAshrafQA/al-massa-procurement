// Seeds the demo: company, 6 users (4 roles), projects, units, items, suppliers and
// sample requests in mixed statuses. Re-runnable. `npm run reset` wipes requests first.
// All names and companies are invented demo data.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, clientAs, COMPANY_NAME, DEMO_PASSWORD, dubaiDate, USERS, type UserKey } from "./lib";
import { EXTRA_PROJECTS, MORE_ITEMS, MORE_SUPPLIERS, MORE_UNITS, seedScenarios } from "./scenarios";

const RESET = process.argv.includes("--reset");
const db = adminClient();

function check<R extends { data: unknown; error: { message: string } | null }>(res: R, what: string): NonNullable<R["data"]> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as NonNullable<R["data"]>;
}

/** Units measured in fractions; every other unit is counted in whole numbers. */
const MEASURED = ["TON", "KG", "M3", "LTR", "SQM"];
const UNITS: [string, string][] = [
  ["PCS", "Pieces"], ["BAG", "Bag"], ["TRIP", "Trip"], ["TANKER", "Tanker"], ["TON", "Ton"],
  ["M3", "Cubic metre"], ["LTR", "Litre"], ["KG", "Kilogram"], ["ROLL", "Roll"], ["PKT", "Packet"],
  ["SET", "Set"], ["NOS", "Numbers"], ["SQM", "Square metre"], ["LS", "Lump sum"],
];

// [code, name, category, unit, size]
const ITEMS: [string, string, string, string, string | null][] = [
  ["W1", "Water tanker (potable)", "Water", "TANKER", "5,000 gal"],
  ["W2", "Water tanker (construction)", "Water", "TANKER", "5,000 gal"],
  ["W3", "Drinking water bottles", "Water", "PKT", "12 x 1.5 L"],
  ["D1", "Diesel", "Fuel", "LTR", null],
  ["D2", "Diesel delivery (bowser)", "Fuel", "TRIP", "2,000 L"],
  ["DB1", "Debris skip removal", "Debris", "TRIP", "20 yd skip"],
  ["DB2", "Debris trailer removal", "Debris", "TRIP", "Trailer"],
  ["S1", "Washed sand", "Sand & aggregate", "TON", null],
  ["S2", "Dune sand", "Sand & aggregate", "TRIP", "Trailer"],
  ["S3", "Black sand", "Sand & aggregate", "TON", null],
  ["S4", "Aggregate 20 mm", "Sand & aggregate", "TON", "20 mm"],
  ["S5", "Aggregate 10 mm", "Sand & aggregate", "TON", "10 mm"],
  ["C1", "Cement OPC", "Cement", "BAG", "42.5N, 50 kg"],
  ["C2", "Cement SRC", "Cement", "BAG", "50 kg"],
  ["C3", "Ready-mix concrete C40", "Cement", "M3", "C40"],
  ["C4", "Tile adhesive", "Cement", "BAG", "20 kg"],
  ["R1", "Rebar 10 mm", "Steel", "TON", "10 mm, 12 m"],
  ["R2", "Rebar 12 mm", "Steel", "TON", "12 mm, 12 m"],
  ["R3", "Rebar 16 mm", "Steel", "TON", "16 mm, 12 m"],
  ["R4", "Rebar 20 mm", "Steel", "TON", "20 mm, 12 m"],
  ["R5", "Rebar 25 mm", "Steel", "TON", "25 mm, 12 m"],
  ["R6", "Binding wire", "Steel", "ROLL", "1.2 mm, 20 kg"],
  ["B1", "Concrete block hollow", "Blocks", "NOS", "20 x 20 x 40 cm"],
  ["B2", "Concrete block hollow", "Blocks", "NOS", "15 x 20 x 40 cm"],
  ["B3", "Concrete block solid", "Blocks", "NOS", "20 x 20 x 40 cm"],
  ["T1", "Plywood sheet", "Timber", "PCS", "18 mm, 4 x 8 ft"],
  ["T2", "Timber batten", "Timber", "PCS", "2 x 4 in, 4 m"],
  ["T3", "Shuttering oil", "Timber", "LTR", null],
  ["N1", "Common nails", "Fixings", "KG", "3 in"],
  ["N2", "Concrete nails", "Fixings", "KG", "2 in"],
  ["N3", "Anchor bolts", "Fixings", "PCS", "M12"],
  ["WP1", "Bitumen waterproofing membrane", "Waterproofing", "ROLL", "4 mm"],
  ["WP2", "Polythene sheet", "Waterproofing", "ROLL", "1000 gauge"],
  ["WP3", "Bitumen primer", "Waterproofing", "LTR", null],
  ["P1", "PVC pipe", "Plumbing", "PCS", "4 in, 6 m"],
  ["P2", "PVC pipe", "Plumbing", "PCS", "2 in, 6 m"],
  ["E1", "Electrical conduit", "Electrical", "PCS", "25 mm, 3 m"],
  ["E2", "Extension cable reel", "Electrical", "PCS", "50 m"],
  ["SC1", "Scaffolding tube", "Scaffolding", "PCS", "6 m"],
  ["SC2", "Scaffolding coupler", "Scaffolding", "PCS", null],
  ["SF1", "Safety helmet", "PPE", "PCS", null],
  ["SF2", "Safety vest (reflective)", "PPE", "PCS", null],
  ["SF3", "Safety shoes", "PPE", "PCS", null],
  ["SF4", "Work gloves", "PPE", "PCS", null],
  ["SF5", "Safety goggles", "PPE", "PCS", null],
  ["SF6", "Full body harness", "PPE", "PCS", null],
  ["SF7", "Dust mask", "PPE", "PKT", "Box of 50"],
  ["TL1", "Wheelbarrow", "Tools", "PCS", null],
  ["TL2", "Shovel", "Tools", "PCS", null],
  ["TL3", "Measuring tape", "Tools", "PCS", "50 m"],
];

const SUPPLIERS: [string, string][] = [
  ["Desert Water Transport (demo)", "+971 50 000 0001"],
  ["Gulf Fuel Supplies (demo)", "+971 50 000 0002"],
  ["Emirates Building Materials (demo)", "+971 50 000 0003"],
  ["Al Ain Sand & Aggregates (demo)", "+971 50 000 0004"],
  ["Steel Line Trading (demo)", "+971 50 000 0005"],
  ["SafeSite PPE Trading (demo)", "+971 50 000 0006"],
];

UNITS.push(...MORE_UNITS);
ITEMS.push(...MORE_ITEMS);
SUPPLIERS.push(...MORE_SUPPLIERS);

const PROJECTS: { no: string; name: string; location: string; lat: number | null; lng: number | null; pm: UserKey; members: UserKey[]; closed?: boolean }[] = [
  { no: "155", name: "Villa Complex", location: "Al Ain", lat: 24.2075, lng: 55.7447, pm: "pm1" as UserKey, members: ["se1"] as UserKey[] },
  { no: "162", name: "Warehouse", location: "Mussafah, Abu Dhabi", lat: 24.3537, lng: 54.5032, pm: "pm2" as UserKey, members: ["se2"] as UserKey[] },
  { no: "GEN", name: "General / all sites", location: "All sites", lat: null, lng: null, pm: "pm1" as UserKey, members: ["se1", "pm1"] as UserKey[] },
  ...EXTRA_PROJECTS,
];

async function main() {
  if (DEMO_PASSWORD.length < 8) throw new Error("DEMO_PASSWORD must be at least 8 characters");

  // ---- Company
  let company = check(await db.from("companies").select("id").eq("name", COMPANY_NAME).maybeSingle(), "read company");
  if (!company) company = check(await db.from("companies").insert({ name: COMPANY_NAME }).select("id").single(), "create company");
  const companyId: string = company!.id;

  if (RESET) {
    check(await db.from("purchase_requests").delete().eq("company_id", companyId), "delete requests");
    check(await db.from("number_sequences").delete().eq("company_id", companyId), "reset numbering");
    console.log("Reset: removed all requests and numbering.");
  }

  // ---- Users (auth + profile + roles)
  const existing = check(await db.auth.admin.listUsers({ perPage: 1000 }), "list users").users;
  const ids = {} as Record<UserKey, string>;
  for (const [key, u] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    const found = existing.find((x) => x.email?.toLowerCase() === u.email);
    if (found) {
      check(await db.auth.admin.updateUserById(found.id, { password: DEMO_PASSWORD, email_confirm: true }), `update ${u.email}`);
      ids[key] = found.id;
    } else {
      const created = check(
        await db.auth.admin.createUser({ email: u.email, password: DEMO_PASSWORD, email_confirm: true }),
        `create ${u.email}`,
      );
      ids[key] = created.user!.id;
    }
    check(
      await db.from("profiles").upsert({ id: ids[key], company_id: companyId, full_name: u.name, email: u.email, active: true }),
      `profile ${u.email}`,
    );
    check(await db.from("user_roles").delete().eq("user_id", ids[key]), `clear roles ${u.email}`);
    check(
      await db.from("user_roles").insert(u.roles.map((role) => ({ user_id: ids[key], company_id: companyId, role }))),
      `roles ${u.email}`,
    );
  }
  console.log(`Users: ${Object.keys(ids).length}`);

  // ---- Master data
  check(await db.from("units").upsert(UNITS.map(([code, name]) => ({ company_id: companyId, code, name, whole_only: !MEASURED.includes(code) }))), "units");
  check(
    await db.from("items").upsert(
      ITEMS.map(([item_code, name, category, default_unit, size]) => ({
        company_id: companyId, item_code, name, category, default_unit, size, active: true,
      })),
      { onConflict: "company_id,item_code" },
    ),
    "items",
  );
  check(
    await db.from("suppliers").upsert(
      SUPPLIERS.map(([name, phone]) => ({ company_id: companyId, name, phone, active: true })),
      { onConflict: "company_id,name" },
    ),
    "suppliers",
  );

  const projectIds: Record<string, string> = {};
  for (const p of PROJECTS) {
    const row = check(
      await db.from("projects").upsert(
        { company_id: companyId, project_no: p.no, name: p.name, location: p.location, lat: p.lat, lng: p.lng, pm_user_id: ids[p.pm], status: "active" },
        { onConflict: "company_id,project_no" },
      ).select("id").single(),
      `project ${p.no}`,
    );
    projectIds[p.no] = row.id;
    check(await db.from("project_members").delete().eq("project_id", row.id), `clear members ${p.no}`);
    check(
      await db.from("project_members").insert(p.members.map((m) => ({ project_id: row.id, user_id: ids[m], company_id: companyId }))),
      `members ${p.no}`,
    );
  }
  console.log(`Master data: ${UNITS.length} units, ${ITEMS.length} items, ${SUPPLIERS.length} suppliers, ${PROJECTS.length} projects`);

  // ---- Sample requests (only when none exist, so re-running doesn't duplicate them)
  const { count } = await db.from("purchase_requests").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  if ((count ?? 0) > 0) {
    for (const p of PROJECTS.filter((x) => x.closed)) {
      check(await db.from("projects").update({ status: "closed" }).eq("id", projectIds[p.no]), `close ${p.no}`);
    }
    console.log(`Sample requests: kept existing ${count}. Run "npm run reset" to recreate them.`);
    return;
  }
  await seedRequests(projectIds);
  // Projects that were handed over are closed after their history is in place.
  for (const p of PROJECTS.filter((x) => x.closed)) {
    check(await db.from("projects").update({ status: "closed" }).eq("id", projectIds[p.no]), `close ${p.no}`);
  }
}

type Line = { code?: string; text?: string; unit: string; qty: number; size?: string; notes?: string };

async function seedRequests(projectIds: Record<string, string>) {
  const items = check(await db.from("items").select("id,item_code,size"), "read items");
  const suppliers = check(await db.from("suppliers").select("id,name"), "read suppliers");
  const itemByCode = new Map(items.map((i) => [i.item_code as string, i]));
  const sup = (prefix: string) => suppliers.find((s) => (s.name as string).startsWith(prefix))!.id as string;

  const as: Partial<Record<UserKey, SupabaseClient>> = {};
  const c = async (k: UserKey) => (as[k] ??= await clientAs(USERS[k].email));

  async function create(who: UserKey, project: string, lines: Line[], opts: { days: number; urgent?: string; purpose?: string }) {
    const client = await c(who);
    const req = check(
      await client.from("purchase_requests").insert({
        project_id: projectIds[project],
        required_date: dubaiDate(opts.days),
        urgency: opts.urgent ? "urgent" : "normal",
        urgency_reason: opts.urgent ?? null,
        purpose: opts.purpose ?? null,
      }).select("id").single(),
      "create request",
    );
    check(
      await client.from("request_lines").insert(
        lines.map((l, i) => {
          const item = l.code ? itemByCode.get(l.code) : undefined;
          return {
            request_id: req.id, line_no: i + 1, item_id: item?.id ?? null, description: l.text ?? null,
            unit: l.unit, qty: l.qty, size_spec: l.size ?? (item?.size as string | null) ?? null, notes: l.notes ?? null,
          };
        }),
      ),
      "create lines",
    );
    return req.id as string;
  }
  async function rpc(who: UserKey, fn: string, args: Record<string, unknown>) {
    check(await (await c(who)).rpc(fn, args), fn);
  }

  await seedScenarios({ db, check, create, rpc, sup, projects: PROJECTS.map((p) => ({ no: p.no, pm: p.pm, members: p.members })) });

  // 1. Received — the full cycle
  const r1 = await create("se1", "155", [
    { code: "W2", unit: "TANKER", qty: 2 },
    { code: "D1", unit: "LTR", qty: 500, notes: "For generator and excavator" },
  ], { days: 2, purpose: "Weekly site water and fuel" });
  await rpc("se1", "rpc_send_request", { p_request_id: r1 });
  await rpc("proc1", "rpc_forward_to_pm", { p_request_id: r1 });
  await rpc("pm1", "rpc_pm_approve", { p_request_id: r1 });
  await rpc("proc1", "rpc_record_order", { p_request_id: r1, p_supplier_id: sup("Desert Water"), p_delivery_date: dubaiDate(1) });
  await rpc("se1", "rpc_confirm_receipt", { p_request_id: r1, p_notes: "Delivered in full" });

  // 2. Ordered — urgent structural materials
  const r2 = await create("se1", "155", [
    { code: "C1", unit: "BAG", qty: 200 },
    { code: "R2", unit: "TON", qty: 3 },
    { code: "R6", unit: "ROLL", qty: 10 },
  ], { days: 3, urgent: "Footing pour scheduled Thursday", purpose: "Footings concrete, phase 2" });
  await rpc("se1", "rpc_send_request", { p_request_id: r2 });
  await rpc("proc1", "rpc_forward_to_pm", { p_request_id: r2, p_comment: "Quantities checked against BOQ" });
  await rpc("pm1", "rpc_pm_approve", { p_request_id: r2 });
  await rpc("proc1", "rpc_record_order", { p_request_id: r2, p_supplier_id: sup("Emirates Building"), p_delivery_date: dubaiDate(3) });

  // 3. Approved – sourcing
  const r3 = await create("se1", "155", [{ code: "S1", unit: "TON", qty: 20 }, { code: "S4", unit: "TON", qty: 15 }], { days: 6 });
  await rpc("se1", "rpc_send_request", { p_request_id: r3 });
  await rpc("proc1", "rpc_forward_to_pm", { p_request_id: r3 });
  await rpc("pm1", "rpc_pm_approve", { p_request_id: r3 });

  // 4. Pending PM — company-wide PPE
  const r4 = await create("se1", "GEN", [
    { code: "SF1", unit: "PCS", qty: 30 },
    { code: "SF2", unit: "PCS", qty: 30 },
    { text: "Ear defenders, consultant-approved brand", unit: "PCS", qty: 20 },
  ], { days: 7, purpose: "PPE restock for new labour batch" });
  await rpc("se1", "rpc_send_request", { p_request_id: r4 });
  await rpc("proc1", "rpc_forward_to_pm", { p_request_id: r4 });

  // 5. Pending procurement
  const r5 = await create("se1", "155", [{ code: "B1", unit: "NOS", qty: 1500 }, { code: "B2", unit: "NOS", qty: 800 }], { days: 8 });
  await rpc("se1", "rpc_send_request", { p_request_id: r5 });

  // 6. Returned to site
  const r6 = await create("se1", "155", [{ code: "DB1", unit: "TRIP", qty: 3 }], { days: 4 });
  await rpc("se1", "rpc_send_request", { p_request_id: r6 });
  await rpc("proc1", "rpc_return_to_site", { p_request_id: r6, p_comment: "Please confirm skip size and whether this replaces last week's request." });

  // 7. Rejected
  const r7 = await create("se2", "162", [{ code: "T1", unit: "PCS", qty: 120 }], { days: 9 });
  await rpc("se2", "rpc_send_request", { p_request_id: r7 });
  await rpc("proc1", "rpc_forward_to_pm", { p_request_id: r7 });
  await rpc("pm2", "rpc_pm_reject", { p_request_id: r7, p_comment: "Shuttering already available from project 155. Transfer instead." });

  // 8. Returned to procurement
  const r8 = await create("se2", "162", [{ code: "D2", unit: "TRIP", qty: 2 }], { days: 5, urgent: "Generators running low" });
  await rpc("se2", "rpc_send_request", { p_request_id: r8 });
  await rpc("proc1", "rpc_forward_to_pm", { p_request_id: r8 });
  await rpc("pm2", "rpc_pm_return", { p_request_id: r8, p_comment: "Check if 1 trip is enough until month end." });

  // 9. Pending PM, raised by the project's own PM (separation of duties demo: pm1 cannot approve, Admin can)
  const r9 = await create("pm1", "GEN", [{ text: "Site cabin office supplies (printer paper A4)", unit: "PKT", qty: 10 }], { days: 6, purpose: "Site office" });
  await rpc("pm1", "rpc_send_request", { p_request_id: r9 });
  await rpc("proc1", "rpc_forward_to_pm", { p_request_id: r9 });

  // 10. Draft
  await create("se1", "155", [{ code: "N1", unit: "KG", qty: 25 }, { text: "Masking tape 2 in", unit: "ROLL", qty: 40 }], { days: 10 });

  await create("se3", "171", [{ code: "PT1", unit: "DRUM", qty: 24 }, { code: "PT2", unit: "DRUM", qty: 10 }], { days: 9, purpose: "Painting – typical floor" });
  console.log("Sample requests: 11 current (all statuses, 2 drafts).");
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
