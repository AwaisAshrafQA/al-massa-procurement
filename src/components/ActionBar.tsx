import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSuppliers, rpc, type RequestDetail } from "@/lib/api";
import { useAuth, type Me } from "@/lib/auth";
import { celebrate } from "@/lib/confetti";
import { fmtDate, todayDubai } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { addDays, LIMITS } from "@/lib/limits";
import { useToast } from "./Toast";
import { Alert, Button, Dialog, Field, Input, Select, Textarea } from "./ui";

type Kind = "comment" | "order" | "direct" | "edit";
type Action = {
  key: string;
  label: string;
  variant: "primary" | "secondary" | "danger" | "success";
  kind: Kind;
  fn?: string;
  commentRequired?: boolean;
  commentLabel?: string;
  confirmText?: string;
};

/**
 * Which buttons to show. This mirrors the server rules for convenience only;
 * the database functions are the real gate and refuse anything not allowed.
 */
export function availableActions(r: RequestDetail, me: Me): Action[] {
  const has = (x: string) => me.roles.includes(x as Me["roles"][number]);
  const mine = r.requested_by === me.id;
  const proc = has("procurement") || has("admin");
  const pm = (has("project_manager") && r.project?.pm_user_id === me.id) || has("admin");
  const onProjectAsSE = has("site_engineer") && me.memberProjectIds.includes(r.project_id);
  const a: Action[] = [];

  switch (r.status) {
    case "draft":
    case "returned_to_site":
      if (mine) {
        a.push({ key: "send", label: r.status === "draft" ? "Send to Procurement" : "Resend to Procurement", variant: "primary", kind: "direct", fn: "rpc_send_request", confirmText: "Send this request to Procurement?" });
        a.push({ key: "edit", label: "Edit", variant: "secondary", kind: "edit" });
        if (r.status === "draft" && !r.request_no) a.push({ key: "delete", label: "Delete draft", variant: "danger", kind: "direct", fn: "rpc_delete_draft", confirmText: "Delete this draft? This cannot be undone." });
        if (r.status === "returned_to_site") a.push({ key: "cancel", label: "Cancel request", variant: "danger", kind: "comment", fn: "rpc_cancel_request", commentRequired: true, commentLabel: "Reason for cancelling" });
      } else if (has("admin") && r.status === "returned_to_site") {
        a.push({ key: "cancel", label: "Cancel request", variant: "danger", kind: "comment", fn: "rpc_cancel_request", commentRequired: true, commentLabel: "Reason for cancelling" });
      }
      break;
    case "pending_procurement":
    case "returned_to_procurement":
      if (proc && !mine) {
        a.push({ key: "forward", label: "Forward to PM", variant: "primary", kind: "comment", fn: "rpc_forward_to_pm", commentLabel: "Note for the PM (optional)" });
        a.push({ key: "return", label: "Return to site", variant: "secondary", kind: "comment", fn: "rpc_return_to_site", commentRequired: true, commentLabel: "What needs correcting?" });
      }
      if ((mine && r.status === "pending_procurement") || has("admin"))
        a.push({ key: "cancel", label: "Cancel request", variant: "danger", kind: "comment", fn: "rpc_cancel_request", commentRequired: true, commentLabel: "Reason for cancelling" });
      break;
    case "pending_pm":
      if (pm && !mine) {
        a.push({ key: "approve", label: "Approve", variant: "success", kind: "comment", fn: "rpc_pm_approve", commentLabel: "Comment (optional)" });
        a.push({ key: "pm_return", label: "Return to Procurement", variant: "secondary", kind: "comment", fn: "rpc_pm_return", commentRequired: true, commentLabel: "What should Procurement check?" });
        a.push({ key: "reject", label: "Reject", variant: "danger", kind: "comment", fn: "rpc_pm_reject", commentRequired: true, commentLabel: "Reason for rejecting" });
      }
      if (has("admin")) a.push({ key: "cancel", label: "Cancel request", variant: "danger", kind: "comment", fn: "rpc_cancel_request", commentRequired: true, commentLabel: "Reason for cancelling" });
      break;
    case "approved_sourcing":
      if (proc) a.push({ key: "order", label: "Record supplier & delivery", variant: "primary", kind: "order", fn: "rpc_record_order" });
      if (has("admin")) a.push({ key: "cancel", label: "Cancel request", variant: "danger", kind: "comment", fn: "rpc_cancel_request", commentRequired: true, commentLabel: "Reason for cancelling" });
      break;
    case "ordered":
      if (onProjectAsSE || has("admin")) a.push({ key: "receive", label: "Confirm receipt", variant: "success", kind: "comment", fn: "rpc_confirm_receipt", commentLabel: "Delivery notes (optional)" });
      if (proc) a.push({ key: "order", label: "Update supplier / date", variant: "secondary", kind: "order", fn: "rpc_record_order" });
      if (has("admin")) a.push({ key: "cancel", label: "Cancel request", variant: "danger", kind: "comment", fn: "rpc_cancel_request", commentRequired: true, commentLabel: "Reason for cancelling" });
      break;
  }
  return a;
}

export function ActionBar({ request }: { request: RequestDetail }) {
  const { me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Action | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const { t } = useI18n();
  if (!me) return null;
  const actions = availableActions(request, me);
  if (!actions.length) return null;

  async function run(a: Action, extra: Record<string, unknown> = {}) {
    setBusy(a.key);
    setError(null);
    try {
      const args: Record<string, unknown> = { p_request_id: request.id, ...extra };
      const res = await rpc(a.fn!, args);
      await qc.invalidateQueries();
      setOpen(null);
      if (a.key === "delete") return nav("/requests", { replace: true });
      const closed = ["received", "rejected", "cancelled"].includes(res?.status);
      if (res?.status === "received") celebrate();
      toast("success", t("{action}: done", { action: t(a.label) }), closed ? t("This request is now closed.") : t("It is now with the next person."));
    } catch (e) {
      setError(t(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && !open && <div className="mb-3"><Alert>{error}</Alert></div>}
      <div className="flex animate-fade-up flex-wrap gap-2" style={{ animationDelay: "80ms" }}>
        {actions.map((a) => (
          <Button
            key={a.key}
            variant={a.variant}
            loading={busy === a.key}
            // wrap onto a new row instead of squeezing labels onto three lines on narrow phones
            className="flex-auto whitespace-nowrap sm:flex-none"
            onClick={() => {
              setError(null);
              if (a.kind === "edit") return nav(`/requests/${request.id}/edit`);
              setOpen(a);
            }}
          >
            {t(a.label)}
          </Button>
        ))}
      </div>

      {open && (open.kind === "direct" ? (
        <Dialog open onClose={() => setOpen(null)} title={t(open.label)}>
          <p className="text-sm text-slate-600">{t(open.confirmText ?? "")}</p>
          {error && <div className="mt-3"><Alert>{error}</Alert></div>}
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(null)}>{t("Back")}</Button>
            <Button variant={open.variant} className="flex-1" loading={!!busy} onClick={() => run(open)}>{t(open.label)}</Button>
          </div>
        </Dialog>
      ) : open.kind === "order" ? (
        <OrderDialog request={request} action={open} busy={!!busy} error={error} onClose={() => setOpen(null)} onSubmit={(x) => run(open, x)} />
      ) : (
        <CommentDialog action={open} busy={!!busy} error={error} onClose={() => setOpen(null)} onSubmit={(c) => run(open, open.fn === "rpc_confirm_receipt" ? { p_notes: c } : { p_comment: c })} />
      ))}
    </>
  );
}

function CommentDialog({ action, busy, error, onClose, onSubmit }: {
  action: Action; busy: boolean; error: string | null; onClose: () => void; onSubmit: (c: string | null) => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = action.commentRequired && !text.trim();
  const max = LIMITS.comment;
  return (
    <Dialog open onClose={onClose} title={t(action.label)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!missing) onSubmit(text.trim() || null);
        }}
        className="space-y-4"
      >
        <Field label={t(action.commentLabel ?? "Comment")} htmlFor="comment" required={action.commentRequired} error={touched && missing ? t("A comment is required.") : null} count={{ value: text, max }}>
          <Textarea id="comment" rows={3} maxLength={max} value={text} onBlur={() => setTouched(true)} aria-invalid={touched && !!missing} onChange={(e) => setText(e.target.value)} autoFocus />
        </Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>{t("Back")}</Button>
          <Button type="submit" variant={action.variant} className="flex-1" loading={busy}>{t(action.label)}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function OrderDialog({ request, action, busy, error, onClose, onSubmit }: {
  request: RequestDetail; action: Action; busy: boolean; error: string | null; onClose: () => void; onSubmit: (x: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: listSuppliers });
  const [supplier, setSupplier] = useState(request.procurement_details?.supplier?.id ?? "");
  const [date, setDate] = useState(request.procurement_details?.agreed_delivery_date ?? "");
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);
  const today = todayDubai();
  const minDate = addDays(today, -LIMITS.daysAhead);
  const maxDate = addDays(today, LIMITS.daysAhead);
  const dateError = !date ? t("Choose the agreed delivery date.") : date < minDate || date > maxDate ? t("Choose a date within 12 months of today.") : null;
  return (
    <Dialog open onClose={onClose} title={t(action.label)}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (supplier && !dateError) onSubmit({ p_supplier_id: supplier, p_delivery_date: date, p_comment: comment.trim() || null });
        }}
      >
        <Field label={t("Supplier")} htmlFor="supplier" required error={touched && !supplier ? t("Choose a supplier.") : null}>
          <Select id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="" disabled>{t("Select supplier…")}</option>
            {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label={t("Agreed delivery date")} htmlFor="ddate" required error={touched || dateTouched ? dateError : null}
          warning={date && !dateError && date > request.required_date ? t("Later than the site needs it ({date}).", { date: fmtDate(request.required_date) }) : null}>
          <Input id="ddate" type="date" min={minDate} max={maxDate} value={date} aria-invalid={(touched || dateTouched) && !!dateError}
            onChange={(e) => { setDate(e.target.value); if (e.target.value.length === 10) setDateTouched(true); }} onBlur={() => setDateTouched(true)} />
        </Field>
        <Field label={t("Note (optional)")} htmlFor="onote" count={{ value: comment, max: LIMITS.orderNote }}>
          <Input id="onote" maxLength={LIMITS.orderNote} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("e.g. quotation ref, contact person")} />
        </Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>{t("Back")}</Button>
          <Button type="submit" className="flex-1" loading={busy}>{t("Save")}</Button>
        </div>
      </form>
    </Dialog>
  );
}
