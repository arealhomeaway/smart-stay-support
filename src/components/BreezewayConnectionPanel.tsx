import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PlugZap, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  breezewayInventoryReport,
  breezewayStatus,
  testBreezewayConnection,
} from "@/lib/breezeway.functions";
import type { BreezewayInventoryReport, BreezewayMappingRow } from "@/lib/breezeway";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function when(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString();
}

function MappingList({ title, rows, limit = 8 }: { title: string; rows: BreezewayMappingRow[]; limit?: number }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">
        {title} <span className="text-muted-foreground">({rows.length})</span>
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {rows.slice(0, limit).map((r, i) => (
          <li key={`${r.breezewayId ?? r.resolveId ?? i}`} className="rounded border border-border px-2 py-1">
            <span className="text-foreground">{r.breezewayName ?? r.resolveName ?? "Unnamed"}</span>
            {r.resolveName && r.breezewayName ? ` → ${r.resolveName}` : ""} — {r.note}
          </li>
        ))}
        {rows.length > limit ? <li>…and {rows.length - limit} more.</li> : null}
      </ul>
    </div>
  );
}

/**
 * Administrator-only Breezeway control. Every server function behind these
 * buttons re-checks admin access server-side; this panel only avoids showing
 * a dead end. Errors render inline instead of crashing the page, and no raw
 * API payload or credential ever reaches the browser.
 */
export function BreezewayConnectionPanel() {
  const statusFn = useServerFn(breezewayStatus);
  const testFn = useServerFn(testBreezewayConnection);
  const reportFn = useServerFn(breezewayInventoryReport);

  const [panelError, setPanelError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<BreezewayInventoryReport | null>(null);

  const status = useQuery({
    queryKey: ["breezeway-status"],
    queryFn: () => statusFn(),
    retry: false,
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (res) => {
      setPanelError(null);
      setMessage(res.message);
      void status.refetch();
    },
    onError: (error) => setPanelError(errorText(error)),
  });

  const inventory = useMutation({
    mutationFn: () => reportFn(),
    onSuccess: (res) => {
      setPanelError(null);
      setReport(res);
    },
    onError: (error) => setPanelError(errorText(error)),
  });

  const s = status.data;
  const statusError = status.error ? errorText(status.error) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <PlugZap className="size-4" /> Breezeway
          <Badge variant={s?.apiConnected ? "default" : "secondary"}>
            API {s?.apiConnected ? "connected" : "not connected"}
          </Badge>
          <Badge variant={s?.syncEnabled ? "default" : "outline"}>
            Sync {s?.syncEnabled ? "enabled" : "off"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Read-only connection check. Breezeway credentials grant full read and write access to the
          Breezeway account — Resolve restricts itself to reads. No webhook is registered and nothing is
          imported.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {(panelError || statusError) && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{panelError ?? statusError}</span>
          </div>
        )}

        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Credentials saved</dt>
            <dd>{s?.credentialsConfigured ? "Yes" : "No"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Connected company</dt>
            <dd>{s?.connectedCompany ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Last successful check</dt>
            <dd>{s?.lastCheckOk ? when(s.lastCheckAt) : "never"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Write access</dt>
            <dd>Not tested</dd>
          </div>
        </dl>

        {s?.lastError && !s.lastCheckOk ? (
          <p className="text-xs text-muted-foreground">Last error: {s.lastError}</p>
        ) : null}

        {message ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> {message} A passing sign-in test does not
            mean synchronization or write access has been tested.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => test.mutate()} disabled={test.isPending}>
            <RefreshCw className={`size-4 ${test.isPending ? "animate-spin" : ""}`} />
            Test connection
          </Button>
          <Button variant="outline" onClick={() => inventory.mutate()} disabled={inventory.isPending}>
            {inventory.isPending ? "Comparing…" : "Compare property inventory"}
          </Button>
        </div>

        {report ? (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm">
                Breezeway lists <strong>{report.breezewayTotal}</strong> properties (
                {report.breezewayActive} active, {report.breezewayInactive} inactive,
                {" "}
                {report.breezewayOther} other). Resolve has <strong>{report.resolveTotal}</strong>, of which{" "}
                {report.resolveWithBreezewayId} already store a Breezeway ID. Fetched in{" "}
                {report.pagesFetched} page(s).
              </p>
              {report.breezewayDuplicates.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {report.breezewayDuplicates.length} possible duplicate group(s) inside Breezeway.
                </p>
              ) : null}
              <MappingList title="Matched by external ID" rows={report.matchedByExternalId} />
              <MappingList title="Suggested (needs review)" rows={report.suggested} />
              <MappingList title="Ambiguous" rows={report.ambiguous} />
              <MappingList title="In Breezeway only" rows={report.unmatchedBreezeway} />
              <MappingList title="In Resolve only" rows={report.unmatchedResolve} />
              <p className="text-xs text-muted-foreground">
                Suggestions are proposals only. Nothing was linked, created, merged or reclassified.
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
