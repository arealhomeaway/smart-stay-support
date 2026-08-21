import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { CATEGORIES, OPEN_STATUSES, labelFor, priorityMeta } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics & KPIs — Resolve Operations" },
      {
        name: "description",
        content:
          "Response and resolution KPIs for ARHA: SLA compliance, time to acknowledge, reopen rate, and where the work is coming from.",
      },
      { property: "og:title", content: "Analytics & KPIs — Resolve Operations" },
      {
        property: "og:description",
        content: "SLA compliance, response times, reopen rate and workload by home and category.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <Analytics />
    </SupervisorOnly>
  ),
});

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

type Ticket = {
  id: string;
  priority: string;
  status: string;
  category: string;
  reported_at: string;
  acknowledged_at: string | null;
  action_started_at: string | null;
  resolved_at: string | null;
  response_due_at: string | null;
  action_due_at: string | null;
  reopen_count: number | null;
  closure_qa_result: string | null;
  external_source: string | null;
  source_channel: string | null;
  properties?: { name: string; nickname: string | null } | null;
};

function minutesBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

function fmtDuration(mins: number | null) {
  if (mins === null || Number.isNaN(mins)) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 60 * 24) return `${(mins / 60).toFixed(1)}h`;
  return `${(mins / 1440).toFixed(1)}d`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

function pct(part: number, total: number) {
  if (total === 0) return null;
  return Math.round((part / total) * 100);
}

function Analytics() {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, priority, status, category, reported_at, acknowledged_at, action_started_at, resolved_at, response_due_at, action_due_at, reopen_count, closure_qa_result, external_source, source_channel, properties(name, nickname)",
        )
        .gte("reported_at", since)
        .order("reported_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const total = data.length;
  const resolved = data.filter((t) => t.resolved_at);
  const open = data.filter((t) => OPEN_STATUSES.includes(t.status));

  const acked = data.filter((t) => t.acknowledged_at);
  const ackMinutes = acked.map((t) => minutesBetween(t.reported_at, t.acknowledged_at!));
  const resolveMinutes = resolved.map((t) => minutesBetween(t.reported_at, t.resolved_at!));

  const withResponseDue = data.filter((t) => t.response_due_at && t.acknowledged_at);
  const responseOnTime = withResponseDue.filter(
    (t) => new Date(t.acknowledged_at!) <= new Date(t.response_due_at!),
  );
  const withActionDue = data.filter((t) => t.action_due_at && t.action_started_at);
  const actionOnTime = withActionDue.filter(
    (t) => new Date(t.action_started_at!) <= new Date(t.action_due_at!),
  );

  const reopened = data.filter((t) => (t.reopen_count ?? 0) > 0);
  const qaPending = resolved.filter((t) => t.closure_qa_result === "not_reviewed");
  const imported = data.filter((t) => t.external_source);

  const kpis = [
    {
      label: "Matters logged",
      value: String(total),
      hint: `${open.length} still open · ${resolved.length} closed`,
    },
    {
      label: "Response SLA met",
      value: pct(responseOnTime.length, withResponseDue.length) === null ? "—" : `${pct(responseOnTime.length, withResponseDue.length)}%`,
      hint: `${responseOnTime.length} of ${withResponseDue.length} acknowledged in time`,
    },
    {
      label: "Action SLA met",
      value: pct(actionOnTime.length, withActionDue.length) === null ? "—" : `${pct(actionOnTime.length, withActionDue.length)}%`,
      hint: `${actionOnTime.length} of ${withActionDue.length} started in time`,
    },
    {
      label: "Median acknowledge",
      value: fmtDuration(median(ackMinutes)),
      hint: `${acked.length} matters acknowledged`,
    },
    {
      label: "Median time to close",
      value: fmtDuration(median(resolveMinutes)),
      hint: `${resolved.length} matters closed`,
    },
    {
      label: "Reopen rate",
      value: pct(reopened.length, total) === null ? "—" : `${pct(reopened.length, total)}%`,
      hint: `${reopened.length} matters reopened at least once`,
    },
    {
      label: "Closure QA pending",
      value: String(qaPending.length),
      hint: "Closed matters not yet quality-checked",
    },
    {
      label: "Pulled in from other systems",
      value: String(imported.length),
      hint: "OwnerRez and Breezeway inbound sync",
    },
  ];

  const byPriority = ["p1", "p2", "p3", "p4"].map((p) => {
    const rows = data.filter((t) => t.priority === p);
    const rowsResolved = rows.filter((t) => t.resolved_at);
    return {
      key: p,
      label: priorityMeta(p).short,
      count: rows.length,
      medianClose: fmtDuration(median(rowsResolved.map((t) => minutesBetween(t.reported_at, t.resolved_at!)))),
    };
  });

  const byCategory = CATEGORIES.map((c) => ({
    label: c.label,
    count: data.filter((t) => t.category === c.value).length,
  }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const propertyCounts = new Map<string, number>();
  for (const t of data) {
    const name = t.properties?.nickname ?? t.properties?.name ?? "No home linked";
    propertyCounts.set(name, (propertyCounts.get(name) ?? 0) + 1);
  }
  const byProperty = [...propertyCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const maxCategory = Math.max(1, ...byCategory.map((c) => c.count));
  const maxProperty = Math.max(1, ...byProperty.map((c) => c.count));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Analytics &amp; KPIs</h1>
          <p className="mt-1 text-muted-foreground">
            How fast we respond, how well we close, and where the work keeps coming from.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={days === r.value ? "default" : "outline"}
              onClick={() => setDays(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By priority</CardTitle>
          <CardDescription>Volume and median time to close for each priority level.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {byPriority.map((p) => (
            <div key={p.key} className="rounded-lg border border-border p-3">
              <Badge variant="outline">{p.label}</Badge>
              <p className="mt-2 text-2xl font-semibold">{p.count}</p>
              <p className="text-xs text-muted-foreground">median close {p.medianClose}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top categories</CardTitle>
            <CardDescription>What the team spends its time on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged in this window yet.</p>
            ) : (
              byCategory.map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="text-muted-foreground">{c.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(c.count / maxCategory) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Homes with the most matters</CardTitle>
            <CardDescription>Repeat offenders worth a preventative visit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {byProperty.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged in this window yet.</p>
            ) : (
              byProperty.map((p) => (
                <div key={p.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{p.label}</span>
                    <span className="text-muted-foreground">{p.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${(p.count / maxProperty) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing matters reported in the last {days} days. {open.length} are still open right now.
      </p>
    </div>
  );
}
