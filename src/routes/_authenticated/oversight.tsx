import { formatPropertyLabel } from "@/lib/property-label";
/**
 * Supervisor Operations Home — an exception board, not a stat dashboard.
 *
 * Everything above the fold is something a person has to intervene in. The
 * compact summaries beneath it are links into the queues that own that work.
 * Raw volume stays at the bottom as context: it is never a productivity score
 * for a coordinator.
 */
import { guestIsWaiting, ticketLate } from "@/lib/ticket-deadline";
import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApprovalDetail } from "@/components/approvals/ApprovalDetail";
import { UnplacedOwnerReplies } from "@/components/approvals/UnplacedOwnerReplies";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status";
import { usDate } from "@/lib/dates";
import { TicketTable, TablePill, TwoLine, type TicketTableColumn, type TicketTableGroup } from "@/components/queue/TicketTable";
import { dueLabelAt, reportedShort, statusPillLabel } from "@/lib/ticket-table";
import { useHomeTeams } from "@/hooks/useHomeTeam";
import { workloadByPerson } from "@/lib/oversight";
import { supabase } from "@/integrations/supabase/client";
import { hiddenOnboarding } from "@/lib/team-b-view";
import { AllOpenTicketsTable } from "@/components/operations/AllOpenTicketsTable";
import { OverdueArrivalChecksCard } from "@/components/operations/OverdueArrivalChecksCard";
import { OversightSections, applyOversightFilter, filterLabel, type OversightFilter } from "@/components/operations/OversightSections";
import { withoutImportHeld } from "@/lib/import-hold";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import {
  OPEN_STATUSES,
  TEAMS,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
  statusTone,
} from "@/lib/tickets";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";
import { showExportCheckLink } from "@/lib/route-access";
import { finalReviewRequirement } from "@/lib/final-review";
import { ReportingBaselineNote } from "@/components/ReportingBaselineNote";
import { OnCallNowCard } from "@/components/OnCallNowCard";
import { OvernightHandoffPanel } from "@/components/OvernightHandoffPanel";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { useDemo } from "@/components/DemoProvider";
import { InsuranceRiskCard } from "@/components/work-entry/InsuranceRiskCard";
import { withoutQuietNotion } from "@/lib/notion-ticket-display";

export const Route = createFileRoute("/_authenticated/oversight")({
  head: () => ({
    meta: [
      { title: "Operations oversight: Resolve" },
      {
        name: "description",
        content:
          "The supervisor exception board: unacknowledged work, overdue actions, waiting past review, unassigned work, handoffs, approvals and workload by role.",
      },
      { property: "og:title", content: "Operations oversight: Resolve" },
      {
        property: "og:description",
        content: "Exceptions first: what needs a supervisor right now.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="oversight" title="Oversight">
      <Oversight />
    </RequireCapability>
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
        .select("*, properties(name, nickname, market, city, primary_photo_url, address_line1, unit, state, postal_code, ownerrez_property_id, lifecycle_status)")
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .order("reported_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Imported Notion tickets are not Oversight work until reopened in Resolve.
      // Homes still in Onboarding are not Operations work (change 2 of 5, item 7).
      return withoutQuietNotion(data ?? []).filter((t) => !hiddenOnboarding(t as never));
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
            // Operations escalations only: onboarding escalations carry no ticket.
            .not("ticket_id", "is", null)
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

  return (
    <>
      <OversightBoard data={tickets.data} s={support.data} />
    </>
  );
}

/** Emily, Nov 25: the older sections below All open tickets stay hidden. */
const SHOW_LEGACY_SECTIONS = false;

function OversightBoard({ data, s }: { data: OversightTickets; s: OversightSupport }) {
  const { access } = useRole();
  const open = data.filter((t) => OPEN_STATUSES.includes(t.status));

  const unackedP1 = open.filter((t) => t.priority === "p1" && !t.acknowledged_at);
  const unacked = open.filter(
    (t) => t.priority !== "p1" && !t.acknowledged_at && guestIsWaiting(t) && slaState(t).response?.breached,
  );
  const notStarted = open.filter(
    (t) => t.acknowledged_at && !t.action_started_at && guestIsWaiting(t) && slaState(t).action?.breached,
  );
  // One deadline (Nov 25): every other ticket is late only once past its due date.
  const pastDue = open.filter((t) => !guestIsWaiting(t) && ticketLate(t));
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
      title: "Acknowledged but not started",
      description: "Someone replied but no work has begun inside the target.",
      rows: notStarted,
      nextAction: "Start work",
      timingField: "reported_at",
    },
    {
      title: "Handoff not accepted",
      description: "Ownership has not transferred. The original owner is still accountable.",
      rows: pendingHandoffs,
      nextAction: "Accept the handoff",
      timingField: "reported_at",
    },
  ];

  const overdue: ExceptionSection[] = [
    {
      title: "Past its due date",
      description: "Open work past the date it should be done.",
      rows: pastDue,
      nextAction: "Finish or move the date",
      timingField: "reported_at",
    },
    {
      title: "Waiting past its review date",
      description: "The promised check-in never happened.",
      rows: reviewOverdue,
      nextAction: "Update the review",
      timingField: "next_review_at",
    },
    {
      title: "P1 and P2 aging",
      description: "Still open well past where this priority should have landed.",
      rows: agingP12,
      nextAction: "Push this forward",
      timingField: "reported_at",
    },
    {
      title: "Reopened",
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

  const liveOpen = withoutImportHeld(open);
  const [showAll, setShowAll] = useState(false);
  const [tableFilter, setTableFilter] = useState<OversightFilter | null>(null);

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
        const key = pick(t) || "Not set";
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

  /* ---------------- the one table (Emily, Nov 18): layout only ---------------- */

  const { homeTeamOf } = useHomeTeams();
  type OvRow = {
    key: string;
    ticketId: string | null;
    approvalId: string | null;
    priority: string | null;
    title: string;
    sub: string | null;
    property: (typeof data)[number]["properties"] | null;
    ownerId: string | null;
    status: { label: string; tone: string } | null;
    why: string;
    when: string | null;
    late: boolean;
    doNext: string;
  };
  const nowDate = new Date(now);
  const ticketRow = (t: (typeof data)[number], section: ExceptionSection): OvRow => {
    const review = section.timingField === "next_review_at" ? t.next_review_at : null;
    return {
      key: `${section.title}:${t.id}`,
      ticketId: t.id,
      approvalId: null,
      priority: t.priority,
      title: t.title,
      sub: `#${t.ref}`,
      property: t.properties,
      ownerId: t.current_action_owner ?? t.assigned_to ?? null,
      status: { label: statusPillLabel(t), tone: statusTone(t.status) },
      why: section.title,
      when: review ? dueLabelAt(review, nowDate) : `Reported ${reportedShort(t.reported_at, nowDate)}`,
      late: review ? new Date(review).getTime() < now : false,
      doNext: section.nextAction,
    };
  };
  const escalationRows: OvRow[] = (s?.escalations ?? []).map((e) => {
    const t = data.find((row) => row.id === e.ticket_id);
    return {
      key: `escalation:${e.id}`,
      ticketId: String(e.ticket_id),
      approvalId: null,
      priority: t?.priority ?? null,
      title: t?.title ?? (e.help_needed || e.reason || "Ticket"),
      sub: t ? `#${t.ref}` : null,
      property: t?.properties ?? null,
      ownerId: t ? (t.current_action_owner ?? t.assigned_to ?? null) : null,
      status: t ? { label: statusPillLabel(t), tone: statusTone(t.status) } : null,
      why: "Asked for a supervisor",
      when: [e.help_needed || e.reason, e.urgency !== "normal" ? e.urgency : null, `Raised ${relativeTime(e.created_at)}`].filter(Boolean).join(" · "),
      late: false,
      doNext: "Take the call",
    };
  });
  const today = new Date(now).toISOString().slice(0, 10);
  const approvalRows: OvRow[] = approvals.slice(0, 12).map((a) => {
    const kind = a.kind.replace(/_/g, " ");
    return {
      key: `approval:${a.id}`,
      ticketId: null,
      approvalId: a.id,
      priority: null,
      title: a.title,
      sub: null,
      property: null,
      ownerId: null,
      status: { label: "Awaiting a decision", tone: statusTone("waiting") },
      why: `${kind.charAt(0).toUpperCase()}${kind.slice(1)}${a.amount ? ` · $${Number(a.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}`,
      when: a.due_on ? `Due ${usDate(a.due_on)}` : null,
      late: Boolean(a.due_on && a.due_on < today),
      doNext: "Review",
    };
  });
  const sumRows = (list: ExceptionSection[]) => list.reduce((n, sec) => n + sec.rows.length, 0);
  const groupDefs = [
    { id: "group-decisions", label: "Decisions needed", hint: "Nobody can move these until someone decides.", sections: decisions, extra: [] as OvRow[], count: sumRows(decisions) },
    { id: "group-escalations", label: "Escalations", hint: "Someone needs a supervisor now.", sections: escalationSections, extra: escalationRows, count: sumRows(escalationSections) + (s?.escalations ?? []).length },
    { id: "group-blockers", label: "Blockers", hint: "Work has stalled between people.", sections: blockers, extra: [], count: sumRows(blockers) },
    { id: "group-overdue", label: "Overdue / high-risk", hint: "Past where it should be.", sections: overdue, extra: [], count: sumRows(overdue) },
    { id: "group-approvals", label: "Approvals", hint: "Waiting on your yes or no.", sections: [] as ExceptionSection[], extra: approvalRows, count: approvals.length },
    { id: "group-review", label: "Review before closing", hint: "Finished work that needs a look before it closes.", sections: reviewBeforeClosing, extra: [], count: sumRows(reviewBeforeClosing) },
  ];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const tableGroups: TicketTableGroup<OvRow>[] = groupDefs.map((g) => {
    const more = [
      ...g.sections.filter((sec) => sec.rows.length > 12).map((sec) => `+${sec.rows.length - 12} more in ${sec.title}`),
      ...(g.id === "group-approvals" && approvals.length > 12 ? [`+${approvals.length - 12} more`] : []),
    ];
    return {
      key: g.id,
      label: g.label,
      rows: [...g.extra, ...g.sections.flatMap((sec) => sec.rows.slice(0, 12).map((t) => ticketRow(t, sec)))],
      header: (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-semibold">{g.label}</span>
          <StatusBadge tone="escalated">{g.count}</StatusBadge>
          <span className="text-xs text-muted-foreground">{g.hint}</span>
        </span>
      ),
      empty: (
        <span className="flex items-center gap-3">
          <span className="size-1.5 rounded-full bg-success" />
          {g.label} · all clear
        </span>
      ),
      footer: more.length ? more.join(" · ") : undefined,
    };
  });
  const teamShort = (id: string) => TEAMS.find((t) => t.value === homeTeamOf(id))?.short ?? null;
  const columns: TicketTableColumn<OvRow>[] = [
    {
      key: "priority", header: "Priority", track: "96px",
      cell: (row) => row.priority ? <TablePill className={priorityTone(row.priority)}>{priorityMeta(row.priority).short}</TablePill> : null,
    },
    { key: "ticket", header: "Ticket", track: "minmax(200px,1.6fr)", cell: (row) => <TwoLine top={row.title} topClassName="font-bold" sub={row.sub ?? undefined} /> },
    {
      key: "property", header: "Property", track: "minmax(190px,1.4fr)",
      cell: (row) => row.property ? <TwoLine top={formatPropertyLabel(row.property).full} sub={row.property.market ?? undefined} /> : null,
    },
    {
      key: "owner", header: "Owner", track: "minmax(130px,1fr)",
      cell: (row) => {
        if (row.approvalId) return null;
        if (!row.ownerId) return <TablePill className="border-coral/30 bg-coral/12 text-coral">Unassigned</TablePill>;
        const p = (s?.profiles ?? []).find((pr) => pr.id === row.ownerId);
        return <TwoLine top={p?.full_name ?? p?.email ?? "Unassigned"} topClassName="font-bold" sub={teamShort(row.ownerId) ?? undefined} />;
      },
    },
    {
      key: "status", header: "Status", track: "minmax(150px,1fr)",
      cell: (row) => row.status ? <TablePill className={row.status.tone}>{row.status.label}</TablePill> : null,
    },
    {
      key: "why", header: "Why it is here", track: "minmax(200px,1.4fr)",
      cell: (row) => <TwoLine top={row.why} sub={row.when ?? undefined} subClassName={row.late ? "font-semibold text-coral" : ""} />,
    },
    {
      key: "next", header: "Do next", track: "178px",
      cell: (row) => (
        <span className="inline-flex min-h-11 max-w-full items-center truncate rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
          {row.doNext}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Operations oversight</h1>
        <ReportingBaselineNote className="mt-3 max-w-2xl" />
        <div className="mt-4">
          <OversightSections
            open={liveOpen as never}
            nameFor={nameFor}
            onSeeAll={(f) => {
              setTableFilter(f);
              setShowAll(true);
              setTimeout(() => document.getElementById("all-open-tickets")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
          />
        </div>
        {access.roles.includes("admin") || access.seats?.opsSupervisor || access.seats?.opsDirector || access.seats?.onboardingDirector ? (
          <div className="mt-4 max-w-xl"><OverdueArrivalChecksCard /></div>
        ) : null}
        <div id="all-open-tickets" className="mt-6 scroll-mt-4 space-y-3">
          {showAll ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {tableFilter ? <span className="text-sm font-medium">Showing: {filterLabel(tableFilter)}</span> : null}
                {tableFilter ? <Button variant="outline" className="min-h-11" onClick={() => setTableFilter(null)}>Show every open ticket</Button> : null}
                <Button variant="ghost" className="min-h-11" onClick={() => { setShowAll(false); setTableFilter(null); }}>Hide open tickets</Button>
              </div>
              <AllOpenTicketsTable key={tableFilter ? JSON.stringify(tableFilter) : "all"} tickets={applyOversightFilter(liveOpen as never, tableFilter) as never} />
            </>
          ) : (
            <Button variant="outline" className="min-h-11" onClick={() => setShowAll(true)}>Show all open tickets</Button>
          )}
        </div>
        {showExportCheckLink(access) ? (
          <Button asChild variant="outline" className="mt-3 min-h-11">
            <Link to="/export-check">Nightly export check</Link>
          </Button>
        ) : null}
      </div>

      {/* Older sections below All open tickets are hidden for everyone (Emily,
          Nov 25). The code stays; flip this back to true to bring them back. */}
      {SHOW_LEGACY_SECTIONS ? (
      <>
      <div className="grid gap-3 lg:grid-cols-2" data-testid="oversight-strip">
        <OnCallNowCard />
        <OvernightHandoffPanel compact />
      </div>

      <InsuranceRiskCard />

      {/* The six judgment groups: each chip opens its group in the table and folds the others. */}
      <nav aria-label="Exception summary" className="flex flex-wrap gap-2">
        {groupDefs.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={openGroups[g.id] !== false && Object.values(openGroups).some((v) => v === false)}
            onClick={() => {
              setOpenGroups(Object.fromEntries(groupDefs.map((d) => [d.id, d.id === g.id])));
              document.getElementById("oversight-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={
              "flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors " +
              (g.count > 0
                ? "border-coral/30 bg-coral/8 text-coral hover:bg-coral/14"
                : "border-border/60 text-muted-foreground hover:bg-secondary/60")
            }
          >
            {g.count > 0 ? <span className="size-1.5 rounded-full bg-coral" /> : null}
            {g.label}
            <span className="numeric font-semibold">{g.count}</span>
          </button>
        ))}
      </nav>

      <div id="oversight-table" className="scroll-mt-4">
        <TicketTable
          label="Work that needs a supervisor"
          testId="oversight-table"
          columns={columns}
          groups={tableGroups}
          rowKey={(row) => row.key}
          open={openGroups}
          onToggle={(key, next) => setOpenGroups((prev) => ({ ...prev, [key]: next }))}
          renderRow={(row, rowProps, children) =>
            row.approvalId ? (
              <button type="button" onClick={() => setOpenApproval(row.approvalId)} {...rowProps}>{children}</button>
            ) : (
              <Link to="/tickets/$ticketId" params={{ ticketId: row.ticketId ?? "" }} search={originSearch} {...rowProps}>{children}</Link>
            )
          }
        />
      </div>

      <UnplacedOwnerReplies onOpenApproval={(id) => setOpenApproval(id)} />

      <ApprovalDetail approvalId={openApproval} onClose={() => setOpenApproval(null)} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
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

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Where the work sits</h2>
          <div className="grid gap-3 sm:grid-cols-2">
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
      </div>

      <SectionCard
        title="Where issues are coming from"
        description="Open work by property, market and issue type."
        bodyClassName="grid gap-4 text-sm sm:grid-cols-3"
      >
        <TrendList title="Property" rows={byProperty} />
        <TrendList title="Market" rows={byMarket} />
        <TrendList title="Ticket type" rows={byType} />
      </SectionCard>

      <p className="text-sm text-muted-foreground">
        Context: {open.length} open · {closedThisWeek} closed in the last 7 days.
      </p>
      </>
      ) : null}
    </div>
  );
}

function TrendList({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.length === 0 && <li className="text-muted-foreground">-</li>}
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
