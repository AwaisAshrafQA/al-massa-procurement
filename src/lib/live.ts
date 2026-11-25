// Live updates: listen for new workflow events (RLS-filtered by Supabase Realtime),
// refresh all data, and tell the user when something happened that involves them.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useToast } from "@/components/Toast";
import type { Me } from "./auth";
import { translate as t } from "./i18n";
import { ACTION_LABEL } from "./strings";
import { supabase } from "./supabase";

type LogInsert = { request_id: string; action: string; actor: string; created_at: string };

export function useLiveUpdates(me: Me | null) {
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`activity-${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, async (payload) => {
        const row = payload.new as LogInsert;
        await qc.invalidateQueries();
        if (row.actor === me.id) return;
        const [req, actor] = await Promise.all([
          supabase.from("purchase_requests").select("request_no").eq("id", row.request_id).maybeSingle(),
          supabase.from("profiles").select("full_name").eq("id", row.actor).maybeSingle(),
        ]);
        toast(
          "live",
          `${req.data?.request_no ?? t("Request")} · ${t(ACTION_LABEL[row.action] ?? row.action)}`,
          t("by {name} · just now", { name: actor.data?.full_name ?? "" }),
          `/requests/${row.request_id}`,
        );
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---- Notification "seen" marker (per user, per browser) ----
const seenKey = (uid: string) => `am.seen.${uid}`;
export function getSeen(uid: string): number {
  try { return Number(localStorage.getItem(seenKey(uid)) ?? 0); } catch { return 0; }
}
export function markSeen(uid: string) {
  try { localStorage.setItem(seenKey(uid), String(Date.now())); } catch { /* ignore */ }
}
