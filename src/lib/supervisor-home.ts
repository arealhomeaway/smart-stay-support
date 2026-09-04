/**
 * What a supervisor or director must decide today.
 *
 * One authoritative derivation, shared by Home (the compact attention band)
 * and anything else that needs to say "how many things are waiting on a
 * supervisor". Oversight remains the full exception board; this is the short
 * list that belongs at the top of the working day, with every count drilling
 * into the surface that owns that work.
 *
 * Deliberately excludes volume, throughput and any per-person productivity
 * measure: performance lives in Analytics, never in the daily work hierarchy.
 */

import { OPEN_STATUSES, slaState } from "@/lib/tickets";
import { finalReviewRequirement } from "@/lib/final-review";

export type AttentionTicket = {
  id: string;
  ref: number | null;
  title: string;
  status: string;
  priority: string;
  category?: string | null;
  reported_at?: string | null;
  acknowledged_at?: string | null;
  action_started_at?: string | null;
  next_review_at?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
  assigned_to?: string | null;
  current_action_owner?: string | null;
  handoff_status?: string | null;
  escalated_at?: string | null;
  escalation_level?: string | null;
  reopen_count?: number | null;
  guest_in_residence?: boolean | null;
  guest_impact?: string | null;
  closure_qa_result?: string | null;
  properties?: { name?: string | null; nickname?: string | null } | null;
};

export type AttentionEscalation = {
  id: string;
  ticket_id: string | null;
  escalated_to_role: string;
  escalated_by: string;
  urgency: string;
  status: string;
  reason: string;
  outcome?: string | null;
  created_at: string;
  resolved_at?: string | null;
};

export type AttentionApproval = {
  id: string;
  title: string | null;
  status: string;
  approver_role?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

export type AttentionBucket = {
  key: string;
  title: string;
  hint: string;
  count: number;
  /** Where the count drills into. */
  to: string;
  search?: Record<string, string>;
  tone: "critical" | "warning" | "neutral";
};

const DAY = 24 * 60 * 60 * 1000;

function hoursOld(iso: string | null | undefined) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
}

/** Resolved work that still needs a supervisor decision before it can close. */
export function needsReviewBeforeClosing(tickets: AttentionTicket[]) {
  return tickets.filter(
    (t) =>
      t.status === "resolved" &&
      (!t.closure_qa_result || t.closure_qa_result === "not_reviewed") &&
      finalReviewRequirement({
        priority: t.priority,
        category: t.category ?? null,
        guest_in_residence: t.guest_in_residence ?? null,
        guest_impact: t.guest_impact ?? null,
        escalated: Boolean(t.escalated_at),
        escalation_level: t.escalation_level ?? null,
        reopen_count: t.reopen_count ?? null,
      }).required,
  );
}

export function supervisorAttention(input: {
  tickets: AttentionTicket[];
  escalations: AttentionEscalation[];
  approvals: AttentionApproval[];
  /** The seat being worked: a director also owns director-level escalations. */
  isDirector: boolean;
}): AttentionBucket[] {
  const { tickets, escalations, approvals, isDirector } = input;
  const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const now = Date.now();

  const toMe = escalations.filter(
    (e) => e.status === "open" && (isDirector ? true : e.escalated_to_role !== "director"),
  );
  const recentlyCleared = escalations.filter(
    (e) =>
      e.status !== "open" && e.resolved_at && now - new Date(e.resolved_at).getTime() < 3 * DAY,
  );
  const recentlyRaised = escalations.filter(
    (e) => now - new Date(e.created_at).getTime() < 3 * DAY,
  );

  const unassigned = open.filter((t) => !t.assigned_to && !t.current_action_owner);
  const blocked = open.filter(
    (t) =>
      t.handoff_status === "pending" ||
      (t.status === "waiting" && (!t.next_review_at || new Date(t.next_review_at).getTime() < now)),
  );
  const atRisk = open.filter(
    (t) =>
      slaState(t).breached ||
      (t.priority === "p1" && hoursOld(t.reported_at) > 24) ||
      (t.priority === "p2" && hoursOld(t.reported_at) > 72),
  );
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const review = needsReviewBeforeClosing(tickets);

  return [
    {
      key: "escalations",
      title: "Escalations to me",
      hint: "Someone asked for a decision and is waiting on you.",
      count: toMe.length,
      to: "/oversight",
      tone: "critical",
    },
    {
      key: "approvals",
      title: "Approval requests",
      hint: "Spend and owner decisions that cannot move until you answer.",
      count: pendingApprovals.length,
      to: "/oversight",
      tone: "critical",
    },
    {
      key: "review",
      title: "Needs review before closing",
      hint: "Finished work waiting on your decision to close.",
      count: review.length,
      to: "/oversight",
      tone: "warning",
    },
    {
      key: "unassigned",
      title: "Unassigned work",
      hint: "Nobody has picked these up yet.",
      count: unassigned.length,
      to: "/team-queue",
      search: { flags: "unassigned" },
      tone: "warning",
    },
    {
      key: "blocked",
      title: "Team blockers",
      hint: "Handoffs nobody accepted, and waiting work with no live follow-up.",
      count: blocked.length,
      to: "/team-queue",
      search: { flags: "blocked" },
      tone: "warning",
    },
    {
      key: "risk",
      title: "Overdue / high risk",
      hint: "Past a clock, or aging well beyond where this priority should land.",
      count: atRisk.length,
      to: "/team-queue",
      search: { flags: "overdue" },
      tone: "warning",
    },
    {
      key: "recent",
      title: "Recently escalated / cleared",
      hint: "Raised or resolved in the last three days.",
      count: recentlyRaised.length + recentlyCleared.length,
      to: "/oversight",
      tone: "neutral",
    },
  ];
}

/** The one-line summary above the band. */
export function attentionHeadline(buckets: AttentionBucket[]) {
  const decisions = buckets.filter((b) => b.tone !== "neutral").reduce((n, b) => n + b.count, 0);
  if (decisions === 0) return "Nothing needs your decision right now.";
  return `${decisions} ${decisions === 1 ? "thing needs" : "things need"} your decision.`;
}
