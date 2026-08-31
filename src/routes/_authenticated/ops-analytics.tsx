import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Gauge } from "lucide-react";
import { opsAnalytics } from "@/lib/ops-analytics.functions";
import type { ContributorRow } from "@/lib/ops-analytics.server";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { ReportingBaselineNote } from "@/components/ReportingBaselineNote";
import { useDemo } from "@/components/DemoProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/ops-analytics")({
  head: () => ({
    meta: [
      { title: "Operations performance — Resolve" },
      {
        name: "description",
        content:
          "Ticket volume, SLA compliance, response and resolution medians, and per-person contribution credit drawn from the immutable Resolve activity log.",
      },
      { property: "og:title", content: "Operations performance — Resolve" },
      {
        property: "og:description",
        content: "SLA compliance, timing medians and contributor credit for the operations team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <OpsAnalyticsPage />
    </SupervisorOnly>
  ),
});

const RANGES = [7, 30, 90] as const;

function fmtDuration(mins: number | null) {
  if (mins === null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(1)}h`;
  return `${(mins / 1440).toFixed(1)}d`;
}

const CSV_COLUMNS: { key: keyof ContributorRow; label: string }[] = [
  { key: "name", label: "Team member" },
  { key: "email", label: "Email" },
  { key: "ticketsTouched", label: "Tickets touched" },
  { key: "resolved", label: "Tickets resolved" },
  { key: "firstResponses", label: "First responses" },
  { key: "actionsStarted", label: "Actions started" },
  { key: "notes", label: "Notes logged" },
  { key: "handoffsGiven", label: "Handoffs given" },
  { key: "handoffsAccepted", label: "Handoffs accepted" },
  { key: "medianResponseMinutes", label: "Median response (min)" },
  { key: "medianResolutionMinutes", label: "Median resolution (min)" },
  { key: "currentlyOwned", label: "Open tickets owned" },
  { key: "currentlyOverdue", label: "Open and overdue" },
  { key: "lastActivityAt", label: "Last activity" },
];

function download(rows: ContributorRow[], windowDays: number) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    CSV_COLUMNS.map((c) => esc(c.label)).join(","),
    ...rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c.key])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `operations-contribution-${windowDays}d-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function OpsAnalyticsPage() {
  const load = useServerFn(opsAnalytics);
  const { demoMode } = useDemo();
  const [windowDays, setWindowDays] = useState<number>(30);
  const q = useQuery({
    queryKey: ["ops-analytics", windowDays, demoMode],
    queryFn: () => load({ data: { windowDays, demo: demoMode } }),
  });

  const data = q.data;
  const people = data?.contributors ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Operations performance</h1>
          <p className="text-sm text-muted-foreground">
            Volume, SLA compliance and timing for live tickets, with contribution credit taken from
            the activity log rather than the current assignee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={windowDays === r ? "default" : "outline"}
              onClick={() => setWindowDays(r)}
            >
              {r} days
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={people.length === 0}
            onClick={() => download(people, windowDays)}
          >
            <Download className="mr-2 size-4" /> CSV
          </Button>
        </div>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : q.error ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {(q.error as Error).message}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Tickets created"
              value={String(data?.volume.created ?? 0)}
              hint={`${data?.volume.resolved ?? 0} resolved · ${data?.volume.open ?? 0} open`}
            />
            <Stat
              label="Median response"
              value={fmtDuration(data?.timing.medianResponseMinutes ?? null)}
              hint={`Average ${fmtDuration(data?.timing.averageResponseMinutes ?? null)}`}
            />
            <Stat
              label="Median resolution"
              value={fmtDuration(data?.timing.medianResolutionMinutes ?? null)}
              hint={`Average ${fmtDuration(data?.timing.averageResolutionMinutes ?? null)}`}
            />
            <Stat
              label="Response SLA met"
              value={data?.sla.responseRate == null ? "—" : `${data.sla.responseRate}%`}
              hint={`${data?.sla.responseOnTime ?? 0} of ${data?.sla.responseScope ?? 0} · ${data?.sla.breachedOpen ?? 0} open past due`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timing by priority</CardTitle>
                <CardDescription>Median time from report to first response and to resolution.</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2">Priority</th>
                      <th className="py-2 text-right">Responded</th>
                      <th className="py-2 text-right">Median response</th>
                      <th className="py-2 text-right">Resolved</th>
                      <th className="py-2 text-right">Median resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.timing.responseByPriority ?? []).map((r) => {
                      const res = data?.timing.resolutionByPriority.find(
                        (x) => x.priority === r.priority,
                      );
                      return (
                        <tr key={r.priority} className="border-b last:border-0">
                          <td className="py-2 font-medium uppercase">{r.priority}</td>
                          <td className="py-2 text-right">{r.count}</td>
                          <td className="py-2 text-right">{fmtDuration(r.median)}</td>
                          <td className="py-2 text-right">{res?.count ?? 0}</td>
                          <td className="py-2 text-right">{fmtDuration(res?.median ?? null)}</td>
                        </tr>
                      );
                    })}
                    {(data?.timing.responseByPriority.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          No live tickets in this window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where the work comes from</CardTitle>
                <CardDescription>
                  {data?.volume.unassigned ?? 0} open tickets have no current owner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {[
                  { label: "Priority", buckets: data?.volume.byPriority ?? [] },
                  { label: "Status", buckets: data?.volume.byStatus ?? [] },
                  { label: "Source", buckets: data?.volume.bySource ?? [] },
                ].map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.buckets.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        group.buckets.map((b) => (
                          <Badge key={b.key} variant="outline">
                            {b.label} · {b.count}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="size-4" /> Contribution credit
              </CardTitle>
              <CardDescription>
                Drawn from the immutable activity log. This is a record of contribution and current
                load — not a productivity score or ranking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {people.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No logged activity on live tickets in this window.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3">Team member</th>
                        <th className="py-2 pr-3 text-right">Touched</th>
                        <th className="py-2 pr-3 text-right">Resolved</th>
                        <th className="py-2 pr-3 text-right">First responses</th>
                        <th className="py-2 pr-3 text-right">Actions started</th>
                        <th className="py-2 pr-3 text-right">Handoffs in/out</th>
                        <th className="py-2 pr-3 text-right">Median response</th>
                        <th className="py-2 pr-3 text-right">Open owned</th>
                        <th className="py-2 text-right">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((p) => (
                        <tr key={p.userId} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{p.name}</td>
                          <td className="py-2 pr-3 text-right">{p.ticketsTouched}</td>
                          <td className="py-2 pr-3 text-right">{p.resolved}</td>
                          <td className="py-2 pr-3 text-right">{p.firstResponses}</td>
                          <td className="py-2 pr-3 text-right">{p.actionsStarted}</td>
                          <td className="py-2 pr-3 text-right">
                            {p.handoffsAccepted}/{p.handoffsGiven}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {fmtDuration(p.medianResponseMinutes)}
                          </td>
                          <td className="py-2 pr-3 text-right">{p.currentlyOwned}</td>
                          <td
                            className={`py-2 text-right ${p.currentlyOverdue > 0 ? "text-destructive" : ""}`}
                          >
                            {p.currentlyOverdue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <ReportingBaselineNote />
        </>
      )}
    </div>
  );
}
