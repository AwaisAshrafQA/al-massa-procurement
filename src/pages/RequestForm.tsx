import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ItemPicker } from "@/components/ItemPicker";
import { useToast } from "@/components/Toast";
import { Alert, Button, Card, Field, Input, ListSkeleton, Select, Textarea, cn } from "@/components/ui";
import { getRequest, listItems, listProjects, listUnits, rpc, saveRequest, type Line } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { normaliseDigits, todayDubai } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

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
      ? r.request_lines.map((l) => ({ ...l, key: `l${++seq}`, qtyText: String(Number(l.qty)), size_spec: l.size_spec ?? "", notes: l.notes ?? "" }))
      : [blankLine()]);
    setLoaded(true);
  }, [existing.data, loaded]);

  const today = todayDubai();
  const lineErrors = lines.map((l) => {
    const q = Number(normaliseDigits(l.qtyText));
    return {
      item: !l.item_id && !(l.description ?? "").trim(),
      qty: !l.qtyText.trim() || !(q > 0),
      unit: !l.unit,
    };
  });
  const errors = {
    project: !projectId ? t("Choose a project.") : null,
    date: !requiredDate ? t("Choose the date it is needed on site.") : requiredDate < today ? t("The date cannot be in the past.") : null,
    reason: urgent && !reason.trim() ? t("Say why it is urgent.") : null,
    lines: lines.length === 0 ? t("Add at least one line.") : null,
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
    setBusy(send ? "send" : "save");
    try {
      const keep = send ? lines : lines.filter((_l, i) => !lineErrors[i].item && !lineErrors[i].unit && !lineErrors[i].qty);
      const savedId = await saveRequest(
        id ?? null,
        {
          project_id: projectId,
          required_date: requiredDate || today,
          urgency: urgent ? "urgent" : "normal",
          urgency_reason: urgent ? reason.trim() || null : null,
          purpose: purpose.trim() || null,
        },
        keep.map((l) => ({ ...l, qty: Number(normaliseDigits(l.qtyText)) })),
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
        <Field label={t("Project")} htmlFor="project" required error={tried ? errors.project : null}>
          <Select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t("Select project…")}</option>
            {myProjects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}{p.location ? ` (${p.location})` : ""}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Required on site by")} htmlFor="rdate" required error={tried ? errors.date : null}>
            <Input id="rdate" type="date" min={today} value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
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
          <Field label={t("Why is it urgent?")} htmlFor="reason" required error={tried ? errors.reason : null}>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("e.g. pour scheduled tomorrow")} />
          </Field>
        )}
        <Field label={t("Purpose / BOQ reference")} htmlFor="purpose" hint={t("Optional, e.g. “Footings concrete, phase 2”")}>
          <Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
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
                  <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="-me-2 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={t("Remove line {n}", { n: i + 1 })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Field label={t("Item")} required error={tried && e.item ? t("Pick an item or type a description.") : null}>
                <ItemPicker
                  items={items.data ?? []}
                  value={{ itemId: l.item_id, description: l.description }}
                  invalid={tried && e.item}
                  onPick={({ item, description }) =>
                    update(l.key, item
                      ? { item_id: item.id, description: null, unit: item.default_unit, size_spec: item.size ?? "" }
                      : { item_id: null, description })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("Quantity")} htmlFor={`q-${l.key}`} required error={tried && e.qty ? t("Enter a quantity above 0.") : null}>
                  <Input id={`q-${l.key}`} inputMode="decimal" value={l.qtyText} onChange={(ev) => update(l.key, { qtyText: normaliseDigits(ev.target.value) })} placeholder="0" />
                </Field>
                <Field label={t("Unit")} htmlFor={`u-${l.key}`} required error={tried && e.unit ? t("Choose a unit.") : null}>
                  <Select id={`u-${l.key}`} value={l.unit} onChange={(ev) => update(l.key, { unit: ev.target.value })}>
                    <option value="">{t("Unit…")}</option>
                    {units.data?.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("Size / spec / brand")} htmlFor={`s-${l.key}`}>
                  <Input id={`s-${l.key}`} value={l.size_spec ?? ""} onChange={(ev) => update(l.key, { size_spec: ev.target.value })} />
                </Field>
                <Field label={t("Notes")} htmlFor={`n-${l.key}`}>
                  <Textarea id={`n-${l.key}`} rows={1} value={l.notes ?? ""} onChange={(ev) => update(l.key, { notes: ev.target.value })} />
                </Field>
              </div>
            </Card>
          );
        })}
        <Button type="button" variant="secondary" className="w-full" onClick={() => setLines((ls) => [...ls, blankLine()])}>
          <Plus className="h-4 w-4" /> {t("Add line")}
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
