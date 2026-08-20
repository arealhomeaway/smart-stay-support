// Domain rules for ARHA operational records.
// Source of truth: "Property Coordinator Task Ownership, Coverage, and Handoff SOP".
// Priorities are P1–P3 only. Nothing here is a productivity score.

export const CATEGORIES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "safety", label: "Safety devices (smoke / CO / security)" },
  { value: "cleaning", label: "Cleaning" },
  { value: "access", label: "Access / lockout" },
  { value: "guest", label: "Guest experience" },
  { value: "owner", label: "Owner" },
  { value: "vendor", label: "Vendor coordination" },
  { value: "claims", label: "Claims / reimbursement" },
  { value: "quality", label: "Quality / reviews" },
  { value: "admin", label: "Administrative" },
  { value: "other", label: "Other" },
] as const;

export const BUCKETS = [
  { value: "active_guest_emergency", label: "Active guest emergency" },
  { value: "same_day_operations", label: "Same-day operations" },
  { value: "property_ownership", label: "Property ownership" },
  { value: "future_reservations", label: "Future reservations" },
  { value: "administrative", label: "Administrative" },
] as const;

export const TEAMS = [
  { value: "guest_experience", label: "Guest Experience & Reservations", short: "Team A" },
  { value: "property_operations", label: "Property Operations", short: "Team B" },
  { value: "leadership", label: "Leadership", short: "Leadership" },
] as const;

// One ticket record type. One-touch resolutions are logged for history only.
export const RECORD_TYPES = [
  {
    value: "one_touch",
    label: "One-touch resolution",
    hint: "Fully resolved in a single action. Logged and linked, never enters the active queue.",
  },
  {
    value: "ticket",
    label: "Ticket",
    hint: "Needs follow-up, cross-shift coverage or another touchpoint. Flag it cross-team when more than one role must act.",
  },
] as const;

export const PRIORITIES = [
  {
    value: "p1",
    label: "P1 — Critical (immediate action)",
    short: "P1",
    responseMinutes: 3,
    actionMinutes: 5,
    summary:
      "Immediate impact on an active guest, safety, security, active damage, same-day revenue or an imminent arrival. Acknowledge in 3 minutes, begin meaningful action within 5.",
  },
  {
    value: "p2",
    label: "P2 — Time-sensitive",
    short: "P2",
    responseMinutes: 30,
    actionMinutes: 60,
    summary:
      "Must move today or by a task-specific deadline to prevent operational disruption. Follow the work type's response standard.",
  },
  {
    value: "p3",
    label: "P3 — Standard (planned work)",
    short: "P3",
    responseMinutes: 120,
    actionMinutes: 480,
    summary:
      "Routine, preventive, reporting or planned work. Complete in queue order after P1 and time-sensitive P2 work.",
  },
] as const;

export type PriorityValue = (typeof PRIORITIES)[number]["value"];

const PRIORITY_RANK: Record<string, number> = { p1: 3, p2: 2, p3: 1 };

/** Returns the more urgent of two priorities. */
export function mostUrgent(a: string, b: string) {
  return (PRIORITY_RANK[a] ?? 0) >= (PRIORITY_RANK[b] ?? 0) ? a : b;
}

// P1 staffing escalation: unseen or unaddressed for more than 15 minutes
// triggers staffing escalation and backup review. It does not replace the
// normal 3-minute / 5-minute standard.
export const P1_ESCALATION = [
  { minutes: 3, level: "backup" as const, who: "Backup role notified — acknowledgment standard missed" },
  { minutes: 5, level: "supervisor" as const, who: "Operations Supervisor notified — action has not started" },
  { minutes: 15, level: "staffing" as const, who: "Staffing escalation and backup review" },
];

// ---------------------------------------------------------------------------
// Mechanical priority model
// Work Type carries the suggested priority. Guest Impact and Occupancy Status
// determine the final priority. They may raise a ticket above the work type's
// suggestion; they must never lower it below that floor without a reason.
// ---------------------------------------------------------------------------

export const GUEST_IMPACT = [
  { value: "none", label: "None", floor: "p3" },
  { value: "minor", label: "Minor inconvenience", floor: "p3" },
  { value: "active_guest_affected", label: "Active guest affected", floor: "p1" },
  { value: "safety_security", label: "Safety or security", floor: "p1" },
] as const;

export const OCCUPANCY_STATUS = [
  { value: "vacant", label: "Vacant", floor: "p3" },
  { value: "occupied", label: "Occupied", floor: "p2" },
  { value: "same_day_arrival", label: "Same-day arrival", floor: "p1" },
  { value: "same_day_departure", label: "Same-day departure", floor: "p2" },
] as const;

/** The priority the rubric produces before any manual override. */
export function mechanicalPriority(
  suggested: string | null | undefined,
  guestImpact: string,
  occupancy: string,
) {
  const base = suggested ?? "p3";
  const impactFloor = GUEST_IMPACT.find((g) => g.value === guestImpact)?.floor ?? "p3";
  const occupancyFloor = OCCUPANCY_STATUS.find((o) => o.value === occupancy)?.floor ?? "p3";
  // Occupancy alone never forces P1 unless the guest is actually affected.
  const occupancyEffective =
    occupancyFloor === "p1" && impactFloor === "p3" && guestImpact === "none" ? "p2" : occupancyFloor;
  return mostUrgent(mostUrgent(base, impactFloor), occupancyEffective);
}

export function priorityDrivers(guestImpact: string, occupancy: string) {
  return [
    labelFor(GUEST_IMPACT, guestImpact),
    labelFor(OCCUPANCY_STATUS, occupancy),
  ];
}

export const STATUSES = [
  { value: "open", label: "Open" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting on someone" },
  { value: "awaiting_guest", label: "Awaiting guest confirmation" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

export const OPEN_STATUSES = ["open", "dispatched", "in_progress", "waiting", "awaiting_guest"];

export const WAITING_ON = [
  { value: "guest", label: "Guest" },
  { value: "owner", label: "Owner" },
  { value: "vendor", label: "Vendor" },
  { value: "approval", label: "Approval" },
  { value: "parts", label: "Parts / delivery" },
  { value: "scheduled_date", label: "A scheduled date" },
  { value: "internal_team", label: "Someone internal" },
  { value: "other", label: "Other" },
] as const;

export const OUTCOME_TYPES = [
  { value: "resolved", label: "Resolved" },
  { value: "information_provided", label: "Information provided" },
  { value: "vendor_completed", label: "Vendor completed the work" },
  { value: "no_issue_found", label: "No issue found" },
  { value: "cancelled_by_requestor", label: "Cancelled by requestor" },
  { value: "duplicate", label: "Duplicate" },
  { value: "other", label: "Other" },
] as const;

export const SOURCE_CHANNELS = [
  { value: "guest_message", label: "Guest message" },
  { value: "ownerrez", label: "OwnerRez message" },
  { value: "phone", label: "Phone call" },
  { value: "text", label: "Text / WhatsApp" },
  { value: "email", label: "Email" },
  { value: "owner", label: "Owner" },
  { value: "vendor", label: "Vendor" },
  { value: "internal", label: "Internal / noticed it ourselves" },
  { value: "breezeway", label: "Breezeway" },
  { value: "inspection", label: "Inspection" },
] as const;

export const HANDOFF_TYPES = [
  {
    value: "action_request",
    label: "Action request",
    hint: "You stay the Record Owner. They take the next action.",
  },
  {
    value: "ownership_transfer",
    label: "Ownership transfer",
    hint: "They become the Current Assignee — only once they accept.",
  },
  { value: "shift_coverage", label: "Shift transition", hint: "Action is needed before your next shift." },
  { value: "lunch_coverage", label: "Lunch coverage", hint: "New P1 or time-sensitive P2 while you step away." },
  { value: "supervisor_intervention", label: "Escalation", hint: "Authority, approval or leadership judgment needed." },
] as const;

export const GUEST_COMM_STATUS = [
  { value: "not_required", label: "No guest communication required" },
  { value: "guest_waiting", label: "Guest is waiting on an update" },
  { value: "guest_updated", label: "Guest updated — next update owed" },
  { value: "guest_informed_closed", label: "Guest informed, nothing owed" },
] as const;

export const ESCALATION_REASONS = [
  { value: "authority", label: "Beyond my authority to resolve" },
  { value: "compensation", label: "Guest compensation may be required" },
  { value: "relocation", label: "Guest may need relocation or transfer" },
  { value: "booking_change", label: "A booking may need to be altered" },
  { value: "owner_decision", label: "An owner decision is required" },
  { value: "vendor_failure", label: "Vendor cannot meet the operational need" },
  { value: "multi_department", label: "Affects multiple departments" },
  { value: "significant_risk", label: "Significant financial, safety or reputational risk" },
] as const;

export function labelFor(
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return list.find((i) => i.value === value)?.label ?? value ?? "—";
}

export function priorityMeta(priority: string | null | undefined) {
  return PRIORITIES.find((p) => p.value === priority) ?? PRIORITIES[2];
}

type StandardSource = {
  response_minutes?: number | null;
  action_start_minutes?: number | null;
} | null;

/**
 * Response + action deadlines. The work type's own standard wins when it is
 * defined (the SOP sets these per work type); otherwise the priority default.
 */
export function slaDueDates(priority: string, receivedAt: Date = new Date(), workType?: StandardSource) {
  const meta = priorityMeta(priority);
  const response = workType?.response_minutes ?? meta.responseMinutes;
  const action = workType?.action_start_minutes ?? meta.actionMinutes;
  return {
    response_due_at: new Date(receivedAt.getTime() + response * 60_000).toISOString(),
    action_due_at: new Date(receivedAt.getTime() + action * 60_000).toISOString(),
  };
}

export function isClosed(status: string) {
  return status === "resolved" || status === "closed";
}

type SlaTicket = {
  priority: string;
  status: string;
  received_at?: string | null;
  reported_at?: string | null;
  acknowledged_at?: string | null;
  action_started_at?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
};

export type ClockState = {
  label: string;
  /** minutes remaining; negative when breached */
  minutes: number;
  breached: boolean;
  met: boolean;
};

function clock(
  dueAt: string | null | undefined,
  satisfiedAt: string | null | undefined,
  name: string,
): ClockState | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (satisfiedAt) {
    const late = new Date(satisfiedAt).getTime() > due;
    return {
      label: late ? `${name} late` : `${name} met`,
      minutes: Math.round((due - new Date(satisfiedAt).getTime()) / 60_000),
      breached: late,
      met: true,
    };
  }
  const minutes = Math.round((due - Date.now()) / 60_000);
  return {
    label:
      minutes < 0 ? `${name} overdue by ${formatMinutes(-minutes)}` : `${name} due in ${formatMinutes(minutes)}`,
    minutes,
    breached: minutes < 0,
    met: false,
  };
}

/** The two live clocks plus the current P1 escalation step for a record. */
export function slaState(ticket: SlaTicket) {
  const closed = isClosed(ticket.status);
  const response = clock(ticket.response_due_at, ticket.acknowledged_at, "Acknowledge");
  const action = clock(ticket.action_due_at, ticket.action_started_at, "Action start");

  let escalation: { level: string; who: string; minutes: number } | null = null;
  if (!closed && ticket.priority === "p1" && !ticket.action_started_at) {
    const received = new Date(ticket.received_at ?? ticket.reported_at ?? Date.now()).getTime();
    const elapsed = Math.floor((Date.now() - received) / 60_000);
    for (const step of P1_ESCALATION) {
      if (elapsed >= step.minutes) escalation = { ...step, minutes: elapsed };
    }
  }

  return {
    response,
    action,
    escalation,
    breached: !closed && Boolean(response?.breached || action?.breached),
  };
}

export function formatMinutes(mins: number) {
  const m = Math.abs(Math.round(mins));
  if (m < 60) return `${m}m`;
  if (m < 60 * 48) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

export function statusTone(status: string) {
  switch (status) {
    case "open":
      return "bg-danger/10 text-danger border-danger/30";
    case "dispatched":
    case "in_progress":
      return "bg-info/10 text-info border-info/30";
    case "waiting":
      return "bg-muted text-muted-foreground border-border";
    case "awaiting_guest":
      return "bg-warning/15 text-warning-foreground border-warning/40";
    case "resolved":
    case "closed":
      return "bg-success/10 text-success border-success/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function priorityTone(priority: string) {
  switch (priority) {
    case "p1":
      return "bg-danger text-danger-foreground border-danger";
    case "p2":
      return "bg-warning text-warning-foreground border-warning";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return mins <= 0 ? "just now" : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function dueLabel(dueAt: string | null | undefined, status: string) {
  if (!dueAt || isClosed(status)) return null;
  const mins = Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);
  if (mins < 0) return { text: `Overdue by ${formatMinutes(mins)}`, overdue: true };
  return { text: `Due in ${formatMinutes(mins)}`, overdue: false };
}
