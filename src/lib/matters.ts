/**
 * Operations queue helpers (browser-safe).
 *
 * Ownership language follows the Property Coordinator SOP:
 *   record_owner         — accountable for the matter end to end
 *   current_action_owner — whoever must act next
 *   assigned_to          — the working assignee
 *
 * These helpers only mirror what the database enforces. The real rule lives in
 * the tickets RLS policy (private.can_edit_ticket).
 */

import { OPEN_STATUSES, isClosed, slaState } from "@/lib/tickets";

export type MatterOwnership = {
  record_owner?: string | null;
  accountable_owner?: string | null;
  current_action_owner?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  pending_handoff_to?: string | null;
};

/** The single person a coordinator should read as "whose matter is this". */
export function currentOwnerId(t: MatterOwnership): string | null {
  return t.current_action_owner ?? t.assigned_to ?? t.record_owner ?? t.accountable_owner ?? null;
}

export function isUnassigned(t: MatterOwnership) {
  return currentOwnerId(t) === null;
}

export function isMine(t: MatterOwnership, userId: string | null) {
  if (!userId) return false;
  return (
    t.current_action_owner === userId ||
    t.assigned_to === userId ||
    t.record_owner === userId ||
    t.accountable_owner === userId ||
    t.pending_handoff_to === userId
  );
}

/**
 * Client mirror of private.can_edit_ticket. Supervisors always; otherwise the
 * people connected to the matter, plus anything nobody owns yet.
 */
export function canEditMatter(
  t: MatterOwnership,
  userId: string | null,
  opts: { isSupervisor: boolean; readOnly: boolean },
) {
  if (opts.readOnly) return false;
  if (opts.isSupervisor) return true;
  if (!userId) return false;
  return isMine(t, userId) || t.created_by === userId || isUnassigned(t);
}

export type QueueTab = "mine" | "team" | "unassigned" | "escalated" | "closed" | "all";

/**
 * Queue views, in the order a coordinator thinks about their day.
 *
 * `supervisory` views are the exception board — useful to whoever oversees the
 * work, noise to whoever is doing it.
 */
export const QUEUE_TABS: { value: QueueTab; label: string; hint: string; supervisory?: boolean }[] = [
  { value: "mine", label: "My work", hint: "Tickets you own or must act on next." },
  { value: "unassigned", label: "Unclaimed", hint: "Open tickets nobody has picked up." },
  { value: "team", label: "Everyone's work", hint: "Every open ticket across the portfolio." },
  { value: "closed", label: "Closed", hint: "Resolved and closed tickets." },
  { value: "escalated", label: "Overdue & escalated", hint: "Past a response standard or escalated.", supervisory: true },
  { value: "all", label: "All", hint: "Everything not archived.", supervisory: true },
];

type QueueTicket = MatterOwnership & {
  status: string;
  priority: string;
  archived_at?: string | null;
  received_at?: string | null;
  reported_at?: string | null;
  acknowledged_at?: string | null;
  action_started_at?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
  escalation_level?: string | null;
};

export function matchesTab(t: QueueTicket, tab: QueueTab, userId: string | null) {
  const open = OPEN_STATUSES.includes(t.status);
  switch (tab) {
    case "mine":
      return open && isMine(t, userId);
    case "team":
      return open;
    case "unassigned":
      return open && isUnassigned(t);
    case "escalated": {
      const sla = slaState(t);
      return open && Boolean(sla.breached || sla.escalation || t.escalation_level);
    }
    case "closed":
      return isClosed(t.status);
    case "all":
    default:
      return true;
  }
}

/** Most urgent first, then the tightest clock. */
export function queueSort(a: QueueTicket, b: QueueTicket) {
  const rank: Record<string, number> = { p1: 3, p2: 2, p3: 1 };
  const byPriority = (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0);
  if (byPriority !== 0) return byPriority;
  const aDue = a.response_due_at ?? a.action_due_at ?? "";
  const bDue = b.response_due_at ?? b.action_due_at ?? "";
  return aDue.localeCompare(bDue);
}

/** Turns "@name" text into the user ids of the people mentioned. */
export function extractMentions(
  body: string,
  people: { id: string; full_name: string | null; email: string | null }[],
) {
  const lowered = body.toLowerCase();
  return people
    .filter((p) => {
      const handles = [p.full_name, p.email?.split("@")[0]]
        .filter(Boolean)
        .map((h) => `@${String(h).toLowerCase().replace(/\s+/g, "")}`);
      return handles.some((h) => lowered.replace(/\s+/g, " ").includes(h)) ||
        (p.full_name ? lowered.includes(`@${p.full_name.toLowerCase()}`) : false);
    })
    .map((p) => p.id);
}
