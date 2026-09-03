/**
 * Supervisor Operations Home — an exception board, not a stat dashboard.
 *
 * Everything above the fold is something a person has to intervene in. The
 * compact summaries beneath it are links into the queues that own that work.
 * Raw volume stays at the bottom as context: it is never a productivity score
 * for a coordinator.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import {
  OPEN_STATUSES,
  STATUSES,
  labelFor,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
  statusTone,
} from "@/lib/tickets";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { ReportingBaselineNote } from "@/components/ReportingBaselineNote";
import { OnCallNowCard } from "@/components/OnCallNowCard";
import { OvernightHandoffPanel } from "@/components/OvernightHandoffPanel";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";

export const Route = createFileRoute("/_authenticated/oversight")({
  head: () => ({
    meta: [
      { title: "Operations oversight — Resolve" },
      {
        name: "description",
        content:
          "The supervisor exception board: unacknowledged work, overdue actions, waiting past review, unassigned work, handoffs, approvals and workload by seat.",
      },
      { property: "og:title", content: "Operations oversight — Resolve" },
      { property: "og:description", content: "Exceptions first — what needs a supervisor right now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <Oversight />
    </SupervisorOnly>
  ),
});

type Row = {
  id: string;
  ref: number;
  title: string;
  status: string;
  priority: string;
  reported_at: string;
  properties?: { name: string; nickname: string | null; market?: string | null } | null;
};

const DAY = 24 * 60 * 60 * 1000;

function hoursOld(iso: string | null | undefined) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
}

function useOversightData() {
  const tickets = useQuery({
    queryKey: ["oversight"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname, market, city)")
        .eq("is_demo", false)
        .is("archived_at", null)
        .order("reported_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const support = useQuery({
    queryKey: ["oversight-support"],
    queryFn: async () => {
      const [approvals, routines, claims, recoveries, breezeway, profiles] = await Promise.all([
        supabase.from("approvals").select("id, title, kind, status, due_on, entity_type, entity_id").eq("status", "pending"),
        supabase
          .from("routine_controls")
          .select("id, kind, status, due_at, assigned_to, completed_at")
          .eq("is_demo", false),
        supabase.from("claims").select("id, title, stage, deadline_on").eq("is_demo", false),
        supabase.from("guest_recovery").select("id, title, stage, approval_status").eq("is_demo", false),
        supabase
          .from("breezeway_outbound_tasks")
          .select("id, title, status, scheduled_date, ticket_id"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      return {
        approvals: approvals.data ?? [],
        routines: routines.data ?? [],
        claims: claims.data ?? [],
        recoveries: recoveries.data ?? [],
        breezeway: breezeway.data ?? [],
        profiles: profiles.data ?? [],
      };
    },
  });

  return { tickets, support };
}

type OversightQueries = ReturnType<typeof useOversightData>;
type OversightTickets = NonNullable<OversightQueries["tickets"]["data"]>;
type OversightSupport = OversightQueries["support"]["data"];

/**
 * Loading and error live in the wrapper, never in the board.
 *
 * The board calls `useWorkspaceOrigin` near the bottom of its body. When the
 * early "still loading" return sat inside the same component, that hook ran on
 * the loaded render but not the loading one, and React threw a hook-count
 * mismatch the moment the query resolved — which is what crashed Oversight for
 * supervisors. Splitting the component keeps hook order identical every render.
 */
function Oversight() {
  const { tickets, support } = useOversightData();

  if (tickets.isError)
    return (
      <div className="rounded-xl border border-border p-6">
        <h1 className="text-lg font-semibold">Oversight could not load</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tickets.error instanceof Error
            ? tickets.error.message
            : "The exception board could not be read."}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => void tickets.refetch()}>
          Try again
        </Button>
      </div>
    );
  if (tickets.isLoading || !tickets.data) return <Skeleton className="h-96 w-full" />;

  return <OversightBoard data={tickets.data} s={support.data} />;
}

function OversightBoard({ data, s }: { data: OversightTickets; s: OversightSupport }) {


  const open = data.filter((t) => OPEN_STATUSES.includes(t.status));

  const unackedP1 = open.filter((t) => t.priority === "p1" && !t.acknowledged_at);
  const unacked = open.filter(
    (t) => t.priority !== "p1" && !t.acknowledged_at && slaState(t).response?.breached,
  );
  const notStarted = open.filter((t) => t.acknowledged_at && !t.action_started_at && slaState(t).action?.breached);
  const pendingHandoffs = open.filter((t) => t.handoff_status === "pending");
  const unassigned = open.filter((t) => !t.assigned_to && !t.current_action_owner);
  const waitingNoReview = open.filter((t) => t.status === "waiting" && !t.next_review_at);
  const reviewOverdue = open.filter(
    (t) => t.next_review_at && new Date(t.next_review_at).getTime() < Date.now(),
  );
  const agingP12 = open.filter(
    (t) =>
      (t.priority === "p1" && hoursOld(t.reported_at) > 24) ||
      (t.priority === "p2" && hoursOld(t.reported_at) > 72),
  );
  const reopened = data.filter((t) => (t.reopen_count ?? 0) > 0 && OPEN_STATUSES.includes(t.status));
  const closureQa = data.filter(
    (t) => t.status === "resolved" && t.closure_qa_result === "not_reviewed",
  );

  const sections = [
    {
      title: "P1 not acknowledged",
      description: "Escalation ladder is running. Someone must respond now.",
      rows: unackedP1,
      tone: "danger" as const,
    },
    {
      title: "Response overdue",
      description: "Acknowledge window passed without a reply.",
      rows: unacked,
      tone: "danger" as const,
    },
    {
      title: "Past SLA — acknowledged but not started",
      description: "Someone replied but no work has begun inside the target.",
      rows: notStarted,
      tone: "danger" as const,
    },
    {
      title: "Waiting past its review date",
      description: "The promised check-in never happened.",
      rows: reviewOverdue,
      tone: "warning" as const,
    },
    {
      title: "Waiting with no review date",
      description: "These will silently disappear. Give each one a date.",
      rows: waitingNoReview,
      tone: "warning" as const,
    },
    {
      title: "Nobody owns this",
      description: "Open work with no assignee and no action owner.",
      rows: unassigned,
      tone: "warning" as const,
    },
    {
      title: "Handoffs waiting to be accepted",
      description: "Ownership has not transferred — the original owner is still accountable.",
      rows: pendingHandoffs,
      tone: "warning" as const,
    },
    {
      title: "P1 / P2 aging",
      description: "Still open well past where this priority should have landed.",
      rows: agingP12,
      tone: "warning" as const,
    },
    {
      title: "Reopened tickets",
      description: "Closed too early, or the fix did not hold. Worth a look at the playbook.",
      rows: reopened,
      tone: "warning" as const,
    },
    {
      title: "Closure QA pending",
      description: "Resolved tickets that have not been quality-checked yet.",
      rows: closureQa,
      tone: "neutral" as const,
    },
  ];

  const totalExceptions = sections
    .filter((sec) => sec.tone !== "neutral")
    .reduce((n, sec) => n + sec.rows.length, 0);

  /* ---------------- compact linked summaries ---------------- */

  const now = Date.now();
  const openRoutines = (s?.routines ?? []).filter((r) => r.status !== "completed" && r.status !== "cancelled");
  const routinesLate = openRoutines.filter((r) => r.due_at && new Date(r.due_at).getTime() < now);
  const routinesDone7 = (s?.routines ?? []).filter(
    (r) => r.completed_at && now - new Date(r.completed_at).getTime() < 7 * DAY,
  );
  const claimsOpen = (s?.claims ?? []).filter((c) => c.stage !== "closed" && c.stage !== "resolved");
  const claimsDeadline = claimsOpen.filter(
    (c) => c.deadline_on && new Date(c.deadline_on).getTime() - now < 3 * DAY,
  );
  const recoveriesOpen = (s?.recoveries ?? []).filter((r) => r.stage !== "closed");
  const recoveriesAwaiting = recoveriesOpen.filter((r) => r.approval_status === "pending");
  const bzOpen = (s?.breezeway ?? []).filter((b) => b.status !== "abandoned");
  const bzPastCommitment = bzOpen.filter(
    (b) => b.scheduled_date && new Date(b.scheduled_date).getTime() < now - DAY,
  );
  const approvals = s?.approvals ?? [];

  const summaries = [
    {
      title: "Maintenance / Breezeway",
      to: "/tickets",
      lines: [
        `${bzOpen.length} repair request${bzOpen.length === 1 ? "" : "s"} sent`,
        `${bzPastCommitment.length} past the committed date`,
      ],
      count: bzPastCommitment.length,
    },
    {
      title: "Routine controls",
      to: "/routines",
      lines: [
        `${routinesLate.length} late · ${openRoutines.length} open`,
        `${routinesDone7.length} completed in the last 7 days`,
      ],
      count: routinesLate.length,
    },
    {
      title: "Approvals",
      to: "/oversight",
      lines: [`${approvals.length} awaiting a decision`],
      count: approvals.length,
    },
    {
      title: "Claims",
      to: "/claims",
      lines: [
        `${claimsOpen.length} open`,
        `${claimsDeadline.length} inside a platform deadline window`,
      ],
      count: claimsDeadline.length,
    },
    {
      title: "Guest Recovery",
      to: "/recovery",
      lines: [
        `${recoveriesOpen.length} open`,
        `${recoveriesAwaiting.length} waiting on approval`,
      ],
      count: recoveriesAwaiting.length,
    },
    {
      title: "Leads",
      to: "/leads",
      lines: ["Pipeline and follow-ups"],
      count: 0,
    },
  ];

  /* ---------------- workload and trends ---------------- */

  const nameFor = (id: string | null) =>
    (s?.profiles ?? []).find((p) => p.id === id)?.full_name ??
    (s?.profiles ?? []).find((p) => p.id === id)?.email ??
    "Unassigned";

  const workload = Object.entries(
    open.reduce<Record<string, number>>((acc, t) => {
      const key = t.current_action_owner ?? t.assigned_to ?? "unassigned";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([id, count]) => ({ id, who: id === "unassigned" ? "Unassigned" : nameFor(id), count }))
    .sort((a, b) => b.count - a.count);

  const trend = (pick: (t: (typeof open)[number]) => string) =>
    Object.entries(
      open.reduce<Record<string, number>>((acc, t) => {
        const key = pick(t) || "—";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

  const byProperty = trend((t) => t.properties?.nickname ?? t.properties?.name ?? "No property");
  const byMarket = trend((t) => t.properties?.market ?? t.properties?.city ?? "No market");
  const byType = trend((t) => t.category ?? "other");

  const closedThisWeek = data.filter(
    (t) => t.resolved_at && now - new Date(t.resolved_at).getTime() < 7 * DAY,
  ).length;

  // Supervisors work exceptions in sequence: remember the board, and the
  // order of the exceptions on it, so each ticket comes back to the same spot.
  const { originSearch } = useWorkspaceOrigin(
    "Oversight",
    sections.flatMap((section) =>
      section.rows.slice(0, 12).map((t) => ({
        id: t.id,
        label: t.title,
        sub: section.title,
      })),
    ),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Operations oversight</h1>
        <p className="mt-1 text-muted-foreground">
          {totalExceptions === 0
            ? "Nothing is slipping right now."
            : `${totalExceptions} thing${totalExceptions === 1 ? "" : "s"} need${totalExceptions === 1 ? "s" : ""} intervention.`}
        </p>
        <ReportingBaselineNote className="mt-3 max-w-2xl" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OnCallNowCard />
        <OvernightHandoffPanel />
      </div>

      {/* Exceptions first. A section with nothing in it collapses to one line. */}
      <div className="space-y-3">
        {sections.map((section) =>
          section.rows.length === 0 ? (
            <div
              key={section.title}
              className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground"
            >
              <span className="size-1.5 rounded-full bg-success" />
              {section.title} — clear
            </div>
          ) : (
            <Card key={section.title} className={section.tone === "danger" ? "border-danger/40" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {section.title}
                  <Badge
                    variant="outline"
                    className={
                      section.tone === "danger"
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : section.tone === "warning"
                          ? "border-warning/40 bg-warning/10"
                          : "border-border"
                    }
                  >
                    {section.rows.length}
                  </Badge>
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {section.rows.slice(0, 12).map((t) => (
                  <ExceptionRow key={t.id} ticket={t as Row} origin={originSearch} />
                ))}
                {section.rows.length > 12 && (
                  <p className="text-xs text-muted-foreground">
                    +{section.rows.length - 12} more
                  </p>
                )}
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Where the work sits</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((sum) => (
            <Link
              key={sum.title}
              to={sum.to}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary"
            >
              <p className="flex items-center gap-2 font-medium">
                {sum.title}
                {sum.count > 0 && (
                  <Badge variant="outline" className="border-warning/40 bg-warning/10">
                    {sum.count}
                  </Badge>
                )}
                <ChevronRight className="ml-auto size-4 text-muted-foreground" />
              </p>
              {sum.lines.map((l) => (
                <p key={l} className="text-sm text-muted-foreground">
                  {l}
                </p>
              ))}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Workload by person</CardTitle>
            <CardDescription>Open work only. This is balance, not output.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {workload.length === 0 && <p className="text-muted-foreground">Nothing open.</p>}
            {workload.map((w) => (
              <div key={w.id} className="flex items-center gap-3">
                <span className="w-40 truncate">{w.who}</span>
                <div className="h-2 flex-1 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (w.count / (workload[0]?.count || 1)) * 100)}%` }}
                  />
                </div>
                <span className="w-6 text-right text-muted-foreground">{w.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Where issues are coming from</CardTitle>
            <CardDescription>Open work by property, market and issue type.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <TrendList title="Property" rows={byProperty} />
            <TrendList title="Market" rows={byMarket} />
            <TrendList title="Issue type" rows={byType} />
          </CardContent>
        </Card>
      </section>

      <p className="text-sm text-muted-foreground">
        Context: {open.length} open · {closedThisWeek} closed in the last 7 days.
      </p>
    </div>
  );
}

function TrendList({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.length === 0 && <li className="text-muted-foreground">—</li>}
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between gap-2">
            <span className="truncate">{k}</span>
            <span className="text-muted-foreground">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExceptionRow({ ticket, origin }: { ticket: Row; origin: { from: string } }) {
  return (
    <Link
      to="/tickets/$ticketId"
      params={{ ticketId: ticket.id }}
      search={origin}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
    >
      <Badge variant="outline" className={priorityTone(ticket.priority)}>
        {priorityMeta(ticket.priority).short}
      </Badge>
      <span className="font-medium">{ticket.title}</span>
      <span className="text-sm text-muted-foreground">
        {ticket.properties?.nickname ?? ticket.properties?.name ?? "No property"}
      </span>
      <Badge variant="outline" className={statusTone(ticket.status)}>
        {labelFor(STATUSES, ticket.status)}
      </Badge>
      <span className="ml-auto text-sm text-muted-foreground">{relativeTime(ticket.reported_at)}</span>
    </Link>
  );
}
