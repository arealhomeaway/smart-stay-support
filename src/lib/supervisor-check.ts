/**
 * Supervisor check: pure grouping for the read-only 24-hour review page.
 * Display only. Never changes routing, deadlines or ticket state.
 *
 * Real work only (register N4, A7): an untouched Notion import (nobody has
 * taken or reopened it) is left out of every list, by the same isQuietNotion
 * rule the ticket page uses for "Imported from Notion. No clock.". Once taken
 * or reopened it is ordinary work and follows the normal rules below.
 * Imported history is found in Databases.
 */
import { withoutQuietNotion } from "@/lib/notion-ticket-display";

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
  external_status?: string | null;
  reported_at?: string | null;
  import_hold?: string | null;
};

export type ActivityKind = "created" | "closed" | "changed";

/**
 * When a ticket came in. A Notion import came in on its Notion created date,
 * never the moment it was copied into Resolve, so a taken import is never
 * shown as New just because it was imported today.
 */
export function cameInAt(t: CheckTicket): string {
  return t.external_source === "notion" && t.reported_at ? t.reported_at : t.created_at;
}

/** What happened to a ticket in the window. Closed beats created beats changed. */
export function activityKind(t: CheckTicket, since: number): ActivityKind | null {
  const closed = t.closed_at ? Date.parse(t.closed_at) : NaN;
  if (closed >= since) return "closed";
  if (Date.parse(cameInAt(t)) >= since) return "created";
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
  const work = withoutQuietNotion(tickets, now);
  const last24h = work
    .map((t) => ({ ticket: t, kind: activityKind(t, since) }))
    .filter((x): x is { ticket: CheckTicket; kind: ActivityKind } => x.kind !== null);
  return {
    last24h,
    overdue: work.filter((t) => isOverdue(t, now)),
    unassigned: work.filter((t) => isOpen(t) && !t.assigned_to && !t.import_hold),
  };
}
