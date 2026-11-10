/**
 * The Breezeway bridge on Integrations (register T15, C6): its true state, the one Turn on /
 * Turn off action (Admin), the start line, the last update processed, what was made, what was
 * skipped and why, and failures. Retry all failed lookups runs the existing bounded retry until
 * none are left.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { breezewayBridgeStatus, setBreezewayBridge } from "@/lib/breezeway-bridge.functions";
import { breezewayWebhookRecoverFailures } from "@/lib/breezeway.functions";
import { BRIDGE_COPY } from "@/lib/breezeway-bridge";
import { usDateTime } from "@/lib/dates";
import { useRole } from "@/hooks/useRole";

const KIND_LABEL: Record<string, string> = {
  reported_issue: "Reported issue",
  maintenance_review: "Maintenance review",
};
const OUTCOME_LABEL: Record<string, string> = { created: "Made", skipped: "Skipped", failed: "Failed" };
const FAILURE_LABEL: Record<string, string> = {
  mirror_refresh: "Work order copy not refreshed",
  bridge_create: "Could not make the ticket or review",
  second_escalation: "Second escalation opened the existing ticket",
};

export function BreezewayBridgePanel() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const statusFn = useServerFn(breezewayBridgeStatus);
  const setFn = useServerFn(setBreezewayBridge);
  const recoverFn = useServerFn(breezewayWebhookRecoverFailures);
  const [retryLine, setRetryLine] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["breezeway-bridge-status"],
    queryFn: () => statusFn(),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setFn({ data: { enabled } }),
    onSuccess: async (r) => {
      toast.success(r.enabled ? BRIDGE_COPY.on : BRIDGE_COPY.off);
      await qc.invalidateQueries({ queryKey: ["breezeway-bridge-status"] });
      await qc.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryAll = useMutation({
    mutationFn: async () => {
      let recovered = 0;
      let stillFailing = 0;
      let gaveUp = 0;
      // The existing bounded retry handles 5 at a time under the shared rate limit.
      for (let round = 0; round < 20; round += 1) {
        const r = await recoverFn({});
        recovered += r.recovered;
        gaveUp += r.permanentlyFailed + r.unrecoverable;
        stillFailing = r.stillFailing;
        setRetryLine(`Retried so far: ${recovered} recovered, ${gaveUp} need a person.`);
        if (r.attempted === 0) break;
      }
      return { recovered, stillFailing, gaveUp };
    },
    onSuccess: async (r) => {
      setRetryLine(
        `Done. ${r.recovered} recovered, ${r.stillFailing} still failing, ${r.gaveUp} need a person.`,
      );
      await qc.invalidateQueries({ queryKey: ["breezeway-bridge-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return null;
  const s = status.data;

  return (
    <SectionCard
      title="Breezeway bridge"
      description="Reported issues become tickets in From Breezeway. Finished maintenance gets a review for Team B."
    >
      {status.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading</p>
      ) : status.error ? (
        <p className="text-sm text-destructive">{(status.error as Error).message}</p>
      ) : s ? (
        <div className="space-y-4 text-sm" data-testid="breezeway-bridge-panel">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={s.enabled ? "progress" : "waiting"}>{s.enabled ? "On" : "Off"}</StatusBadge>
            <span className="font-medium">{s.enabled ? BRIDGE_COPY.on : BRIDGE_COPY.off}</span>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Start line</dt>
              <dd>{s.start_line ? usDateTime(s.start_line) : BRIDGE_COPY.noStartLine}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last switch</dt>
              <dd>
                {s.last_switch
                  ? `${s.last_switch.status === "on" ? "Turned on" : "Turned off"}${s.last_switch.at ? ` ${usDateTime(s.last_switch.at)}` : ""} by an Admin`
                  : "Never turned on"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last update processed</dt>
              <dd>{s.last_processed_at ? usDateTime(s.last_processed_at) : "None yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Safety sweep, every 10 minutes</dt>
              <dd>
                {!s.sweep_last
                  ? "Not running yet"
                  : `Last check ${usDateTime(s.sweep_last.at)}${s.sweep_last.ran ? "" : ", nothing done while off"}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Made</dt>
              <dd>
                {s.tickets_created} tickets · {s.reviews_created} reviews
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Skipped</dt>
              <dd>
                {s.skipped}
                {Object.keys(s.skipped_by_reason).length
                  ? ` (${Object.entries(s.skipped_by_reason)
                      .map(([reason, n]) => `${n} ${reason}`)
                      .join(", ")})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Other homes since the start line</dt>
              <dd>{s.other_homes_since_start}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Failures</dt>
              <dd>
                {s.bridge_failed} not made · {s.mirror_failures} copies not refreshed ·{" "}
                {s.failed_lookups} lookups to retry · {s.second_escalations} second escalations
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {s.enabled ? (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate(false)}
              >
                {BRIDGE_COPY.turnOff}
              </Button>
            ) : (
              <Button className="min-h-11" disabled={toggle.isPending} onClick={() => toggle.mutate(true)}>
                {BRIDGE_COPY.turnOn}
              </Button>
            )}
            <Button
              variant="outline"
              className="min-h-11"
              disabled={retryAll.isPending || s.failed_lookups === 0}
              onClick={() => retryAll.mutate()}
            >
              {retryAll.isPending ? "Retrying" : `Retry all failed lookups (${s.failed_lookups})`}
            </Button>
          </div>
          {retryLine ? <p className="text-xs text-muted-foreground">{retryLine}</p> : null}

          {s.recent.length ? (
            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="min-h-11 cursor-pointer py-2 font-medium">Recent bridge records</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {s.recent.map((r) => (
                  <li key={`${r.created_at}-${r.breezeway_task_id}-${r.kind}-${r.outcome}`}>
                    {usDateTime(r.created_at)} · {KIND_LABEL[r.kind] ?? r.kind} ·{" "}
                    {OUTCOME_LABEL[r.outcome] ?? r.outcome}
                    {r.reason ? `: ${r.reason}` : ""} · Breezeway {r.breezeway_task_id}
                    {r.home ? ` · ${r.home}` : r.breezeway_home_id ? ` · Breezeway home ${r.breezeway_home_id}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {s.recent_failures.length ? (
            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="min-h-11 cursor-pointer py-2 font-medium">Recent failures</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {s.recent_failures.map((f) => (
                  <li key={`${f.created_at}-${f.operation}-${f.external_id}`}>
                    {usDateTime(f.created_at)} · {FAILURE_LABEL[f.operation] ?? f.operation}
                    {f.external_id ? ` · Breezeway ${f.external_id}` : ""}
                    {f.error_message ? ` · ${f.error_message}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
