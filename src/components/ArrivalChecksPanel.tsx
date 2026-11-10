/**
 * Arrival checks on Integrations (Build 12; register BN10; docs/specs/arrival-check.md): the
 * true state, the one Turn on / Turn off switch (Admin; on moves the forward only start line),
 * when the minute check last ran, when the hourly booking sync last stored arrivals, what was
 * made and skipped today and why, failures, the booking types OwnerRez sent (to confirm how owner
 * stays arrive) and the test checks on the test home.
 */
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { usDateTime } from "@/lib/dates";
import { useRole } from "@/hooks/useRole";
import { ARRIVAL_RESULT_LABEL, arrivalTime, type ArrivalResult } from "@/lib/arrival-check";

type Status = {
  enabled: boolean;
  start_line: string | null;
  last_switch: { status: string; at: string; by: string | null } | null;
  last_run_at: string | null;
  last_ingest_at: string | null;
  created_today: number;
  skipped_today: Record<string, number>;
  failed: number;
  recent_failures: { ownerrez_booking_id: string; decision_reason: string; decided_at: string }[];
  booking_types_seen: Record<string, number>;
  owner_stays_seen: number;
  tests_open: number;
};
type TestCheck = {
  id: string;
  ticket_id: string | null;
  home_label: string;
  check_in_at: string;
  deadline_at: string;
  time_zone: string;
  status: "open" | "complete" | "cancelled";
  result: ArrivalResult | null;
  alert_sent_at: string | null;
};
type Db = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => any;
};
const db = supabase as unknown as Db;

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function ArrivalChecksPanel() {
  const { isAdmin, readOnly } = useRole();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["arrival-checks-status"],
    enabled: isAdmin,
    refetchInterval: 60_000,
    queryFn: () => call<Status>("arrival_checks_status"),
  });
  const tests = useQuery({
    queryKey: ["arrival-checks-tests"],
    enabled: isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("arrival_checks")
        .select("id, ticket_id, home_label, check_in_at, deadline_at, time_zone, status, result, alert_sent_at")
        .eq("is_test", true)
        .is("cleared_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as TestCheck[];
    },
  });
  const storeFailure = useQuery({
    queryKey: ["arrival-checks-store-failure"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await db
        .from("integration_events")
        .select("created_at, error_message")
        .eq("system", "arrival_checks")
        .eq("operation", "store_bookings")
        .order("created_at", { ascending: false })
        .limit(1);
      return ((data ?? [])[0] ?? null) as { created_at: string; error_message: string | null } | null;
    },
  });
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["arrival-checks-status"] }),
      qc.invalidateQueries({ queryKey: ["arrival-checks-tests"] }),
      qc.invalidateQueries({ queryKey: ["feature-flags"] }),
    ]);
  };
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => call<{ enabled: boolean }>("set_arrival_checks", { _enabled: enabled }),
    onSuccess: async (r) => {
      toast.success(r.enabled ? "Arrival checks are on." : "Arrival checks are off.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const makeTest = useMutation({
    mutationFn: (minutes: number) => call<{ ticket_id: string }>("make_test_arrival_check", { _minutes_to_check_in: minutes }),
    onSuccess: async () => {
      toast.success("Test arrival check made.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const clearTests = useMutation({
    mutationFn: () => call<{ cleared: number }>("clear_test_arrival_checks"),
    onSuccess: async (r) => {
      toast.success(`${r.cleared} test arrival ${r.cleared === 1 ? "check" : "checks"} cleared.`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return null;
  const s = status.data;
  const busy = toggle.isPending || makeTest.isPending || clearTests.isPending || readOnly;
  const skipped = Object.entries(s?.skipped_today ?? {});
  const types = Object.entries(s?.booking_types_seen ?? {});

  return (
    <SectionCard
      title="Arrival checks"
      description="One check for each arriving home, at least 2 hours before check in. Only arrivals at least 2 hours after it is turned on."
      actions={
        s ? (
          <StatusBadge tone={s.enabled ? "success" : "neutral"}>{s.enabled ? "On" : "Off"}</StatusBadge>
        ) : null
      }
    >
      {status.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Loading…</p>
      ) : status.error ? (
        <p role="alert" className="text-sm text-destructive">The arrival check state could not be read.</p>
      ) : s ? (
        <div className="space-y-4 text-sm" data-arrival-checks-panel>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <dt className="text-muted-foreground">Start line</dt>
            <dd>{s.start_line ? usDateTime(s.start_line) : "Not set. It is set when this is turned on."}</dd>
            <dt className="text-muted-foreground">Last turned on or off</dt>
            <dd>{s.last_switch ? `${s.last_switch.status === "on" ? "On" : "Off"}, ${usDateTime(s.last_switch.at)}${s.last_switch.by ? ` by ${s.last_switch.by}` : ""}` : "Never"}</dd>
            <dt className="text-muted-foreground">Minute check last ran</dt>
            <dd>{s.last_run_at ? usDateTime(s.last_run_at) : "Not yet"}</dd>
            <dt className="text-muted-foreground">Arrivals last stored from OwnerRez</dt>
            <dd>{s.last_ingest_at ? usDateTime(s.last_ingest_at) : "Not yet"}</dd>
            <dt className="text-muted-foreground">Checks made today</dt>
            <dd>{s.created_today}</dd>
            <dt className="text-muted-foreground">Owner stays seen</dt>
            <dd>{s.owner_stays_seen}</dd>
          </dl>

          <div>
            <p className="font-medium">Skipped today</p>
            {skipped.length === 0 ? (
              <p className="text-muted-foreground">None.</p>
            ) : (
              <ul className="list-disc pl-5">
                {skipped.map(([reason, n]) => (
                  <li key={reason}>{reason}: {n}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="font-medium">Booking types OwnerRez sent</p>
            {types.length === 0 ? (
              <p className="text-muted-foreground">None stored yet.</p>
            ) : (
              <ul className="list-disc pl-5">
                {types.map(([t, n]) => (
                  <li key={t}>{t}: {n}</li>
                ))}
              </ul>
            )}
          </div>

          {(s.failed > 0 || storeFailure.data) && (
            <div className="rounded-lg border border-destructive/40 p-3" role="alert">
              {s.failed > 0 && <p className="font-medium text-destructive">{s.failed} could not be made.</p>}
              <ul className="mt-1 space-y-0.5">
                {s.recent_failures.map((f) => (
                  <li key={f.ownerrez_booking_id}>{usDateTime(f.decided_at)}: {f.decision_reason}</li>
                ))}
              </ul>
              {storeFailure.data && (
                <p className="mt-1">Last booking store problem {usDateTime(storeFailure.data.created_at)}: {storeFailure.data.error_message}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              variant={s.enabled ? "outline" : "default"}
              disabled={busy}
              onClick={() => {
                const next = !s.enabled;
                const ask = next
                  ? "Turn arrival checks on? Checks start for arrivals at least 2 hours from now."
                  : "Turn arrival checks off? No new checks will be made.";
                if (window.confirm(ask)) toggle.mutate(next);
              }}
            >
              {s.enabled ? "Turn off" : "Turn on"}
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="font-medium">Test checks on 9211 Fitzgerald Dr.</p>
            <p className="text-muted-foreground">They work while this is off, are never counted, and only the people who run the test plan see them.</p>
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => makeTest.mutate(180)}>
                Make a test check (check in 3 hours from now)
              </Button>
              <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => makeTest.mutate(60)}>
                Make a late booking test (check in 1 hour from now)
              </Button>
              <Button className="min-h-11" variant="outline" disabled={busy || (s.tests_open ?? 0) === 0} onClick={() => clearTests.mutate()}>
                Clear test checks
              </Button>
            </div>
            {(tests.data ?? []).length > 0 && (
              <ul className="space-y-1">
                {(tests.data ?? []).map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    {t.ticket_id ? (
                      <Link to="/tickets/$ticketId" params={{ ticketId: t.ticket_id }} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                        Check in {arrivalTime(t.check_in_at, t.time_zone)}, due {arrivalTime(t.deadline_at, t.time_zone)}
                      </Link>
                    ) : null}
                    <span className="text-muted-foreground">
                      {t.status === "cancelled" ? ARRIVAL_RESULT_LABEL.cancelled : t.result ? ARRIVAL_RESULT_LABEL[t.result] : ARRIVAL_RESULT_LABEL.open}
                      {t.alert_sent_at ? ", alert sent" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
