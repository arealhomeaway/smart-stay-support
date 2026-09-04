import { LoadingPage, PageHeader, SectionBand, StatTile } from "@/components/ui/page";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { CATEGORIES, OPEN_STATUSES, PRIORITIES, priorityMeta } from "@/lib/tickets";
import { ReportingBaselineNote } from "@/components/ReportingBaselineNote";

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
      hint: "Approved on review before closing",
    },
    {
      label: "Backlog under control",
      value: s.open.length === 0 ? 100 : Math.max(0, 100 - Math.round((s.breachedOpen.length / s.open.length) * 100)),
      weight: 0.15,
      hint: "Open tickets not currently past a clock",
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
        // Archived (prelaunch) tickets are excluded from every KPI.
        .is("archived_at", null)
        .gte("reported_at", since)
        .order("reported_at", { ascending: false })
        .limit(4000);

      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });

  if (isLoading || !data) return <LoadingPage />;

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
      label: "Guest-impacting tickets",
      value: String(s.guestImpacting.length),
      hint: `${s.total} tickets logged · ${s.open.length} still open`,
      current: s.guestImpacting.length,
      previous: p.guestImpacting.length,
      goodDirection: "down",
    },
    {
      label: "Response SLA — guest impacting",
      value: fmtPct(s.guestResponseSla),
      hint: `${s.guestResponseScope} on the clock · all tickets ${fmtPct(s.responseSla)}`,
      current: s.guestResponseSla,
      previous: p.guestResponseSla,
      goodDirection: "up",
    },
    {
      label: "First-time fix",
      value: fmtPct(s.firstTimeFix),
      hint: `${s.reopened.length} tickets came back after closing`,
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
      hint: `${s.resolved.length} tickets closed in this window`,
      current: s.medianClose,
      previous: p.medianClose,
      goodDirection: "down",
    },
    {
      label: "Sent back for changes",
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
      sub: `${b.count} tickets${b.p1 ? ` · ${b.p1} P1` : ""}${b.reopens ? ` · ${b.reopens} reopened` : ""}`,
    }));

  const primaryKpis = kpis.slice(0, 4);
  const moreKpis = kpis.slice(4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeader
            eyebrow="Insight"
            title="Analytics & KPIs"
            description="Whether guests were protected, whether work stayed fixed, and which homes and handoffs keep costing us."
          />
          <ReportingBaselineNote className="mt-3 max-w-2xl" />
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

      <section className="surface">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3.5">
          <div>
            <h2 className="text-[1.0625rem] font-semibold tracking-tight">Operational health</h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
              Weighted toward what actually hurts the business: guest-impacting response, work that stays
              fixed, closure quality and a backlog that isn't quietly aging.
            </p>
          </div>
          <Delta current={health.score} previous={priorHealth.score} goodDirection="up" />
        </header>
        <div className="grid gap-6 px-5 py-4 lg:grid-cols-[10rem_1fr]">
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-sunken py-4 text-center">
            <p className="numeric text-5xl font-semibold">{health.score === null ? "—" : health.score}</p>
            <p className="mt-1 text-xs text-muted-foreground">out of 100</p>
          </div>
          <div className="space-y-3">
            {health.parts.map((part) => (
              <div key={part.label}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{part.label}</span>
                  <span className="numeric text-sm font-semibold">{fmtPct(part.value)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-secondary">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${part.value ?? 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{part.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div>
        <SectionBand title="Headline signals" hint="The decisions leadership makes this window" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {primaryKpis.map((k) => (
            <StatTile
              key={k.label}
              label={k.label}
              value={k.value}
              tone={k.current == null ? "neutral" : k.goodDirection === "up" ? (k.current >= (k.previous ?? k.current) ? "positive" : "attention") : (k.current <= (k.previous ?? k.current) ? "positive" : "attention")}
              hint={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>{k.hint}</span>
                  <Delta current={k.current} previous={k.previous} goodDirection={k.goodDirection} />
                </span>
              }
            />
          ))}
        </div>
        <details className="group mt-3">
          <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-2 hover:underline">
            Show the rest of the KPIs
          </summary>
          <div className="surface mt-2 divide-y">
            {moreKpis.map((k) => (
              <div key={k.label} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{k.label}</p>
                  <p className="text-xs text-muted-foreground">{k.hint}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="numeric text-lg font-semibold">{k.value}</p>
                  <Delta current={k.current} previous={k.previous} goodDirection={k.goodDirection} />
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div>
        <SectionBand title="Root cause" hint="Where the same problem keeps coming back" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface p-4">
            <h3 className="text-[0.9375rem] font-semibold">Repeat failures — same home, same problem</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Two or more of the same category at one home in this window. This is where a permanent fix
              or a vendor conversation pays for itself.
            </p>
            <div className="mt-3 space-y-1.5">
              {repeatFailures.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No home repeated the same problem in this window — that's a good sign.
                </p>
              ) : (
                repeatFailures.map((r) => (
                  <div
                    key={`${r.home}-${r.category}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-sunken px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.home}</p>
                      <p className="text-xs text-muted-foreground">{r.category}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.p1 > 0 && <Badge variant="destructive">{r.p1} P1</Badge>}
                      {r.reopens > 0 && <Badge variant="outline">{r.reopens} reopened</Badge>}
                      <span className="numeric text-lg font-semibold">{r.count}×</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="surface p-4">
            <h3 className="text-[0.9375rem] font-semibold">What comes back after we close it</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Reopens by category — the fastest read on where our closure standard isn't holding.
            </p>
            <div className="mt-3">
              <Bars rows={reopenByCategory} empty="Nothing reopened in this window." />
            </div>
          </div>

          <div className="surface p-4">
            <h3 className="text-[0.9375rem] font-semibold">What open work is stuck on</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Every open ticket in a waiting state, grouped by who or what we're waiting for. Chronic
              entries here are process problems, not people problems.
            </p>
            <div className="mt-3">
              <Bars rows={waitingOn} empty="Nothing is parked in a waiting state right now." />
            </div>
          </div>

          <div className="surface p-4">
            <h3 className="text-[0.9375rem] font-semibold">Why we ran late</h3>
            <p className="mt-1 text-xs text-muted-foreground">Recorded late reasons on tickets that missed a clock.</p>
            <div className="mt-3">
              <Bars rows={lateReasons} empty="No late reasons recorded in this window." />
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionBand title="Right now" hint="Live exposure, not history" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Open past a clock" value={s.breachedOpen.length} tone={s.breachedOpen.length > 0 ? "critical" : "positive"} />
          <StatTile label="Promised update overdue" value={s.promiseOverdue.length} tone={s.promiseOverdue.length > 0 ? "attention" : "positive"} />
          <StatTile label="Closed without final message" value={s.commsMissed.length} tone={s.commsMissed.length > 0 ? "attention" : "positive"} />
          <StatTile label="Closed but never QA'd" value={s.qaPending} tone={s.qaPending > 0 ? "attention" : "positive"} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface p-4">
          <h3 className="text-[0.9375rem] font-semibold">Backlog aging</h3>
          <p className="mt-1 text-xs text-muted-foreground">How long open tickets have been sitting.</p>
          <div className="mt-3">
            <Bars rows={ageBuckets.filter((b) => b.count > 0)} empty="Nothing open right now." />
          </div>
        </div>

        <div className="surface p-4">
          <h3 className="text-[0.9375rem] font-semibold">Where the work comes from</h3>
          <p className="mt-1 text-xs text-muted-foreground">Intake channel and synced systems.</p>
          <div className="mt-3">
            <Bars rows={sources} empty="No intake source recorded." />
          </div>
        </div>
      </div>

      <div>
        <SectionBand title="By priority" hint="Volume, response compliance and median time to close" />
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5">Priority</th>
                <th className="px-5 py-2.5 text-right">Tickets</th>
                <th className="px-5 py-2.5 text-right">Open</th>
                <th className="px-5 py-2.5 text-right">Response SLA</th>
                <th className="px-5 py-2.5 text-right">Median close</th>
              </tr>
            </thead>
            <tbody>
              {byPriority.map((pr) => (
                <tr key={pr.key} className="border-b last:border-0">
                  <td className="px-5 py-2.5"><Badge variant="outline">{pr.label}</Badge></td>
                  <td className="numeric px-5 py-2.5 text-right">{pr.count}</td>
                  <td className="numeric px-5 py-2.5 text-right">{pr.openCount}</td>
                  <td className="numeric px-5 py-2.5 text-right">{fmtPct(pr.sla)}</td>
                  <td className="numeric px-5 py-2.5 text-right">{pr.medianClose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <SectionBand title="Homes costing us the most" hint="Ranked by weight, not raw count — a P1 and a reopen count for more than a routine request" />
        <div className="surface p-4">
          <Bars rows={byProperty} empty="Nothing logged in this window yet." />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Tickets reported in the last {days} days, compared with the {days} days before that. {s.open.length} are still
        open right now.
      </p>
    </div>
  );
}
