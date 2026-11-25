import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, TrendingDown, Users } from "lucide-react";
import { ownerAnalytics } from "@/lib/owner-analytics.functions";
import type { OwnerProgramMetric } from "@/lib/owner-analytics.server";
import {
  OWNER_GOAL_DISPLAY,
  PROGRESS_META,
  PROGRAM_STATUS_META,
  REPORT_DISCLAIMER,
} from "@/lib/owner-participation";
import { RequireCapability } from "@/components/RequireCapability";
import { ReportingBaselineNote } from "@/components/ReportingBaselineNote";
import { useDemo } from "@/components/DemoProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingPage, PageHeader, SectionBand, StatTile } from "@/components/ui/page";
import { usDate } from "@/lib/dates";
import { centralToday } from "@/lib/central-today";

export const Route = createFileRoute("/_authenticated/owner-analytics")({
  head: () => ({
    meta: [
      { title: "Owner Participation: Resolve" },
      {
        name: "description",
        content:
          "Staff and executive view of Active Owner programs: reported hours against the goal of more than 100 hours, pace to the 120-hour recommendation, days left and CSV export.",
      },
      { property: "og:title", content: "Owner Participation: Resolve" },
      {
        property: "og:description",
        content: "Participation pace and days left across every live owner program.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="owner_insight_view">
      <OwnerAnalyticsPage />
    </RequireCapability>
  ),
});

const CSV_COLUMNS: { key: keyof OwnerProgramMetric; label: string }[] = [
  { key: "ownerName", label: "Owner" },
  { key: "ownerEmail", label: "Email" },
  { key: "status", label: "Program status" },
  { key: "startedOn", label: "Started" },
  { key: "endsOn", label: "Ends" },
  { key: "day", label: "Program day" },
  { key: "daysLeft", label: "Days remaining" },
  { key: "properties", label: "Homes" },
  { key: "entries", label: "Counted entries" },
  { key: "reportedHours", label: "Reported hours" },
  { key: "benchmarkHours", label: "Benchmark hours" },
  { key: "varianceHours", label: "Variance hours" },
  { key: "percentOfOperatingTarget", label: "% of 120-hour recommendation" },
  { key: "hoursToGoal", label: "Hours to 120-hour recommendation" },
  { key: "hoursPerWeekNeeded", label: "Hours per week needed (120)" },
  { key: "goalMet", label: "Goal met (more than 100)" },
  { key: "state", label: "Pace" },
  { key: "lastEntryAt", label: "Last entry" },
  { key: "daysSinceLastEntry", label: "Days since last entry" },
];

/** "Dec 31" from a YYYY-MM-DD date. */
function endsLabel(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

function toCsv(rows: OwnerProgramMetric[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = CSV_COLUMNS.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

function download(rows: OwnerProgramMetric[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `active-owner-participation-${centralToday()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function OwnerAnalyticsPage() {
  const load = useServerFn(ownerAnalytics);
  const { demoMode } = useDemo();
  const q = useQuery({
    queryKey: ["owner-analytics", demoMode],
    queryFn: () => load({ data: { demo: demoMode } }),
  });

  const data = q.data;
  const rows = data?.programs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow="Insight"
          title="Owner Participation"
          description={OWNER_GOAL_DISPLAY}
        />
        <Button variant="outline" disabled={rows.length === 0} onClick={() => download(rows)}>
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
      </div>

      {q.isLoading ? (
        <LoadingPage />
      ) : q.error ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {(q.error as Error).message}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label="Active programs"
              value={data?.totals.activePrograms ?? 0}
              hint={`${data?.totals.properties ?? 0} homes enrolled`}
            />
            <StatTile
              label="Reported hours"
              value={data?.totals.reportedHours ?? 0}
            />
            <StatTile
              label="Behind pace"
              value={data?.totals.behind ?? 0}
              tone={(data?.totals.behind ?? 0) > 0 ? "attention" : "positive"}
              hint={`${data?.totals.stale ?? 0} with no entry in 14+ days`}
            />
          </div>

          <div>
            <SectionBand
              title="Programs"
              hint={`Average ${data?.totals.averageReportedHours ?? 0} reported hrs/program · ${data?.totals.averageVarianceHours ?? 0} vs benchmark · ${data?.totals.goalMet ?? 0} with more than 100 hours`}
              actions={<Users className="size-4 text-muted-foreground" />}
            />
            {rows.length === 0 ? (
              <p className="surface p-6 text-center text-sm text-muted-foreground">
                No live owner programs yet.
              </p>
            ) : (
              <div className="surface overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5">Owner</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Days left</th>
                      <th className="px-5 py-2.5 text-right">Reported</th>
                      <th className="px-5 py-2.5 text-right">Variance</th>
                      <th className="px-5 py-2.5">Pace</th>
                      <th className="px-5 py-2.5">Last entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.programId} className="border-b last:border-0">
                        <td className="px-5 py-2.5">
                          <Link
                            to="/owner-programs"
                            className="font-medium hover:underline"
                            title={r.ownerEmail ?? undefined}
                          >
                            {r.ownerName}
                          </Link>
                          <span className="block text-xs text-muted-foreground">
                            {r.properties} home{r.properties === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <Badge variant="outline" className={PROGRAM_STATUS_META[r.status]?.tone}>
                            {PROGRAM_STATUS_META[r.status]?.label ?? r.status}
                          </Badge>
                        </td>
                        <td className="numeric px-5 py-2.5 whitespace-nowrap">
                          {r.daysLeft} days left
                          {r.endsOn ? (
                            <span className="block text-xs text-muted-foreground">Ends {endsLabel(r.endsOn)}</span>
                          ) : null}
                        </td>
                        <td className="numeric px-5 py-2.5 text-right font-medium">
                          {r.reportedHours}
                        </td>
                        <td
                          className={`numeric px-5 py-2.5 text-right ${r.varianceHours < 0 ? "text-destructive" : "text-sage"}`}
                        >
                          {r.varianceHours > 0 ? "+" : ""}
                          {r.varianceHours}
                        </td>
                        <td className="px-5 py-2.5">
                          <Badge variant="outline" className={PROGRESS_META[r.state].tone}>
                            {PROGRESS_META[r.state].label}
                          </Badge>
                        </td>
                        <td className="numeric px-5 py-2.5 whitespace-nowrap text-muted-foreground">
                          {r.lastEntryAt
                            ? `${usDate(r.lastEntryAt)} (${r.daysSinceLastEntry}d)`
                            : "No entries"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && (
              <details className="group mt-3">
                <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-2 hover:underline">
                  Show full benchmark breakdown
                </summary>
                <div className="surface mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-2.5">Owner</th>
                        <th className="px-5 py-2.5 text-right">Benchmark</th>
                        <th className="px-5 py-2.5 text-right">% of 120</th>
                        <th className="px-5 py-2.5 text-right">Hrs/week needed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.programId} className="border-b last:border-0">
                          <td className="px-5 py-2.5 font-medium">{r.ownerName}</td>
                          <td className="numeric px-5 py-2.5 text-right text-muted-foreground">
                            {r.benchmarkHours}
                          </td>
                          <td className="numeric px-5 py-2.5 text-right">
                            {r.percentOfOperatingTarget}%
                          </td>
                          <td className="numeric px-5 py-2.5 text-right">
                            {r.hoursPerWeekNeeded ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>

          {(data?.totals.flaggedEntries ?? 0) > 0 && (
            <p className="flex items-center gap-2 text-sm text-amber">
              <TrendingDown className="size-4" />
              {data?.totals.flaggedEntries} participation entries are flagged for supervisor
              attention.
            </p>
          )}

          <p className="text-xs text-muted-foreground">{REPORT_DISCLAIMER}</p>
          <ReportingBaselineNote />
        </>
      )}
    </div>
  );
}
