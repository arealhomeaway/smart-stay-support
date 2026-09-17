/**
 * The Team Queue filter model.
 *
 * Team Queue is every active Operations ticket the team could pick up. It is
 * available to all Operations staff on purpose: shifts overlap, coverage moves
 * through the day, and the next available person still has to handle the work.
 *
 * Home team (A / B) is *context and a filter* here — never a permission wall.
 */

import { OPEN_STATUSES, slaState } from "@/lib/tickets";
import { currentOwnerId, isUnassigned } from "@/lib/matters";

export type TeamQueueFilters = {
  /** "all" | user id | "unassigned" */
  assignee: string;
  /** "all" | "guest_experience" | "property_operations" | "none" */
  homeTeam: string;
  priority: string;
  /** "active" (default) | a ticket status | "all" */
  status: string;
  property: string;
  market: string;
  city: string;
  state: string;
  workType: string;
  due: string;
  /** "all" | "today" | "3d" | "7d" | "older" */
  age: string;
  /** Boolean flags, all off by default. */
  waiting: boolean;
  unassigned: boolean;
  escalated: boolean;
  blocked: boolean;
  overdue: boolean;
  q: string;
};

export const DEFAULT_TEAM_QUEUE_FILTERS: TeamQueueFilters = {
  assignee: "all",
  homeTeam: "all",
  priority: "all",
  status: "active",
  property: "all",
  market: "all",
  city: "all",
  state: "all",
  workType: "all",
  due: "all",
  age: "all",
  waiting: false,
  unassigned: false,
  escalated: false,
  blocked: false,
  overdue: false,
  q: "",
};

export const AGE_OPTIONS = [
  { value: "all", label: "Any age" },
  { value: "today", label: "Today" },
  { value: "3d", label: "Over 3 days" },
  { value: "7d", label: "Over a week" },
] as const;

export const HOME_TEAM_OPTIONS = [
  { value: "all", label: "Both teams" },
  { value: "guest_experience", label: "A · Guest Experience" },
  { value: "property_operations", label: "B · Property Operations" },
  { value: "none", label: "No home team" },
] as const;

export type TeamQueueTicket = {
  id: string;
  ref?: number | null;
  title?: string | null;
  description?: string | null;
  guest_name?: string | null;
  priority: string;
  status: string;
  property_id?: string | null;
  work_type_id?: string | null;
  properties?: {
    market?: string | null;
    city?: string | null;
    state?: string | null;
    name?: string | null;
  } | null;
  reported_at?: string | null;
  next_review_at?: string | null;
  waiting_on?: string | null;
  escalation_level?: string | null;
  handoff_status?: string | null;
  functional_role_code?: string | null;
  assigned_to?: string | null;
  current_action_owner?: string | null;
  record_owner?: string | null;
  accountable_owner?: string | null;
  pending_handoff_to?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
  next_action_due_at?: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

function ageDays(iso: string | null | undefined) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / DAY;
}

/**
 * A ticket is "blocked" when nothing can move it right now: waiting past its
 * review date, waiting with no review date at all, or a handoff nobody accepted.
 */
export function isBlocked(t: TeamQueueTicket) {
  if (t.handoff_status === "pending") return true;
  if (t.status !== "waiting") return false;
  if (!t.next_review_at) return true;
  return new Date(t.next_review_at).getTime() < Date.now();
}

export function isEscalated(t: TeamQueueTicket) {
  const sla = slaState(t);
  return Boolean(t.escalation_level || sla.escalation);
}

export function applyTeamQueueFilters(
  rows: TeamQueueTicket[],
  filters: TeamQueueFilters,
  homeTeamOf: (userId: string | null) => string | null,
): TeamQueueTicket[] {
  const q = filters.q.trim().toLowerCase();

  return rows.filter((t) => {
    if (filters.status === "active") {
      if (!OPEN_STATUSES.includes(t.status)) return false;
    } else if (filters.status !== "all" && t.status !== filters.status) {
      return false;
    }

    if (filters.priority !== "all" && t.priority !== filters.priority) return false;
    if (filters.property !== "all" && t.property_id !== filters.property) return false;
    if (filters.market !== "all" && t.properties?.market !== filters.market) return false;
    if (filters.city !== "all" && t.properties?.city !== filters.city) return false;
    if (filters.state !== "all" && t.properties?.state !== filters.state) return false;
    if (filters.workType !== "all" && t.work_type_id !== filters.workType) return false;

    if (filters.due !== "all") {
      const due = t.next_action_due_at ?? t.action_due_at ?? t.response_due_at;
      if (!due) return filters.due === "unscheduled";
      const dueTime = new Date(due).getTime();
      const now = Date.now();
      if (filters.due === "unscheduled") return false;
      if (filters.due === "overdue" && dueTime >= now) return false;
      if (filters.due === "today" && new Date(due).toDateString() !== new Date(now).toDateString())
        return false;
      if (filters.due === "next7" && (dueTime < now || dueTime > now + 7 * DAY)) return false;
    }

    const owner = currentOwnerId(t);
    if (filters.assignee === "unassigned") {
      if (!isUnassigned(t)) return false;
    } else if (filters.assignee !== "all" && owner !== filters.assignee) {
      return false;
    }

    if (filters.homeTeam !== "all") {
      const team = homeTeamOf(owner);
      if (filters.homeTeam === "none" ? Boolean(team) : team !== filters.homeTeam) return false;
    }

    if (filters.age !== "all") {
      const days = ageDays(t.reported_at);
      if (filters.age === "today" && days > 1) return false;
      if (filters.age === "3d" && days < 3) return false;
      if (filters.age === "7d" && days < 7) return false;
    }

    if (filters.waiting && t.status !== "waiting") return false;
    if (filters.unassigned && !isUnassigned(t)) return false;
    if (filters.escalated && !isEscalated(t)) return false;
    if (filters.blocked && !isBlocked(t)) return false;
    if (filters.overdue && !slaState(t).breached) return false;

    if (q) {
      const hay = [t.ref ? `#${t.ref}` : "", t.title, t.description, t.guest_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

/** How many filters are on, so the UI can offer a single "Clear" affordance. */
export function activeFilterCount(f: TeamQueueFilters) {
  let n = 0;
  if (f.assignee !== "all") n++;
  if (f.homeTeam !== "all") n++;
  if (f.priority !== "all") n++;
  if (f.status !== "active") n++;
  if (f.property !== "all") n++;
  if (f.market !== "all") n++;
  if (f.city !== "all") n++;
  if (f.state !== "all") n++;
  if (f.workType !== "all") n++;
  if (f.due !== "all") n++;
  if (f.age !== "all") n++;
  if (f.waiting) n++;
  if (f.unassigned) n++;
  if (f.escalated) n++;
  if (f.blocked) n++;
  if (f.overdue) n++;
  if (f.q.trim()) n++;
  return n;
}
