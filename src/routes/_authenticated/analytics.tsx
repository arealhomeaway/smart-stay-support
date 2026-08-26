import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { CATEGORIES, OPEN_STATUSES, PRIORITIES, priorityMeta } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics & KPIs — Resolve Operations" },
      {
        name: "description",
        content:
          "Operational health for ARHA: guest-impacting SLA compliance, first-time-fix rate, recurring problems by home, and what the team is stuck waiting on.",
      },
      { property: "og:title", content: "Analytics & KPIs — Resolve Operations" },
      {
        property: "og:description",
        content:
          "Health score, root-cause views on repeat failures and reopens, backlog aging and where the work comes from.",
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
  { value: 180, label: "6 months" },
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
  promised_update_due_at: string | null;
  reopen_count: number | null;
  avoidable_reopen: boolean | null;
  closure_qa_result: string | null;
  escalation_level: string | null;
  supervisor_caught: boolean | null;
  late_reason: string | null;
  waiting_on: string | null;
  guest_impact: string | null;
  occupancy_status: string | null;
  final_communication_sent: boolean | null;
  external_source: string | null;
  source_channel: string | null;
  property_id: string | null;
  properties?: { name: string; nickname: string | null } | null;
};

const SELECT =
  "id, priority, status, category, reported_at, acknowledged_at, action_started_at, resolved_at, response_due_at, action_due_at, promised_update_due_at, reopen_count, avoidable_reopen, closure_qa_result, escalation_level, supervisor_caught, late_reason, waiting_on, guest_impact, occupancy_status, final_communication_sent, external_source, source_channel, property_id, properties(name, nickname)";

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

function rate(part: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((part / total) * 100);
}

function fmtPct(v: number | null) {
  return v === null ? "—" : `${v}%`;
}

function titleize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Guest-impacting = a real person is affected right now, not paperwork. */
function isGuestImpacting(t: Ticket) {
  return (
    t.guest_impact === "active_guest_affected" ||
    t.guest_impact === "safety_security" ||
    t.occupancy_status === "occupied" ||
    t.occupancy_status === "same_day_arrival"
  );
}

type Stats = ReturnType<typeof computeStats>;

function computeStats(rows: Ticket[]) {
  const total = rows.length;
  const resolved = rows.filter((t) => t.resolved_at);
  const open = rows.filter((t) => OPEN_STATUSES.includes(t.status));
  const guestImpacting = rows.filter(isGuestImpacting);

  const ackMinutes = rows.filter((t) => t.acknowledged_at).map((t) => minutesBetween(t.reported_at, t.acknowledged_at!));
  const closeMinutes = resolved.map((t) => minutesBetween(t.reported_at, t.resolved_at!));

  const respScope = rows.filter((t) => t.response_due_at && t.acknowledged_at);
  const respOnTime = respScope.filter((t) => new Date(t.acknowledged_at!) <= new Date(t.response_due_at!));
  const guestRespScope = respScope.filter(isGuestImpacting);
  const guestRespOnTime = guestRespScope.filter((t) => new Date(t.acknowledged_at!) <= new Date(t.response_due_at!));

  const actionScope = rows.filter((t) => t.action_due_at && t.action_started_at);
  const actionOnTime = actionScope.filter((t) => new Date(t.action_started_at!) <= new Date(t.action_due_at!));

  const reopened = rows.filter((t) => (t.reopen_count ?? 0) > 0);
  const avoidableReopens = reopened.filter((t) => t.avoidable_reopen);
  const firstTimeFix = resolved.length ? rate(resolved.length - reopened.filter((t) => t.resolved_at).length, resolved.length) : null;

  const qaReviewed = resolved.filter((t) => t.closure_qa_result && t.closure_qa_result !== "not_reviewed");
  const qaFailed = qaReviewed.filter((t) => t.closure_qa_result !== "pass");
  const qaPending = resolved.filter((t) => !t.closure_qa_result || t.closure_qa_result === "not_reviewed");

  const escalated = rows.filter((t) => t.escalation_level && t.escalation_level !== "none");
  const supervisorCaught = rows.filter((t) => t.supervisor_caught);
  const commsMissed = resolved.filter((t) => isGuestImpacting(t) && !t.final_communication_sent);

  const now = Date.now();
  const breachedOpen = open.filter(
    (t) =>
      (t.response_due_at && !t.acknowledged_at && new Date(t.response_due_at).getTime() < now) ||
      (t.action_due_at && !t.action_started_at && new Date(t.action_due_at).getTime() < now),
  );
  const promiseOverdue = open.filter(
    (t) => t.promised_update_due_at && new Date(t.promised_update_due_at).getTime() < now,
  );

  return {
    total,
    open,
    resolved,
    guestImpacting,
    medianAck: median(ackMinutes),
    medianClose: median(closeMinutes),
    responseSla: rate(respOnTime.length, respScope.length),
    responseScope: respScope.length,
    guestResponseSla: rate(guestRespOnTime.length, guestRespScope.length),
    guestResponseScope: guestRespScope.length,
    actionSla: rate(actionOnTime.length, actionScope.length),
    actionScope: actionScope.length,
    reopenRate: rate(reopened.length, total),
    reopened,
    avoidableReopenRate: rate(avoidableReopens.length, total),
    avoidableReopens,
    firstTimeFix,
    qaFailRate: rate(qaFailed.length, qaReviewed.length),
    qaReviewed: qaReviewed.length,
    qaPending: qaPending.length,
    escalationRate: rate(escalated.length, total),
    escalated,
    supervisorCaughtRate: rate(supervisorCaught.length, total),
    supervisorCaught,
    commsMissed,
    breachedOpen,
    promiseOverdue,
  };
}

/**
 * One number the leadership team can trend: are we protecting guests, closing
 * things properly the first time, and catching our own misses?
 */
function healthScore(s: Stats) {
  const parts: { label: string; value: number | null; weight: number; hint: string }[] = [
    {
      label: "Guest-impacting response",
      value: s.guestResponseSla ?? s.responseSla,
      weight: 0.35,
      hint: "Acknowledged inside the standard when a guest was affected",
    },
    {
      label: "First-time fix",
      value: s.firstTimeFix,
      weight: 0.3,
      hint: "Closed and stayed closed",
    },
    {
      label: "Closure quality",
      value: s.qaFailRate === null ? null : 100 - s.qaFailRate,
      weight: 0.2,
      hint: "Passed closure QA on review",
    },
    {
      label: "Backlog under control",
      value: s.open.length === 0 ? 100 : Math.max(0, 100 - Math.round((s.breachedOpen.length / s.open.length) * 100)),
      weight: 0.15,
      hint: "Open matters not currently past a clock",
    },
  ];
  const scored = parts.filter((p) => p.value !== null);
  const weight = scored.reduce((sum, p) => sum + p.weight, 0);
  const score = weight === 0 ? null : Math.round(scored.reduce((sum, p) => sum + (p.value as number) * p.weight, 0) / weight);
  return { score, parts };
}

function Delta({ current, previous, goodDirection }: { current: number | null; previous: number | null; goodDirection: "up" | "down" }) {
  if (current === null || previous === null) return null;
  const diff = Math.round(current - previous);
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" /> flat vs prior period
      </span>
    );
  }
  const good = goodDirection === "up" ? diff > 0 : diff < 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${good ? "text-primary" : "text-destructive"}`}>
      <Icon className="size-3" />
      {diff > 0 ? "+" : ""}
      {diff} vs prior period
    </span>
  );
}

function Bars({ rows, empty }: { rows: { label: string; count: number; sub?: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 text-muted-foreground">{r.sub ?? r.count}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Analytics() {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 2 * 864e5).toISOString();
      const { data, error } = await supabase
        .from("tickets")
        .select(SELECT)
        // Demo records are excluded from every KPI.
        .eq("is_demo", false)
        .gte("reported_at", since)
        .order("reported_at", { ascending: false })
        .limit(4000);
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const cutoff = Date.now() - days * 864e5;
  const rows = data.filter((t) => new Date(t.reported_at).getTime() >= cutoff);
  const prior = data.filter((t) => new Date(t.reported_at).getTime() < cutoff);

  const s = computeStats(rows);
  const p = computeStats(prior);
  const health = healthScore(s);
  const priorHealth = healthScore(p);

  const kpis: {
    label: string;
    value: string;
    hint: string;
    current: number | null;
    previous: number | null;
    goodDirection: "up" | "down";
  }[] = [
    {
      label: "Guest-impacting matters",
      value: String(s.guestImpacting.length),
      hint: `${s.total} matters logged · ${s.open.length} still open`,
      current: s.guestImpacting.length,
      previous: p.guestImpacting.length,
      goodDirection: "down",
    },
    {
      label: "Response SLA — guest impacting",
      value: fmtPct(s.guestResponseSla),
      hint: `${s.guestResponseScope} on the clock · all matters ${fmtPct(s.responseSla)}`,
      current: s.guestResponseSla,
      previous: p.guestResponseSla,
      goodDirection: "up",
    },
    {
      label: "First-time fix",
      value: fmtPct(s.firstTimeFix),
      hint: `${s.reopened.length} matters came back after closing`,
      current: s.firstTimeFix,
      previous: p.firstTimeFix,
      goodDirection: "up",
    },
    {
      label: "Avoidable reopens",
      value: fmtPct(s.avoidableReopenRate),
      hint: `${s.avoidableReopens.length} we could have prevented — the real quality signal`,
      current: s.avoidableReopenRate,
      previous: p.avoidableReopenRate,
      goodDirection: "down",
    },
    {
      label: "Median acknowledge",
      value: fmtDuration(s.medianAck),
      hint: "How long before someone owns it",
      current: s.medianAck,
      previous: p.medianAck,
      goodDirection: "down",
    },
    {
      label: "Median time to close",
      value: fmtDuration(s.medianClose),
      hint: `${s.resolved.length} matters closed in this window`,
      current: s.medianClose,
      previous: p.medianClose,
      goodDirection: "down",
    },
    {
      label: "Closure QA failures",
      value: fmtPct(s.qaFailRate),
      hint: `${s.qaReviewed} reviewed · ${s.qaPending} closed but never checked`,
      current: s.qaFailRate,
      previous: p.qaFailRate,
      goodDirection: "down",
    },
    {
      label: "Escalated to leadership",
      value: fmtPct(s.escalationRate),
      hint: `${s.escalated.length} escalations · ${s.supervisorCaught.length} caught by a supervisor first`,
      current: s.escalationRate,
      previous: p.escalationRate,
      goodDirection: "down",
    },
  ];

  // --- Root cause -----------------------------------------------------------
  const propertyKey = (t: Ticket) => t.properties?.nickname ?? t.properties?.name ?? "No home linked";

  const recurring = new Map<string, { home: string; category: string; count: number; reopens: number; p1: number }>();
  for (const t of rows) {
    if (!t.property_id) continue;
    const key = `${t.property_id}:${t.category}`;
    const entry = recurring.get(key) ?? {
      home: propertyKey(t),
      category: CATEGORIES.find((c) => c.value === t.category)?.label ?? titleize(t.category),
      count: 0,
      reopens: 0,
      p1: 0,
    };
    entry.count += 1;
    if ((t.reopen_count ?? 0) > 0) entry.reopens += 1;
    if (t.priority === "p1") entry.p1 += 1;
    recurring.set(key, entry);
  }
  const repeatFailures = [...recurring.values()]
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count || b.reopens - a.reopens)
    .slice(0, 6);

  const reopenByCategory = CATEGORIES.map((c) => {
    const inCat = rows.filter((t) => t.category === c.value);
    const re = inCat.filter((t) => (t.reopen_count ?? 0) > 0);
    return { label: c.label, count: re.length, total: inCat.length };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((c) => ({ label: c.label, count: c.count, sub: `${c.count} of ${c.total} came back` }));

  const countBy = (getter: (t: Ticket) => string | null | undefined, source: Ticket[] = rows) => {
    const map = new Map<string, number>();
    for (const t of source) {
      const v = getter(t);
      if (!v) continue;
      map.set(v, (map.get(v) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label: titleize(label), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  };

  const waitingOn = countBy((t) => t.waiting_on, s.open);
  const lateReasons = countBy((t) => t.late_reason);
  const sources = countBy((t) => t.external_source ?? t.source_channel);

  // --- Backlog aging --------------------------------------------------------
  const now = Date.now();
  const ageBuckets = [
    { label: "Under 24 hours", max: 1 },
    { label: "1–3 days", max: 3 },
    { label: "4–7 days", max: 7 },
    { label: "Over a week", max: Infinity },
  ].map((b, i, arr) => {
    const min = i === 0 ? 0 : (arr[i - 1] as { max: number }).max;
    const count = s.open.filter((t) => {
      const ageDays = (now - new Date(t.reported_at).getTime()) / 864e5;
      return ageDays >= min && ageDays < b.max;
    }).length;
    return { label: b.label, count };
  });

  const byPriority = PRIORITIES.map((pr) => {
    const inP = rows.filter((t) => t.priority === pr.value);
    const closed = inP.filter((t) => t.resolved_at);
    const scope = inP.filter((t) => t.response_due_at && t.acknowledged_at);
    const onTime = scope.filter((t) => new Date(t.acknowledged_at!) <= new Date(t.response_due_at!));
    return {
      key: pr.value,
      label: priorityMeta(pr.value).short,
      count: inP.length,
      openCount: inP.filter((t) => OPEN_STATUSES.includes(t.status)).length,
      sla: rate(onTime.length, scope.length),
      medianClose: fmtDuration(median(closed.map((t) => minutesBetween(t.reported_at, t.resolved_at!)))),
    };
  });

  const burden = new Map<string, { label: string; count: number; p1: number; reopens: number }>();
  for (const t of rows) {
    const label = propertyKey(t);
    const e = burden.get(label) ?? { label, count: 0, p1: 0, reopens: 0 };
    e.count += 1;
    if (t.priority === "p1") e.p1 += 1;
    if ((t.reopen_count ?? 0) > 0) e.reopens += 1;
    burden.set(label, e);
  }
  const byProperty = [...burden.values()]
    .sort((a, b) => b.p1 * 3 + b.reopens * 2 + b.count - (a.p1 * 3 + a.reopens * 2 + a.count))
    .slice(0, 8)
    .map((b) => ({
      label: b.label,
      count: b.count,
      sub: `${b.count} matters${b.p1 ? ` · ${b.p1} P1` : ""}${b.reopens ? ` · ${b.reopens} reopened` : ""}`,
    }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Analytics &amp; KPIs</h1>
          <p className="mt-1 text-muted-foreground">
            Whether guests were protected, whether work stayed fixed, and which homes and handoffs keep costing us.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operational health</CardTitle>
          <CardDescription>
            Weighted toward what actually hurts the business: guest-impacting response, work that stays fixed, closure
            quality and a backlog that isn't quietly aging.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <div className="rounded-xl border border-border p-4 text-center">
            <p className="text-5xl font-semibold">{health.score === null ? "—" : health.score}</p>
            <p className="mt-1 text-xs text-muted-foreground">out of 100</p>
            <div className="mt-2 flex justify-center">
              <Delta current={health.score} previous={priorHealth.score} goodDirection="up" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {health.parts.map((part) => (
              <div key={part.label} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{part.label}</span>
                  <span className="text-sm font-semibold">{fmtPct(part.value)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${part.value ?? 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{part.hint}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
              <div className="mt-1">
                <Delta current={k.current} previous={k.previous} goodDirection={k.goodDirection} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repeat failures — same home, same problem</CardTitle>
            <CardDescription>
              Two or more of the same category at one home in this window. This is where a permanent fix or a vendor
              conversation pays for itself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {repeatFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No home repeated the same problem in this window — that's a good sign.
              </p>
            ) : (
              repeatFailures.map((r) => (
                <div
                  key={`${r.home}-${r.category}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.home}</p>
                    <p className="text-xs text-muted-foreground">{r.category}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.p1 > 0 && <Badge variant="destructive">{r.p1} P1</Badge>}
                    {r.reopens > 0 && <Badge variant="outline">{r.reopens} reopened</Badge>}
                    <span className="text-lg font-semibold">{r.count}×</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What comes back after we close it</CardTitle>
            <CardDescription>
              Reopens by category — the fastest read on where our closure standard isn't holding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Bars rows={reopenByCategory} empty="Nothing reopened in this window." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What open work is stuck on</CardTitle>
            <CardDescription>
              Every open matter in a waiting state, grouped by who or what we're waiting for. Chronic entries here are
              process problems, not people problems.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Bars rows={waitingOn} empty="Nothing is parked in a waiting state right now." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Why we ran late</CardTitle>
            <CardDescription>Recorded late reasons on matters that missed a clock.</CardDescription>
          </CardHeader>
          <CardContent>
            <Bars rows={lateReasons} empty="No late reasons recorded in this window." />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention now</CardTitle>
            <CardDescription>Live exposure, not history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Open past a clock</span>
              <span className="font-semibold">{s.breachedOpen.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Promised guest update overdue</span>
              <span className="font-semibold">{s.promiseOverdue.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Closed without a final guest message</span>
              <span className="font-semibold">{s.commsMissed.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Closed but never QA'd</span>
              <span className="font-semibold">{s.qaPending}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backlog aging</CardTitle>
            <CardDescription>How long open matters have been sitting.</CardDescription>
          </CardHeader>
          <CardContent>
            <Bars rows={ageBuckets.filter((b) => b.count > 0)} empty="Nothing open right now." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where the work comes from</CardTitle>
            <CardDescription>Intake channel and synced systems.</CardDescription>
          </CardHeader>
          <CardContent>
            <Bars rows={sources} empty="No intake source recorded." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By priority</CardTitle>
          <CardDescription>Volume, response compliance and median time to close at each level.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {byPriority.map((pr) => (
            <div key={pr.key} className="rounded-lg border border-border p-3">
              <Badge variant="outline">{pr.label}</Badge>
              <p className="mt-2 text-2xl font-semibold">{pr.count}</p>
              <p className="text-xs text-muted-foreground">
                {pr.openCount} open · response SLA {fmtPct(pr.sla)} · median close {pr.medianClose}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homes costing us the most</CardTitle>
          <CardDescription>
            Ranked by weight, not raw count — a P1 and a reopen count for more than a routine request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Bars rows={byProperty} empty="Nothing logged in this window yet." />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Matters reported in the last {days} days, compared with the {days} days before that. {s.open.length} are still
        open right now.
      </p>
    </div>
  );
}
