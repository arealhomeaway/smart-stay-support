import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Antenna, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  breezewayRegisterWebhook,
  breezewayWebhookFixtures,
  breezewayWebhookReachability,
  breezewayWebhookRecoverFailures,
  breezewayWebhookStatus,
} from "@/lib/breezeway.functions";

type Reach = Awaited<ReturnType<typeof breezewayWebhookReachability>>;
type Fixtures = Awaited<ReturnType<typeof breezewayWebhookFixtures>>;
type Status = Awaited<ReturnType<typeof breezewayWebhookStatus>>;
type Registration = Awaited<ReturnType<typeof breezewayRegisterWebhook>>;
type Recovery = Awaited<ReturnType<typeof breezewayWebhookRecoverFailures>>;

const OUTCOME_LABELS: Record<string, string> = {
  processed: "Processed (pilot property)",
  ignored_other_property: "Ignored — other property",
  ignored_other_company: "Ignored — other company",
  duplicate: "Ignored — duplicate update",
  stale: "Ignored — older update",
  invalid: "Ignored — unusable payload",
  // Not a signature check: this is our own authenticated re-read of the task
  // against the Breezeway API failing or returning nothing.
  verify_failed: "Dropped — Breezeway task lookup failed",
};

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary" />
      ) : (
        <XCircle className="mt-0.5 h-3.5 w-3.5 text-destructive" />
      )}
      <span>{children}</span>
    </div>
  );
}

/**
 * Admin controls for the single Breezeway task webhook used by the Fitzgerald
 * pilot. The receiver's secret path is never shown here — only the host.
 */
export function BreezewayWebhookPanel() {
  const [reach, setReach] = useState<Reach | null>(null);
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reachFn = useServerFn(breezewayWebhookReachability);
  const fixturesFn = useServerFn(breezewayWebhookFixtures);
  const statusFn = useServerFn(breezewayWebhookStatus);
  const registerFn = useServerFn(breezewayRegisterWebhook);
  const recoverFn = useServerFn(breezewayWebhookRecoverFailures);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong.");

  const checkReach = useMutation({
    mutationFn: () => reachFn({}),
    onSuccess: (d) => {
      setError(null);
      setReach(d);
    },
    onError: fail,
  });
  const runFixtures = useMutation({
    mutationFn: () => fixturesFn({}),
    onSuccess: (d) => {
      setError(null);
      setFixtures(d);
    },
    onError: fail,
  });
  const loadStatus = useMutation({
    mutationFn: () => statusFn({}),
    onSuccess: (d) => {
      setError(null);
      setStatus(d);
    },
    onError: fail,
  });
  const register = useMutation({
    mutationFn: () => registerFn({}),
    onSuccess: (d) => {
      setError(null);
      setRegistration(d);
      loadStatus.mutate();
    },
    onError: fail,
  });
  const recover = useMutation({
    mutationFn: () => recoverFn({}),
    onSuccess: (d) => {
      setError(null);
      setRecovery(d);
      loadStatus.mutate();
    },
    onError: fail,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Antenna className="h-4 w-4" /> Breezeway task webhook (pilot)
            </CardTitle>
            <CardDescription>
              One subscription, company-wide delivery. Only tasks for the approved pilot property are
              verified and retained; everything else is counted and discarded. Preview only — no matters,
              assignments, messages, stage changes or Breezeway writes.
            </CardDescription>
          </div>
          <Badge variant={status?.registered ? "default" : "secondary"}>
            {status?.registered ? "Registered" : "Not registered"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => checkReach.mutate()} disabled={checkReach.isPending}>
            {checkReach.isPending ? "Checking…" : "Check receiver"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => runFixtures.mutate()} disabled={runFixtures.isPending}>
            {runFixtures.isPending ? "Testing…" : "Run payload tests"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => loadStatus.mutate()} disabled={loadStatus.isPending}>
            {loadStatus.isPending ? "Loading…" : "Refresh status"}
          </Button>
          <Button size="sm" onClick={() => register.mutate()} disabled={register.isPending}>
            {register.isPending ? "Registering…" : "Register task subscription"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => recover.mutate()} disabled={recover.isPending}>
            {recover.isPending ? "Retrying…" : "Retry failed lookups"}
          </Button>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {recovery ? (
          <div className="space-y-1 rounded-md border border-border p-3 text-xs">
            <p className="text-muted-foreground">
              Retried up to {recovery.attempted} transient lookup failure{recovery.attempted === 1 ? "" : "s"} (oldest
              first, respecting the shared rate limit). Preview only — a recovered event still goes through the same
              scope and duplicate checks as a live delivery.
            </p>
            <ul className="space-y-0.5">
              <li>Recovered: <strong>{recovery.recovered}</strong></li>
              <li>Still failing (will retry again): <strong>{recovery.stillFailing}</strong></li>
              <li>Gave up after repeated failures: <strong>{recovery.permanentlyFailed}</strong></li>
              {recovery.unrecoverable > 0 ? (
                <li>Cannot retry (no task id on record): <strong>{recovery.unrecoverable}</strong></li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {reach ? (
          <div className="space-y-1 rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Receiver: {reach.urlRedacted}</p>
            <Verdict ok={reach.reachable}>Public HTTPS response: {reach.status ?? "no response"}</Verdict>
            <Verdict ok={reach.noLoginRequired}>No interactive sign-in required</Verdict>
            <Verdict ok={reach.rejectsWrongSecret}>
              Wrong secret refused ({reach.wrongSecretStatus ?? "—"})
            </Verdict>
          </div>
        ) : null}

        {fixtures ? (
          <div className="space-y-1 rounded-md border border-border p-3">
            {fixtures.cases.map((c) => (
              <Verdict key={c.name} ok={c.passed}>
                {c.name} → {OUTCOME_LABELS[c.actual] ?? c.actual}
                {c.retryable != null ? (c.retryable ? " (retryable)" : " (not retryable)") : ""}
              </Verdict>
            ))}
          </div>
        ) : null}

        {registration ? (
          <p className="text-xs">
            {registration.ok ? "✅ " : "⚠️ "}
            {registration.message}
            {registration.subscriptionId ? ` (subscription ${registration.subscriptionId})` : ""}
          </p>
        ) : null}

        {status ? (
          <>
            <Separator />
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                Receiver {status.urlRedacted} · secret {status.secretConfigured ? "configured" : "missing"}
                {status.registeredAt ? ` · registered ${new Date(status.registeredAt).toLocaleString()}` : ""}
              </p>
              <p className="font-medium">Live deliveries: {status.liveTotal}</p>
              {status.liveTotal === 0 ? (
                <p className="text-muted-foreground">
                  Nothing delivered yet. Waiting for a naturally occurring Breezeway task event.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {Object.entries(status.counts).map(([outcome, count]) => (
                    <li key={outcome}>
                      {OUTCOME_LABELS[outcome] ?? outcome}: <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {status.existing.length > 0 ? (
                <p className="text-muted-foreground">
                  Subscriptions on the Breezeway account:{" "}
                  {status.existing
                    .map((s) => `${s.webhookType ?? "task"} → ${s.host ?? "unknown host"}${s.mine ? " (ours)" : ""}`)
                    .join(", ")}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
