/**
 * Supervisor check: pure grouping for the read-only 24-hour review page.
 * Display only. Never changes routing, deadlines or ticket state.
 */
export const CLOSED_STATUSES = ["resolved", "closed", "cancelled"] as const;

export type CheckTicket = {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  closed_at?: string | null;
  assigned_to: string | null;
  next_action_due_at?: string | null;
  external_source?: string | null;
  import_hold?: string | null;
};

export type ActivityKind = "created" | "closed" | "changed";

/** What happened to a ticket in the window. Closed beats created beats changed. */
export function activityKind(t: CheckTicket, since: number): ActivityKind | null {
  const closed = t.closed_at ? Date.parse(t.closed_at) : NaN;
  if (closed >= since) return "closed";
  if (Date.parse(t.created_at) >= since) return "created";
  if (t.updated_at && Date.parse(t.updated_at) >= since) return "changed";
  return null;
}

export function isOpen(t: Pick<CheckTicket, "status">) {
  return !(CLOSED_STATUSES as readonly string[]).includes(t.status);
}

export function isOverdue(t: CheckTicket, now: number) {
  return isOpen(t) && !!t.next_action_due_at && Date.parse(t.next_action_due_at) < now;
}

export function groupSupervisorCheck(tickets: CheckTicket[], now: number) {
  const since = now - 24 * 60 * 60 * 1000;
  const last24h = tickets
    .map((t) => ({ ticket: t, kind: activityKind(t, since) }))
    .filter((x): x is { ticket: CheckTicket; kind: ActivityKind } => x.kind !== null);
  return {
    last24h,
    imported: tickets.filter((t) => t.external_source === "notion" && !t.import_hold),
    backlogReview: tickets.filter((t) => t.import_hold === "backlog_review"),
    needsHome: tickets.filter((t) => t.import_hold === "needs_home"),
    overdue: tickets.filter((t) => isOverdue(t, now)),
    unassigned: tickets.filter((t) => isOpen(t) && !t.assigned_to && !t.import_hold),
  };
}
