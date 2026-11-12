/** Integrations (Admin): the nightly copy from the Notion PID, its last runs and the review list. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotebookTabs } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { useFeatureFlags } from "@/lib/feature-flags";
import { usDateTime } from "@/lib/dates";
import { REVIEW_KIND_LABEL, pidFieldLabel, pidRunLabel, type PidRunRow } from "@/lib/pid-sync/labels";

type ReviewItem = { id: string; home: string | null; field_key: string; kind: string; resolve_value: string | null; notion_value: string | null; reason: string | null };
const SHOWN = 50;

export function PidSyncPanel() {
  const { enabled } = useFeatureFlags();
  const on = enabled("pid_nightly_sync");
  const runs = useQuery({
    queryKey: ["pid-sync-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_events")
        .select("id, status, created_at, updated_at, error_message, request_payload")
        .eq("system", "notion_pid")
        .eq("operation", "nightly_sync")
        .order("created_at", { ascending: false })
        .limit(7);
      if (error) throw error;
      return (data ?? []) as PidRunRow[];
    },
  });
  const last = runs.data?.[0] ?? null;
  const review = useQuery({
    queryKey: ["pid-sync-review", last?.id],
    enabled: !!last,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pid_sync_review_items")
        .select("id, home, field_key, kind, resolve_value, notion_value, reason")
        .eq("run_id", last!.id)
        .order("home")
        .order("field_key")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ReviewItem[];
    },
  });
  const [kind, setKind] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(() => (review.data ?? []).filter((r) => kind === "all" || r.kind === kind), [review.data, kind]);
  const kinds = useMemo(() => [...new Set((review.data ?? []).map((r) => r.kind))], [review.data]);

  const label = !on ? "Off" : pidRunLabel(last);
  const tone: StatusTone = !on ? "closed" : !last ? "closed" : last.status === "failed" ? "escalated" : last.status === "processing" ? "progress" : last.error_message ? "waiting" : "resolved";
  const c = last?.request_payload?.counts;

  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><NotebookTabs className="size-4" /> Nightly copy from the PID</span>}
      description="Each night at 2 AM Central, home details copy from the Notion PID. Details changed in Resolve are never overwritten; they wait on the review list."
      actions={<StatusBadge tone={tone}>{label}</StatusBadge>}
    >
      {runs.isError ? (
        <p className="text-sm text-muted-foreground">Could not load the copy history.</p>
      ) : !last ? (
        <p className="text-sm text-muted-foreground">{on ? "No copy has run yet." : "The nightly copy is off."}</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {last.request_payload?.as_of ? `Night of ${last.request_payload.as_of}` : usDateTime(last.created_at)}
              <span className="ml-2 font-normal text-muted-foreground">started {usDateTime(last.created_at)}</span>
            </p>
            {last.error_message ? <p role="alert" className="text-destructive">{last.error_message}</p> : null}
            {c ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {([
                  ["Homes touched", c.homes_touched], ["Fills", c.fills], ["Updates", c.updates],
                  ["Skipped", c.skipped], ["On the review list", c.conflicts], ["Errors", c.errors],
                  ["From the PID values", c.extras], ["Codes filed", c.codes], ["Codes to review", c.codes_for_review],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{v ?? 0}</dd></div>
                ))}
              </dl>
            ) : null}
            {last.request_payload?.errors?.length ? (
              <ul className="list-disc pl-5 text-destructive">
                {last.request_payload.errors.slice(0, 10).map((e: { home: string; message: string }, i: number) => <li key={i}>{e.home}: {e.message}</li>)}
              </ul>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Review list</h3>
              <select
                aria-label="Show"
                className="min-h-11 rounded-md border border-input bg-background px-2 text-sm"
                value={kind}
                onChange={(e) => { setKind(e.target.value); setShowAll(false); }}
              >
                <option value="all">Everything ({review.data?.length ?? 0})</option>
                {kinds.map((k) => <option key={k} value={k}>{REVIEW_KIND_LABEL[k] ?? k} ({review.data?.filter((r) => r.kind === k).length})</option>)}
              </select>
            </div>
            {review.isError ? (
              <p className="text-sm text-muted-foreground">Could not load the review list.</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to review.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {(showAll ? items : items.slice(0, SHOWN)).map((r) => (
                  <li key={r.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(9rem,14rem)_1fr]">
                    <div className="min-w-0">
                      <p className="font-medium">{r.home ?? "Home"}</p>
                      <p className="text-xs text-muted-foreground">{pidFieldLabel(r.field_key)} · {REVIEW_KIND_LABEL[r.kind] ?? r.kind}</p>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      {r.resolve_value != null ? <p className="break-words"><span className="text-muted-foreground">Resolve: </span>{r.resolve_value}</p> : null}
                      {r.notion_value != null ? <p className="break-words"><span className="text-muted-foreground">PID: </span>{r.notion_value}</p> : null}
                      {r.reason ? <p className="text-xs text-muted-foreground">{r.reason}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!showAll && items.length > SHOWN ? (
              <Button variant="outline" className="min-h-11" onClick={() => setShowAll(true)}>Show all {items.length}</Button>
            ) : null}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
