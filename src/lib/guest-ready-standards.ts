/**
 * Guest-ready standards (Operations walkthrough, Nov 24). One row per ticket type says what must be done and
 * whether its due date is Locked or the team can change it. "Not set" keeps the existing due date rule
 * (P1 and P2 due today, P3 due in 7 days, Central). The database mirrors these rules in
 * private.guest_ready_due (docs/pending/guest-ready-standards); this file is the screen's copy of the same rule.
 */
import type { AccessSeats, AppRole } from "./permissions";
import { canEditPlaybooks } from "./playbook-editing";

export type StandardRule = "not_set" | "same_day" | "clean_day_4pm" | "arrival_deadline" | "days";

export type GuestReadyStandard = {
  id: string;
  label: string;
  mustBeDone: string;
  locked: boolean;
  rule: StandardRule;
  /** Days after the ticket is made, for rule "days" (the latest day of the window). */
  ruleDays: number | null;
  /** The ticket type this row is for; null when no ticket type is linked yet. */
  workTypeName: string | null;
  workTypeId?: string | null;
  /** The Priority 1 row matches every P1 ticket that has no row of its own. */
  matchPriority: "p1" | null;
  /** One line shown on a locked ticket. */
  lockNote: string | null;
  sortOrder: number;
};

/** The starting rows, in order (written by the staged database change with the same values). */
export const DEFAULT_STANDARDS: GuestReadyStandard[] = [
  { id: "cleaning-review", label: "Cleaning review", mustBeDone: "Before 4:00 PM on the day of the clean", locked: true, rule: "clean_day_4pm", ruleDays: null, workTypeName: "Cleaning Review Log", matchPriority: null, lockNote: "Cleaning reviews are always due before 4:00 PM.", sortOrder: 10 },
  { id: "p1-guest", label: "Priority 1, guest-impacting (heat, AC, leaks, power)", mustBeDone: "Same day", locked: true, rule: "same_day", ruleDays: null, workTypeName: null, matchPriority: "p1", lockNote: "Priority 1 tickets are always due the same day.", sortOrder: 20 },
  { id: "arrival-check", label: "Arrival check", mustBeDone: "By the arrival check deadline", locked: true, rule: "arrival_deadline", ruleDays: null, workTypeName: "Arrival check", matchPriority: null, lockNote: "Arrival checks are always due by the arrival check deadline.", sortOrder: 30 },
  { id: "lawn-care-review", label: "Lawn care review", mustBeDone: "Within 3 to 7 days", locked: false, rule: "days", ruleDays: 7, workTypeName: null, matchPriority: null, lockNote: null, sortOrder: 40 },
  { id: "inspection-review", label: "Inspection review", mustBeDone: "Not set", locked: false, rule: "not_set", ruleDays: null, workTypeName: "Quarterly inspection review", matchPriority: null, lockNote: null, sortOrder: 50 },
  { id: "minor-items", label: "Minor items (paint touch-ups, weeds)", mustBeDone: "Not set", locked: false, rule: "not_set", ruleDays: null, workTypeName: "Minor items", matchPriority: null, lockNote: null, sortOrder: 60 },
  { id: "pest-control", label: "Pest control", mustBeDone: "Not set", locked: false, rule: "not_set", ruleDays: null, workTypeName: "Pest control", matchPriority: null, lockNote: null, sortOrder: 70 },
];

export const DUE_MODE = { locked: "Locked", open: "Team can change" } as const;
export const dueModeLabel = (locked: boolean) => (locked ? DUE_MODE.locked : DUE_MODE.open);

/** Supervisors, Directors and Admin edit the page and change a locked due date (same rule as playbooks, DB can_save_playbooks). */
export function canEditStandards(roles: readonly AppRole[], seats: AccessSeats = {}) {
  return canEditPlaybooks(roles, seats);
}
export const canChangeLockedDue = canEditStandards;

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** The row for a ticket: its own ticket type first, else the Priority 1 row for a P1 ticket. */
export function standardFor(
  standards: readonly GuestReadyStandard[],
  t: { workTypeName?: string | null; workTypeId?: string | null; priority?: string | null },
): GuestReadyStandard | null {
  const own = standards.find(
    (s) => (s.workTypeId && t.workTypeId && s.workTypeId === t.workTypeId) || (s.workTypeName && norm(s.workTypeName) === norm(t.workTypeName)),
  );
  if (own) return own;
  if (norm(t.priority) === "p1") return standards.find((s) => s.matchPriority === "p1") ?? null;
  return null;
}

function addDays(day: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return day;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return d.toISOString().slice(0, 10);
}

/** Today's existing rule: P1 and P2 due today, P3 due in 7 days. */
export function defaultDue(priority: string | null | undefined, today: string): string | null {
  const p = norm(priority);
  if (p === "p1" || p === "p2") return today;
  if (p === "p3") return addDays(today, 7);
  return null;
}

/**
 * The due date a new ticket gets and whether it is locked. "Not set" and the arrival check (worked out by the
 * existing arrival check deadline, never here) fall back to today's rule for the date shown before saving.
 */
export function dueForNewTicket(
  standard: GuestReadyStandard | null,
  priority: string | null | undefined,
  today: string,
): { dueOn: string | null; locked: boolean; note: string | null } {
  if (!standard) return { dueOn: defaultDue(priority, today), locked: false, note: null };
  const note = standard.locked ? standard.lockNote : null;
  switch (standard.rule) {
    case "same_day":
    case "clean_day_4pm":
      return { dueOn: today, locked: standard.locked, note };
    case "days":
      return { dueOn: addDays(today, Math.max(0, standard.ruleDays ?? 7)), locked: standard.locked, note };
    default:
      return { dueOn: defaultDue(priority, today), locked: standard.locked, note };
  }
}

/** Who may change a ticket's due date: locked dates only Supervisors, Directors and Admin, with a reason. */
export function dueChangeRule(locked: boolean, canChangeLocked: boolean, canEditTicket: boolean): "edit" | "edit_with_reason" | "view" {
  if (!canEditTicket) return "view";
  if (!locked) return "edit";
  return canChangeLocked ? "edit_with_reason" : "view";
}

/** Parse a database row into the screen shape. */
export function parseStandardRow(r: Record<string, unknown>): GuestReadyStandard {
  const rule = String(r["rule"] ?? "not_set") as StandardRule;
  const wt = r["work_types"] as { name?: string | null } | null | undefined;
  return {
    id: String(r["id"]),
    label: String(r["label"] ?? ""),
    mustBeDone: String(r["must_be_done"] ?? "Not set"),
    locked: Boolean(r["locked"]),
    rule,
    ruleDays: typeof r["rule_days"] === "number" ? (r["rule_days"] as number) : null,
    workTypeName: wt?.name ?? null,
    workTypeId: (r["work_type_id"] as string | null) ?? null,
    matchPriority: r["match_priority"] === "p1" ? "p1" : null,
    lockNote: (r["lock_note"] as string | null) ?? null,
    sortOrder: Number(r["sort_order"] ?? 0),
  };
}

/** Review tickets whose main button opens the Breezeway task's requirements. */
const REVIEW_TYPES = ["cleaning review log", "quarterly inspection review", "lawn care review", "inspection review", "cleaning review"];
export function isBreezewayReviewType(workTypeName: string | null | undefined): boolean {
  return REVIEW_TYPES.includes(norm(workTypeName));
}

/** "Open Breezeway requirements": the report when there is one, else the task page. */
export function breezewayRequirementsLink(orders: readonly { reportLink?: string | null; taskPage?: string | null }[]): string | null {
  for (const o of orders) if (o.reportLink) return o.reportLink;
  for (const o of orders) if (o.taskPage) return o.taskPage;
  return null;
}
