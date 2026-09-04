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
import { LoadingPage, PageHeader, SectionBand, StatTile } from "@/components/ui/page";
import { EvidenceQualityCard } from "@/components/EvidenceQualityCard";
import { usDate } from "@/lib/dates";

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow="Insight"
          title="Operations performance"
          description="Volume, SLA compliance and timing for live tickets, with contribution credit taken from the activity log rather than the current assignee."
        />
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
        <LoadingPage />
      ) : q.error ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {(q.error as Error).message}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Tickets created"
              value={data?.volume.created ?? 0}
              hint={`${data?.volume.resolved ?? 0} resolved · ${data?.volume.open ?? 0} open`}
            />
            <StatTile
              label="Median response"
              value={fmtDuration(data?.timing.medianResponseMinutes ?? null)}
              hint={`Average ${fmtDuration(data?.timing.averageResponseMinutes ?? null)}`}
            />
            <StatTile
              label="Median resolution"
              value={fmtDuration(data?.timing.medianResolutionMinutes ?? null)}
              hint={`Average ${fmtDuration(data?.timing.averageResolutionMinutes ?? null)}`}
            />
            <StatTile
              label="Response SLA met"
              value={data?.sla.responseRate == null ? "—" : `${data.sla.responseRate}%`}
              tone={
                data?.sla.responseRate == null
                  ? "neutral"
                  : data.sla.responseRate >= 90
                    ? "positive"
                    : "attention"
              }
              hint={`${data?.sla.responseOnTime ?? 0} of ${data?.sla.responseScope ?? 0} · ${data?.sla.breachedOpen ?? 0} open past due`}
            />
          </div>

          <div>
            <SectionBand
              title="Timing by priority"
              hint="Median time from report to first response and to resolution"
            />
            <div className="surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5">Priority</th>
                    <th className="px-5 py-2.5 text-right">Responded</th>
                    <th className="px-5 py-2.5 text-right">Median response</th>
                    <th className="px-5 py-2.5 text-right">Resolved</th>
                    <th className="px-5 py-2.5 text-right">Median resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.timing.responseByPriority ?? []).map((r) => {
                    const res = data?.timing.resolutionByPriority.find(
                      (x) => x.priority === r.priority,
                    );
                    return (
                      <tr key={r.priority} className="border-b last:border-0">
                        <td className="px-5 py-2.5 font-medium uppercase">{r.priority}</td>
                        <td className="numeric px-5 py-2.5 text-right">{r.count}</td>
                        <td className="numeric px-5 py-2.5 text-right">{fmtDuration(r.median)}</td>
                        <td className="numeric px-5 py-2.5 text-right">{res?.count ?? 0}</td>
                        <td className="numeric px-5 py-2.5 text-right">
                          {fmtDuration(res?.median ?? null)}
                        </td>
                      </tr>
                    );
                  })}
                  {(data?.timing.responseByPriority.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                        No live tickets in this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SectionBand
              title="Where the work comes from"
              hint={`${data?.volume.unassigned ?? 0} open tickets have no current owner`}
            />
            <div className="surface space-y-4 p-4 text-sm">
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
            </div>
          </div>

          <div>
            <SectionBand
              title="Contribution credit"
              hint="Drawn from the immutable activity log — a record of contribution and current load, not a ranking"
              actions={<Gauge className="size-4 text-muted-foreground" />}
            />
            {people.length === 0 ? (
              <p className="surface p-6 text-center text-sm text-muted-foreground">
                No logged activity on live tickets in this window.
              </p>
            ) : (
              <div className="surface overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5">Team member</th>
                      <th className="px-5 py-2.5 text-right">Touched</th>
                      <th className="px-5 py-2.5 text-right">Resolved</th>
                      <th className="px-5 py-2.5 text-right">First responses</th>
                      <th className="px-5 py-2.5 text-right">Median response</th>
                      <th className="px-5 py-2.5 text-right">Open owned</th>
                      <th className="px-5 py-2.5 text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => (
                      <tr key={p.userId} className="border-b last:border-0">
                        <td className="px-5 py-2.5 font-medium">{p.name}</td>
                        <td className="numeric px-5 py-2.5 text-right">{p.ticketsTouched}</td>
                        <td className="numeric px-5 py-2.5 text-right">{p.resolved}</td>
                        <td className="numeric px-5 py-2.5 text-right">{p.firstResponses}</td>
                        <td className="numeric px-5 py-2.5 text-right">
                          {fmtDuration(p.medianResponseMinutes)}
                        </td>
                        <td className="numeric px-5 py-2.5 text-right">{p.currentlyOwned}</td>
                        <td
                          className={`numeric px-5 py-2.5 text-right ${p.currentlyOverdue > 0 ? "text-destructive" : ""}`}
                        >
                          {p.currentlyOverdue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <details className="group mt-3">
              <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-2 hover:underline">
                Show detailed contributor breakdown
              </summary>
              <div className="surface mt-2 divide-y">
                {people.map((p) => (
                  <div
                    key={p.userId}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.actionsStarted} actions started · {p.notes} notes · {p.handoffsAccepted}/
                        {p.handoffsGiven} handoffs accepted/given
                      </p>
                    </div>
                    <p className="numeric shrink-0 text-xs text-muted-foreground">
                      Last active {usDate(p.lastActivityAt)}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-2 hover:underline">
              Evidence quality
            </summary>
            <div className="mt-2">
              <EvidenceQualityCard />
            </div>
          </details>

          <ReportingBaselineNote />
        </>
      )}
    </div>
  );
}
