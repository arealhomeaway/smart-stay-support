import { formatPropertyLabel } from "@/lib/property-label";
/**
 * Supervisor Operations Home — an exception board, not a stat dashboard.
 *
 * Everything above the fold is something a person has to intervene in. The
 * compact summaries beneath it are links into the queues that own that work.
 * Raw volume stays at the bottom as context: it is never a productivity score
 * for a coordinator.
 */
import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApprovalDetail } from "@/components/approvals/ApprovalDetail";
import { UnplacedOwnerReplies } from "@/components/approvals/UnplacedOwnerReplies";
import { ChevronRight } from "lucide-react";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { StatusBadge, ticketTone } from "@/components/ui/status";
import { usDate, usDateTime } from "@/lib/dates";
import { workloadByPerson } from "@/lib/oversight";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/page";
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
import { finalReviewRequirement } from "@/lib/final-review";
import { ReportingBaselineNote } from "@/components/ReportingBaselineNote";
import { OnCallNowCard } from "@/components/OnCallNowCard";
import { OvernightHandoffPanel } from "@/components/OvernightHandoffPanel";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { useDemo } from "@/components/DemoProvider";
import { InsuranceRiskCard } from "@/components/work-entry/InsuranceRiskCard";

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
      {
        property: "og:description",
        content: "Exceptions first — what needs a supervisor right now.",
      },
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
  next_review_at?: string | null;
  assigned_to?: string | null;
  current_action_owner?: string | null;
  properties?: {
    name: string;
    nickname: string | null;
    market?: string | null;
    primary_photo_url?: string | null;
  } | null;
};

const DAY = 24 * 60 * 60 * 1000;

function hoursOld(iso: string | null | undefined) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
}

function useOversightData() {
  // Oversight answers the same question in both worlds: while the demo lens is
  // on, the supervisor sees the demo scenarios; otherwise, live work only.
  const { demoMode } = useDemo();
  const tickets = useQuery({
    queryKey: ["oversight", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname, market, city, primary_photo_url, address_line1, unit, state, postal_code, ownerrez_property_id)")
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .order("reported_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const support = useQuery({
    queryKey: ["oversight-support", demoMode],
    queryFn: async () => {
      const [approvals, routines, claims, recoveries, breezeway, profiles, escalations] =
        await Promise.all([
          supabase
            .from("approvals")
            .select(
              "id, title, kind, status, due_on, entity_type, entity_id, amount, currency, property_id, approver_role",
            )
            .eq("status", "pending")
            .eq("is_demo", demoMode),
          supabase
            .from("routine_controls")
            .select("id, kind, status, due_at, assigned_to, completed_at")
            .eq("is_demo", demoMode),
          supabase.from("claims").select("id, title, stage, deadline_on").eq("is_demo", demoMode),
          supabase
            .from("guest_recovery")
            .select("id, title, stage, approval_status")
            .eq("is_demo", demoMode),
          supabase
            .from("breezeway_outbound_tasks")
            .select("id, title, status, scheduled_date, ticket_id"),
          supabase.from("profiles").select("id, full_name, email"),
          supabase
            .from("escalations")
            .select("id, ticket_id, reason, help_needed, urgency, status, created_at, escalated_by")
            .eq("status", "open")
            .eq("is_demo", demoMode),
        ]);
      return {
        approvals: approvals.data ?? [],
        routines: routines.data ?? [],
        claims: claims.data ?? [],
        recoveries: recoveries.data ?? [],
        breezeway: breezeway.data ?? [],
        profiles: profiles.data ?? [],
        escalations: escalations.data ?? [],
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
  const notStarted = open.filter(
    (t) => t.acknowledged_at && !t.action_started_at && slaState(t).action?.breached,
  );
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
  const reopened = data.filter(
    (t) => (t.reopen_count ?? 0) > 0 && OPEN_STATUSES.includes(t.status),
  );
  // Selective review: only elevated-risk work waits on a supervisor, so this
  // list is the queue that actually needs a decision.
  const finalReview = data.filter(
    (t) =>
      t.status === "resolved" &&
      (!t.closure_qa_result || t.closure_qa_result === "not_reviewed") &&
      finalReviewRequirement({
        priority: t.priority,
        category: t.category,
        guest_in_residence: (t as { guest_in_residence?: boolean }).guest_in_residence ?? null,
        guest_impact: t.guest_impact,
        escalated: Boolean((t as { escalated_at?: string }).escalated_at),
        escalation_level: t.escalation_level,
        reopen_count: t.reopen_count,
      }).required,
  );

  // Every list below feeds one of six judgment groups. The grouping is what a
  // supervisor is being asked to do about it, not the database table it came
  // from — that is what turns ~25 stacked cards into a handful of decisions.
  type ExceptionSection = {
    title: string;
    description: string;
    rows: typeof unackedP1;
    nextAction: string;
    timingField: "reported_at" | "next_review_at";
  };

  const decisions: ExceptionSection[] = [
    {
      title: "Waiting with no review date",
      description: "These will silently disappear. Give each one a date.",
      rows: waitingNoReview,
      nextAction: "Set a review date",
      timingField: "reported_at",
    },
    {
      title: "Nobody owns this",
      description: "Open work with no assignee and no action owner.",
      rows: unassigned,
      nextAction: "Assign an owner",
      timingField: "reported_at",
    },
  ];

  const escalationSections: ExceptionSection[] = [
    {
      title: "P1 not acknowledged",
      description: "Escalation ladder is running. Someone must respond now.",
      rows: unackedP1,
      nextAction: "Acknowledge now",
      timingField: "reported_at",
    },
    {
      title: "Response overdue",
      description: "Acknowledge window passed without a reply.",
      rows: unacked,
      nextAction: "Reply now",
      timingField: "reported_at",
    },
  ];

  const blockers: ExceptionSection[] = [
    {
      title: "Past SLA — acknowledged but not started",
      description: "Someone replied but no work has begun inside the target.",
      rows: notStarted,
      nextAction: "Start work",
      timingField: "reported_at",
    },
    {
      title: "Handoffs waiting to be accepted",
      description: "Ownership has not transferred — the original owner is still accountable.",
      rows: pendingHandoffs,
      nextAction: "Accept the handoff",
      timingField: "reported_at",
    },
  ];

  const overdue: ExceptionSection[] = [
    {
      title: "Waiting past its review date",
      description: "The promised check-in never happened.",
      rows: reviewOverdue,
      nextAction: "Update the review",
      timingField: "next_review_at",
    },
    {
      title: "P1 / P2 aging",
      description: "Still open well past where this priority should have landed.",
      rows: agingP12,
      nextAction: "Push this forward",
      timingField: "reported_at",
    },
    {
      title: "Reopened tickets",
      description: "Closed too early, or the fix did not hold. Worth a look at the playbook.",
      rows: reopened,
      nextAction: "Check the playbook",
      timingField: "reported_at",
    },
  ];

  const reviewBeforeClosing: ExceptionSection[] = [
    {
      title: "Needs review before closing",
      description:
        "Finished work that needs a supervisor's decision before it can close. Routine work closes without you.",
      rows: finalReview as typeof unackedP1,
      nextAction: "Review and decide",
      timingField: "reported_at",
    },
  ];

  const sections = [
    ...decisions,
    ...escalationSections,
    ...blockers,
    ...overdue,
    ...reviewBeforeClosing,
  ];

  const totalExceptions = sections.reduce((n, sec) => n + sec.rows.length, 0);

  /* ---------------- compact linked summaries ---------------- */

  const now = Date.now();
  const openRoutines = (s?.routines ?? []).filter(
    (r) => r.status !== "completed" && r.status !== "cancelled",
  );
  const routinesLate = openRoutines.filter((r) => r.due_at && new Date(r.due_at).getTime() < now);
  const routinesDone7 = (s?.routines ?? []).filter(
    (r) => r.completed_at && now - new Date(r.completed_at).getTime() < 7 * DAY,
  );
  const claimsOpen = (s?.claims ?? []).filter(
    (c) => c.stage !== "closed" && c.stage !== "resolved",
  );
  const claimsDeadline = claimsOpen.filter(
    (c) => c.deadline_on && new Date(c.deadline_on).getTime() - now < 3 * DAY,
  );
  const recoveriesOpen = (s?.recoveries ?? []).filter((r) => r.stage !== "closed");
  const recoveriesAwaiting = recoveriesOpen.filter((r) => r.approval_status === "pending");
  // breezeway_outbound_tasks has no demo flag of its own, so scope it through
  // the tickets already loaded for this environment.
  const ticketIds = new Set(data.map((t) => t.id));
  const bzOpen = (s?.breezeway ?? []).filter(
    (b) => b.status !== "abandoned" && (!b.ticket_id || ticketIds.has(b.ticket_id)),
  );
  const bzPastCommitment = bzOpen.filter(
    (b) => b.scheduled_date && new Date(b.scheduled_date).getTime() < now - DAY,
  );
  const approvals = s?.approvals ?? [];
  const [openApproval, setOpenApproval] = useState<string | null>(null);

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
      title: "Guest refunds & credits",
      to: "/recovery",
      lines: [`${recoveriesOpen.length} open`, `${recoveriesAwaiting.length} waiting on approval`],
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

  const workload = workloadByPerson(open, nameFor);

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

  const byProperty = trend((t) => formatPropertyLabel(t.properties).primary);
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

      <InsuranceRiskCard />

      {/* Compact exception strip: what needs judgment, at a glance. Each chip
          jumps straight to its section below. */}
      <nav aria-label="Exception summary" className="flex flex-wrap gap-2">
        {[
          {
            id: "group-decisions",
            label: "Owner approvals",
            count: decisions.reduce((n, sec) => n + sec.rows.length, 0),
          },
          {
            id: "group-escalations",
            label: "Escalations",
            count:
              escalationSections.reduce((n, sec) => n + sec.rows.length, 0) +
              (s?.escalations ?? []).length,
          },
          {
            id: "group-blockers",
            label: "Blockers",
            count: blockers.reduce((n, sec) => n + sec.rows.length, 0),
          },
          {
            id: "group-overdue",
            label: "Overdue / high-risk",
            count: overdue.reduce((n, sec) => n + sec.rows.length, 0),
          },
          { id: "group-approvals", label: "Approvals", count: approvals.length },
          {
            id: "group-review",
            label: "Review before closing",
            count: reviewBeforeClosing.reduce((n, sec) => n + sec.rows.length, 0),
          },
        ].map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            className={
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors " +
              (g.count > 0
                ? "border-coral/30 bg-coral/8 text-coral hover:bg-coral/14"
                : "border-border/60 text-muted-foreground hover:bg-secondary/60")
            }
          >
            {g.count > 0 ? <span className="size-1.5 rounded-full bg-coral" /> : null}
            {g.label}
            <span className="numeric font-semibold">{g.count}</span>
          </a>
        ))}
      </nav>

      {/* Judgment groups: only groups with something in them get full presence.
          An empty group collapses to one quiet line — this is where a coordinator
          spends their attention, not a stat wall. */}
      <div className="space-y-3">
        <GroupSection
          id="group-decisions"
          title="Owner approvals"
          count={decisions.reduce((n, sec) => n + sec.rows.length, 0)}
        >
          {decisions.map((section) => (
            <SubList
              key={section.title}
              section={section}
              origin={originSearch}
              profiles={s?.profiles ?? []}
            />
          ))}
        </GroupSection>

        <GroupSection
          id="group-escalations"
          title="Escalations"
          count={
            escalationSections.reduce((n, sec) => n + sec.rows.length, 0) +
            (s?.escalations ?? []).length
          }
        >
          {(s?.escalations ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                A request for a call, not a handoff — the raiser still owns the work until you take
                it.
              </p>
              {(s?.escalations ?? []).map((e) => (
                <Link
                  key={e.id}
                  to="/tickets/$ticketId"
                  params={{ ticketId: String(e.ticket_id) }}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-secondary"
                >
                  <span>
                    <span className="font-medium">{e.help_needed || e.reason}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Raised {relativeTime(e.created_at)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {e.urgency !== "normal" && (
                      <StatusBadge tone="escalated">{e.urgency}</StatusBadge>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </span>
                </Link>
              ))}
            </div>
          )}
          {escalationSections.map((section) => (
            <SubList
              key={section.title}
              section={section}
              origin={originSearch}
              profiles={s?.profiles ?? []}
            />
          ))}
        </GroupSection>

        <GroupSection
          id="group-blockers"
          title="Blockers"
          count={blockers.reduce((n, sec) => n + sec.rows.length, 0)}
        >
          {blockers.map((section) => (
            <SubList
              key={section.title}
              section={section}
              origin={originSearch}
              profiles={s?.profiles ?? []}
            />
          ))}
        </GroupSection>

        <GroupSection
          id="group-overdue"
          title="Overdue / high-risk"
          count={overdue.reduce((n, sec) => n + sec.rows.length, 0)}
        >
          {overdue.map((section) => (
            <SubList
              key={section.title}
              section={section}
              origin={originSearch}
              profiles={s?.profiles ?? []}
            />
          ))}
        </GroupSection>

        <GroupSection id="group-approvals" title="Approvals" count={approvals.length}>
          {approvals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Open one to see the home, the ticket it came from, the amount and who it sits with.
              </p>
              {approvals.slice(0, 12).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setOpenApproval(a.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.kind.replace(/_/g, " ")}
                      {a.amount
                        ? ` · $${Number(a.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : ""}
                      {a.due_on ? ` · due ${usDate(a.due_on)}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {approvals.length > 12 && (
                <p className="text-xs text-muted-foreground">+{approvals.length - 12} more</p>
              )}
            </div>
          )}
        </GroupSection>

        <GroupSection
          id="group-review"
          title="Review before closing"
          count={reviewBeforeClosing.reduce((n, sec) => n + sec.rows.length, 0)}
        >
          {reviewBeforeClosing.map((section) => (
            <SubList
              key={section.title}
              section={section}
              origin={originSearch}
              profiles={s?.profiles ?? []}
            />
          ))}
        </GroupSection>
      </div>

      <UnplacedOwnerReplies onOpenApproval={(id) => setOpenApproval(id)} />

      <ApprovalDetail approvalId={openApproval} onClose={() => setOpenApproval(null)} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Where the work sits</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((sum) => (
            <Link
              key={sum.title}
              to={sum.to}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary"
            >
              <div className="flex items-center gap-2 font-medium">
                {sum.title}
                {sum.count > 0 && (
                  <Badge variant="outline" className="border-warning/40 bg-warning/10">
                    {sum.count}
                  </Badge>
                )}
                <ChevronRight className="ml-auto size-4 text-muted-foreground" />
              </div>
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
        <SectionCard
          title="Workload by person"
          description="Open work only. This is balance, not output."
          bodyClassName="space-y-1.5 text-sm"
        >
          {workload.length === 0 && <p className="text-muted-foreground">Nothing open.</p>}
          {workload.map((w) => (
            <Link
              key={w.id}
              to="/team-queue"
              search={{ assignee: w.id }}
              className="-mx-1 flex items-center gap-3 rounded-md px-1 transition-colors hover:bg-secondary"
            >
              <span className="w-40 truncate">{w.who}</span>
              <div className="h-2 flex-1 rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, (w.count / (workload[0]?.count || 1)) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-6 text-right text-muted-foreground">{w.count}</span>
            </Link>
          ))}
        </SectionCard>

        <SectionCard
          title="Where issues are coming from"
          description="Open work by property, market and issue type."
          bodyClassName="grid gap-4 text-sm sm:grid-cols-3"
        >
          <TrendList title="Property" rows={byProperty} />
          <TrendList title="Market" rows={byMarket} />
          <TrendList title="Issue type" rows={byType} />
        </SectionCard>
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

type Profile = { id: string; full_name: string | null; email: string | null };

function ownerName(ticket: Row, profiles: Profile[]) {
  const id = ticket.current_action_owner ?? ticket.assigned_to;
  if (!id) return "Nobody yet";
  const p = profiles.find((pr) => pr.id === id);
  return p?.full_name ?? p?.email ?? "Nobody yet";
}

/**
 * One row a supervisor can act on: the property, what's wrong, its state, who
 * owns it, what to do next and when. Every group renders the same shape so
 * scanning across judgment areas costs no extra attention.
 */
function ExceptionRow({
  ticket,
  origin,
  nextAction,
  timingField,
  profiles,
}: {
  ticket: Row;
  origin: { from: string };
  nextAction: string;
  timingField: "reported_at" | "next_review_at";
  profiles: Profile[];
}) {
  const when = timingField === "next_review_at" ? ticket.next_review_at : ticket.reported_at;
  return (
    <Link
      to="/tickets/$ticketId"
      params={{ ticketId: ticket.id }}
      search={origin}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
    >
      <PropertyPhoto
        url={ticket.properties?.primary_photo_url}
        name={formatPropertyLabel(ticket.properties).primary}
      />
      <span className="min-w-0">
        <span className="block truncate font-medium">{ticket.title}</span>
        <span className="text-xs text-muted-foreground">
          {formatPropertyLabel(ticket.properties).primary} ·{" "}
          {priorityMeta(ticket.priority).short}
        </span>
      </span>
      <StatusBadge tone={ticketTone(ticket.status)}>
        {labelFor(STATUSES, ticket.status)}
      </StatusBadge>
      <span className="text-sm text-muted-foreground">{ownerName(ticket, profiles)}</span>
      <span className="ml-auto flex flex-col items-end text-right text-sm">
        <span className="font-medium text-foreground">{nextAction}</span>
        <span className="text-xs text-muted-foreground">{usDateTime(when)}</span>
      </span>
    </Link>
  );
}

/** One exception list, rendered under its parent judgment group. */
function SubList({
  section,
  origin,
  profiles,
}: {
  section: {
    title: string;
    description: string;
    rows: Row[];
    nextAction: string;
    timingField: "reported_at" | "next_review_at";
  };
  origin: { from: string };
  profiles: Profile[];
}) {
  if (section.rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {section.title}
        <span className="ml-1.5 text-muted-foreground">({section.rows.length})</span>
      </p>
      <p className="text-xs text-muted-foreground">{section.description}</p>
      {section.rows.slice(0, 12).map((t) => (
        <ExceptionRow
          key={t.id}
          ticket={t as Row}
          origin={origin}
          nextAction={section.nextAction}
          timingField={section.timingField}
          profiles={profiles}
        />
      ))}
      {section.rows.length > 12 && (
        <p className="text-xs text-muted-foreground">+{section.rows.length - 12} more</p>
      )}
    </div>
  );
}

/**
 * A judgment group: a quiet "all clear" line when it is empty, a collapsible
 * section with full presence when it isn't. Progressive disclosure is the
 * whole point — a coordinator should never scroll past ten empty cards to
 * find the one that matters.
 */
function GroupSection({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) {
    return (
      <div
        id={id}
        className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground"
      >
        <span className="size-1.5 rounded-full bg-success" />
        {title} — all clear
      </div>
    );
  }
  return (
    <details id={id} open className="surface px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <StatusBadge tone="escalated">{count}</StatusBadge>
      </summary>
      <div className="mt-3 space-y-4 border-t border-border pt-3">{children}</div>
    </details>
  );
}
