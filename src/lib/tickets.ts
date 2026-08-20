// Domain rules for ARHA "matters" (tickets).
// Priorities are P1–P4 only. Response/action clocks come straight from the
// Response Standards rubric; nothing here is a productivity score.

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

export const RECORD_TYPES = [
  {
    value: "completed_interaction",
    label: "Completed interaction",
    hint: "Handled start to finish in one touch. Logged for history, never enters the queue.",
  },
  {
    value: "active_task",
    label: "Active task",
    hint: "Needs more work. Exactly one accountable owner.",
  },
  {
    value: "collaborative_matter",
    label: "Collaborative matter",
    hint: "Multiple people involved. One accountable owner plus a current action owner.",
  },
] as const;

export const PRIORITIES = [
  {
    value: "p1",
    label: "P1 — Emergency",
    short: "P1",
    responseMinutes: 10,
    actionMinutes: 0,
    summary: "Guest safety, habitability or access at risk. Acknowledge in 10 minutes, act immediately.",
  },
  {
    value: "p2",
    label: "P2 — Urgent",
    short: "P2",
    responseMinutes: 30,
    actionMinutes: 60,
    summary: "Impacts the current or imminent stay. Acknowledge in 30 minutes, start within the hour.",
  },
  {
    value: "p3",
    label: "P3 — Standard",
    short: "P3",
    responseMinutes: 120,
    actionMinutes: 1440,
    summary: "Normal operations. Acknowledge in 2 hours, start within one business day.",
  },
  {
    value: "p4",
    label: "P4 — Planned",
    short: "P4",
    responseMinutes: 480,
    actionMinutes: 2880,
    summary: "Scheduled or non-urgent. Acknowledge by end of business.",
  },
] as const;

export type PriorityValue = (typeof PRIORITIES)[number]["value"];

// P1 escalation ladder, measured from receipt.
export const P1_ESCALATION = [
  { minutes: 10, level: "supervisor" as const, who: "Backup coordinator + supervisor" },
  { minutes: 20, level: "director" as const, who: "Supervisor takes over directly" },
  { minutes: 60, level: "executive" as const, who: "Management notified" },
];

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
  { value: "phone", label: "Phone call" },
  { value: "text", label: "Text / WhatsApp" },
  { value: "email", label: "Email" },
  { value: "owner", label: "Owner" },
  { value: "vendor", label: "Vendor" },
  { value: "internal", label: "Internal / noticed it ourselves" },
  { value: "inspection", label: "Inspection" },
] as const;

export const HANDOFF_TYPES = [
  {
    value: "action_request",
    label: "Action request",
    hint: "You stay accountable. They do a specific step.",
  },
  {
    value: "ownership_transfer",
    label: "Ownership transfer",
    hint: "They become accountable — only once they accept.",
  },
  { value: "shift_coverage", label: "Shift coverage", hint: "Hand off at end of shift." },
  { value: "supervisor_intervention", label: "Supervisor intervention", hint: "Escalating for help." },
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

/** Response + action deadlines from the moment the matter was received. */
export function slaDueDates(priority: string, receivedAt: Date = new Date()) {
  const meta = priorityMeta(priority);
  return {
    response_due_at: new Date(receivedAt.getTime() + meta.responseMinutes * 60_000).toISOString(),
    action_due_at: new Date(receivedAt.getTime() + meta.actionMinutes * 60_000).toISOString(),
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

function clock(dueAt: string | null | undefined, satisfiedAt: string | null | undefined, name: string): ClockState | null {
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
    label: minutes < 0 ? `${name} overdue by ${formatMinutes(-minutes)}` : `${name} due in ${formatMinutes(minutes)}`,
    minutes,
    breached: minutes < 0,
    met: false,
  };
}

/** The two live SLA clocks plus the current escalation step for a matter. */
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
    // Anything that should surface in the supervisor exception queue.
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
    case "p4":
      return "bg-muted text-muted-foreground border-border";
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
