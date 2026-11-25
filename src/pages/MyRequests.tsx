import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RequestList } from "@/components/RequestCard";
import { Alert, EmptyState, ListSkeleton, PageHeader, Select, cn } from "@/components/ui";
import { listProjects, listRequests } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { STATUS_LABEL, type Status } from "@/lib/strings";

export function MyRequests() {
  const { me } = useAuth();
  const { t } = useI18n();
  const requests = useQuery({ queryKey: ["requests"], queryFn: listRequests });
  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState<"" | "open" | Status>("open");

  const rows = useMemo(() => {
    return (requests.data ?? [])
      .filter((r) => scope === "all" || r.requested_by === me?.id)
      .filter((r) => !project || r.project_id === project)
      .filter((r) =>
        status === "" ? true
        : status === "open" ? !["received", "rejected", "cancelled"].includes(r.status)
        : r.status === status,
      );
  }, [requests.data, scope, project, status, me?.id]);

  const myProjects = (projects.data ?? []).filter((p) => me?.memberProjectIds.includes(p.id));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("My requests")}
        subtitle={t("Track every request from site to delivery")}
        action={
          <Link to="/requests/new" className="press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(32,48,80,.55)] hover:from-brand-400">
            <Plus className="h-4 w-4" /> {t("New")}
          </Link>
        }
      />

      <div className="flex animate-fade-up flex-wrap gap-2" style={{ animationDelay: "60ms" }}>
        <div className="inline-flex rounded-xl bg-slate-200/60 p-1 text-sm font-semibold" role="tablist">
          {(["mine", "all"] as const).map((s) => (
            <button key={s} role="tab" aria-selected={scope === s} onClick={() => setScope(s)}
              className={cn("rounded-lg px-3 py-1.5 transition-all", scope === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
              {s === "mine" ? t("Raised by me") : t("All on my projects")}
            </button>
          ))}
        </div>
        <Select value={project} onChange={(e) => setProject(e.target.value)} className="w-auto min-w-36 py-2" aria-label={t("Filter by project")}>
          <option value="">{t("All projects")}</option>
          {myProjects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-auto min-w-36 py-2" aria-label={t("Filter by status")}>
          <option value="open">{t("Open")}</option>
          <option value="">{t("All statuses")}</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}
        </Select>
      </div>

      {requests.isLoading ? <ListSkeleton /> : requests.error ? (
        <Alert>{t("Could not load requests: {msg}", { msg: (requests.error as Error).message })}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState title={t("No requests here")}>{t("Change the filters or create a new request.")}</EmptyState>
      ) : (
        <RequestList key={scope + project + status} rows={rows} showRequester={scope === "all"} />
      )}
    </div>
  );
}
