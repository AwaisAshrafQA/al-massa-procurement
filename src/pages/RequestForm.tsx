import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ItemPicker } from "@/components/ItemPicker";
import { useToast } from "@/components/Toast";
import { Alert, Button, Card, Field, Input, ListSkeleton, Select, Textarea, cn } from "@/components/ui";
import { getRequest, listItems, listProjects, listUnits, rpc, saveRequest, type Line } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { todayDubai } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { addDays, LIMITS, qtyProblem, sanitizeQty } from "@/lib/limits";

type Draft = Omit<Line, "qty"> & { key: string; qtyText: string };
let seq = 0;
const blankLine = (): Draft => ({ key: `l${++seq}`, line_no: 0, item_id: null, description: null, unit: "", size_spec: "", qtyText: "", notes: "" });

export function RequestForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const qc = useQueryClient();
  const { me } = useAuth();
  const toast = useToast();
  const { t } = useI18n();

  const items = useQuery({ queryKey: ["items"], queryFn: listItems });
  const units = useQuery({ queryKey: ["units"], queryFn: listUnits });
  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const existing = useQuery({ queryKey: ["request", id], queryFn: () => getRequest(id!), enabled: editing });

  const [projectId, setProjectId] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [reason, setReason] = useState("");
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<Draft[]>([blankLine()]);
  const [tried, setTried] = useState(false);
  // A field shows its message once the user has left it (or pressed Send), then updates live.
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const touch = (k: string) => setTouched((s) => (s.has(k) ? s : new Set(s).add(k)));
  const show = (k: string) => tried || touched.has(k);
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editing);

  const myProjects = useMemo(
    () => (projects.data ?? []).filter((p) => p.status === "active" && me?.memberProjectIds.includes(p.id)),
    [projects.data, me],
  );

  useEffect(() => {
    if (!editing && myProjects.length === 1 && !projectId) setProjectId(myProjects[0].id);
  }, [editing, myProjects, projectId]);

  useEffect(() => {
    const r = existing.data;
    if (!r || loaded) return;
    setProjectId(r.project_id);
    setRequiredDate(r.required_date);
    setUrgent(r.urgency === "urgent");
    setReason(r.urgency_reason ?? "");
    setPurpose(r.purpose ?? "");
    setLines(r.request_lines.length
      ? r.request_lines.map((l) => ({ ...l, key: `l${++seq}`, qtyText: sanitizeQty(String(Number(l.qty))), size_spec: l.size_spec ?? "", notes: l.notes ?? "" }))
      : [blankLine()]);
    setLoaded(true);
  }, [existing.data, loaded]);

  const today = todayDubai();
  // Past dates are allowed (earlier days' requests can be entered); 12 months either side.
  const minDate = addDays(today, -LIMITS.daysAhead);
  const maxDate = addDays(today, LIMITS.daysAhead);
  const lineErrors = lines.map((l) => ({
    item: !l.item_id && !(l.description ?? "").trim(),
    qty: qtyProblem(l.qtyText, units.data?.find((u) => u.code === l.unit)), // above 0, 3 decimals, whole for counted units
    unit: !l.unit,
  }));
  const errors = {
    project: !projectId ? t("Choose a project.") : null,
    date: !requiredDate ? t("Choose the date it is needed on site.")
      : requiredDate < minDate || requiredDate > maxDate ? t("Choose a date within 12 months of today.") : null,
    reason: urgent && !reason.trim() ? t("Say why it is urgent.") : null,
    lines: lines.length === 0 ? t("Add at least one line.") : lines.length > LIMITS.lines ? t("A request can have at most {n} lines.", { n: LIMITS.lines }) : null,
  };
  const valid = !Object.values(errors).some(Boolean) && lineErrors.every((e) => !e.item && !e.qty && !e.unit);

  function update(key: string, patch: Partial<Draft>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit(send: boolean) {
    setTried(true);
    setError(null);
    if (send && !valid) return;
    if (!send && !projectId) return; // a draft needs at least a project
    // A draft may skip lines that are still completely empty, but never silently drops a line
    // the user has started: those must be finished or removed first.
    const untouched = (l: Draft) => !l.item_id && !(l.description ?? "").trim() && !l.qtyText.trim();
    const lineBad = (i: number) => lineErrors[i].item || lineErrors[i].unit || lineErrors[i].qty;
    if (!send && lines.some((l, i) => !untouched(l) && lineBad(i))) {
      setError(t("Finish or remove the highlighted lines before saving."));
      return;
    }
    setBusy(send ? "send" : "save");
    try {
      const keep = send ? lines : lines.filter((l) => !untouched(l));
      const savedId = await saveRequest(
        id ?? null,
        {
          project_id: projectId,
          required_date: requiredDate || today,
          urgency: urgent ? "urgent" : "normal",
          urgency_reason: urgent ? reason.trim() || null : null,
          purpose: purpose.trim() || null,
        },
        keep.map((l) => ({ ...l, qty: Number(l.qtyText) })),
      );
      if (send) {
        const res = await rpc("rpc_send_request", { p_request_id: savedId });
        toast("success", t("{no} sent to Procurement", { no: res.request_no ?? "" }), t("You will see every step on the timeline."));
      } else {
        toast("info", t("Saved"), t("Your changes are saved."));
      }
      await qc.invalidateQueries();
      nav(`/requests/${savedId}`, { replace: true });
    } catch (e) {
      setError(t(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  if (items.isLoading || units.isLoading || projects.isLoading || (editing && !loaded)) return <ListSkeleton rows={3} />;
  if (editing && existing.data && !["draft", "returned_to_site"].includes(existing.data.status)) {
    return <Alert>{t("This request can no longer be edited.")}</Alert>;
  }
  if (!myProjects.length) {
    return <Alert kind="info">{t("You are not assigned to any active project yet. Ask the Technical Office to add you.")}</Alert>;
  }

  return (
    <form className="space-y-5 pb-32 md:pb-4" onSubmit={(e) => { e.preventDefault(); submit(true); }} noValidate>
      <div className="flex animate-fade-up items-center gap-2">
        <Link to={editing ? `/requests/${id}` : "/requests"} className="-ms-2 rounded-xl p-2 text-slate-500 hover:bg-white hover:shadow-sm" aria-label={t("Back")}>
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {editing ? t("Edit {no}", { no: existing.data?.request_no ?? t("draft") }) : t("New purchase request")}
        </h1>
      </div>

      {existing.data?.status === "returned_to_site" && (
        <Alert kind="info">
          {t("Returned by Procurement: “{comment}”", { comment: [...existing.data.activity_log].reverse().find((a) => a.action === "returned_to_site")?.comment ?? "" })}
        </Alert>
      )}

      <Card className="animate-fade-up space-y-4 p-4" style={{ animationDelay: "60ms" }}>
        <Field label={t("Project")} htmlFor="project" required error={show("project") ? errors.project : null}>
          <Select id="project" value={projectId} onChange={(e) => { setProjectId(e.target.value); touch("project"); }}>
            <option value="" disabled>{t("Select project…")}</option>
            {myProjects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}{p.location ? ` (${p.location})` : ""}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Required on site by")} htmlFor="rdate" required error={show("rdate") ? errors.date : null}
            warning={requiredDate && !errors.date && requiredDate < today ? t("This date has passed. That's fine when entering an earlier request.") : null}>
            <Input id="rdate" type="date" min={minDate} max={maxDate} value={requiredDate} aria-invalid={show("rdate") && !!errors.date}
              onChange={(e) => { setRequiredDate(e.target.value); if (e.target.value.length === 10) touch("rdate"); }} onBlur={() => touch("rdate")} />
          </Field>
          <Field label={t("Urgency")} required>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {[false, true].map((u) => (
                <button key={String(u)} type="button" role="radio" aria-checked={urgent === u} onClick={() => setUrgent(u)}
                  className={cn("press min-h-11 rounded-xl text-sm font-semibold ring-1 ring-inset transition-all",
                    urgent === u ? (u ? "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/30 ring-rose-600" : "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/30 ring-brand-500") : "bg-white text-slate-700 ring-slate-200")}>
                  {u ? t("Urgent") : t("Normal")}
                </button>
              ))}
            </div>
          </Field>
        </div>
        {urgent && (
          <Field label={t("Why is it urgent?")} htmlFor="reason" required error={show("reason") ? errors.reason : null} count={{ value: reason, max: LIMITS.urgentReason }}>
            <Input id="reason" maxLength={LIMITS.urgentReason} value={reason} onBlur={() => touch("reason")} aria-invalid={show("reason") && !!errors.reason} onChange={(e) => setReason(e.target.value)} placeholder={t("e.g. pour scheduled tomorrow")} />
          </Field>
        )}
        <Field label={t("Purpose / BOQ reference")} htmlFor="purpose" hint={t("Optional, e.g. “Footings concrete, phase 2”")} count={{ value: purpose, max: LIMITS.purpose }}>
          <Input id="purpose" maxLength={LIMITS.purpose} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </Field>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{t("Items")} <span className="text-sm font-normal text-slate-500">({lines.length})</span></h2>
          {tried && errors.lines && <span className="text-sm text-rose-600">{errors.lines}</span>}
        </div>
        {lines.map((l, i) => {
          const e = lineErrors[i];
          return (
            <Card key={l.key} className="animate-scale-in space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">{t("Line {n}", { n: i + 1 })}</span>
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="-me-2 rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label={t("Remove line {n}", { n: i + 1 })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Field label={t("Item")} required error={show(`i-${l.key}`) && e.item ? t("Pick an item or type a description.") : null}
                warning={(() => { const j = l.item_id ? lines.findIndex((x) => x.key !== l.key && x.item_id === l.item_id) : -1; return j >= 0 ? t("Also on line {n}. Combine them unless the spec differs.", { n: j + 1 }) : null; })()}>
                <ItemPicker
                  items={items.data ?? []}
                  value={{ itemId: l.item_id, description: l.description }}
                  invalid={show(`i-${l.key}`) && e.item}
                  onLeave={() => touch(`i-${l.key}`)}
                  onPick={({ item, description }) =>
                    update(l.key, item
                      ? { item_id: item.id, description: null, unit: item.default_unit, size_spec: item.size ?? "" }
                      : { item_id: null, description })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("Quantity")} htmlFor={`q-${l.key}`} required error={show(`q-${l.key}`) && e.qty ? t(e.qty.msg, e.qty.vars) : null}>
                  <Input id={`q-${l.key}`} inputMode="decimal" maxLength={13} value={l.qtyText} placeholder="0" aria-invalid={show(`q-${l.key}`) && !!e.qty}
                    onChange={(ev) => update(l.key, { qtyText: sanitizeQty(ev.target.value) })} onBlur={() => touch(`q-${l.key}`)} />
                </Field>
                <Field label={t("Unit")} htmlFor={`u-${l.key}`} required error={show(`u-${l.key}`) && e.unit ? t("Choose a unit.") : null}>
                  <Select id={`u-${l.key}`} value={l.unit} onChange={(ev) => { update(l.key, { unit: ev.target.value }); touch(`u-${l.key}`); }}>
                    <option value="" disabled>{t("Unit…")}</option>
                    {units.data?.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("Size / spec / brand")} htmlFor={`s-${l.key}`} count={{ value: l.size_spec ?? "", max: LIMITS.sizeSpec }}>
                  <Input id={`s-${l.key}`} maxLength={LIMITS.sizeSpec} value={l.size_spec ?? ""} onChange={(ev) => update(l.key, { size_spec: ev.target.value })} />
                </Field>
                <Field label={t("Notes")} htmlFor={`n-${l.key}`} count={{ value: l.notes ?? "", max: LIMITS.lineNotes }}>
                  <Textarea id={`n-${l.key}`} rows={1} maxLength={LIMITS.lineNotes} value={l.notes ?? ""} onChange={(ev) => update(l.key, { notes: ev.target.value })} />
                </Field>
              </div>
            </Card>
          );
        })}
        <Button type="button" variant="secondary" className="w-full" disabled={lines.length >= LIMITS.lines} onClick={() => setLines((ls) => [...ls, blankLine()])}>
          <Plus className="h-4 w-4" /> {lines.length >= LIMITS.lines ? t("A request can have at most {n} lines.", { n: LIMITS.lines }) : t("Add line")}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {tried && !valid && <Alert>{t("Please fix the highlighted fields before sending.")}</Alert>}

      <div className="fixed inset-x-3 bottom-[calc(5.6rem+env(safe-area-inset-bottom,0px))] z-20 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-lift backdrop-blur md:static md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" loading={busy === "save"} disabled={!!busy} onClick={() => submit(false)}>
            {existing.data?.status === "returned_to_site" ? t("Save changes") : t("Save draft")}
          </Button>
          <Button type="submit" className="flex-1 sm:flex-none" loading={busy === "send"} disabled={!!busy}>
            {existing.data?.status === "returned_to_site" ? t("Resend to Procurement") : t("Send to Procurement")}
          </Button>
        </div>
      </div>
    </form>
  );
}
