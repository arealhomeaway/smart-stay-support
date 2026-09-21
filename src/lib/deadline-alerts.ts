/**
 * Time-based alerts: the three things that go wrong quietly.
 *
 * A ticket's SLA clock running out, a vendor who never acknowledged or never
 * arrived, and a claim deadline closing in are all conditions that nothing
 * "happens" to — no row changes at the moment they become true. They are
 * therefore evaluated on a pass rather than by a trigger.
 *
 * Every rule here is pure and derived from what is already recorded. Each
 * alert fires once per record per stage; the stage lives in the alert kind so
 * a warning and the breach that follows it are two distinct, single-shot
 * notices rather than a repeating nag.
 */

export const ALERT_KINDS = [
  "sla_response_warning",
  "sla_response_breached",
  "sla_action_warning",
  "sla_action_breached",
  "vendor_no_acknowledgment",
  "vendor_missed_eta",
  "claim_deadline_soon",
  "claim_deadline_passed",
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

export type DeadlineAlert = {
  kind: AlertKind;
  userId: string;
  title: string;
  body: string;
  entityType: "ticket" | "work_order" | "claim";
  entityId: string;
  linkPath: string;
  priority: "normal" | "urgent";
  isDemo: boolean;
};

/** How much warning the team gets before a clock runs out. */
export const SLA_WARNING_MINUTES = 30;
/** How many days before a claim deadline the reminder goes out. */
export const CLAIM_WARNING_DAYS = 3;

export type TicketForAlerts = {
  id: string;
  ref?: string | null;
  title?: string | null;
  status: string;
  priority?: string | null;
  assigned_to?: string | null;
  acknowledged_at?: string | null;
  action_started_at?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
  is_demo?: boolean | null;
};

export type WorkOrderForAlerts = {
  id: string;
  title?: string | null;
  assigned_to?: string | null;
  closed_at?: string | null;
  vendor_name?: string | null;
  vendor_contacted_at?: string | null;
  vendor_acknowledged_at?: string | null;
  vendor_eta_at?: string | null;
  vendor_arrived_at?: string | null;
  acknowledge_minutes?: number | null;
  is_demo?: boolean | null;
};

export type ClaimForAlerts = {
  id: string;
  ref?: string | null;
  title?: string | null;
  stage: string;
  assigned_to?: string | null;
  deadline_on?: string | null;
  is_demo?: boolean | null;
};

const CLOSED_TICKET_STATUSES = ["resolved", "closed", "deleted"];
const CLOSED_CLAIM_STAGES = ["recovered", "denied", "withdrawn", "closed", "decided"];

function minutesUntil(when: string | null | undefined, now: Date): number | null {
  if (!when) return null;
  const at = new Date(when).getTime();
  if (Number.isNaN(at)) return null;
  return Math.round((at - now.getTime()) / 60_000);
}

function lateBy(minutes: number): string {
  const late = Math.abs(minutes);
  if (late < 60) return `${late} minute${late === 1 ? "" : "s"}`;
  const hours = Math.round(late / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function ticketName(ticket: TicketForAlerts) {
  return ticket.ref ? `${ticket.ref} — ${ticket.title ?? "Ticket"}` : (ticket.title ?? "Ticket");
}

/** Response and action-start clocks, warned once and breached once. */
export function ticketSlaAlerts(tickets: TicketForAlerts[], now = new Date()): DeadlineAlert[] {
  const alerts: DeadlineAlert[] = [];
  for (const ticket of tickets) {
    if (CLOSED_TICKET_STATUSES.includes(ticket.status)) continue;
    if (!ticket.assigned_to) continue;

    const clocks = [
      {
        due: ticket.response_due_at,
        satisfied: ticket.acknowledged_at,
        name: "Acknowledgement",
        warning: "sla_response_warning" as const,
        breached: "sla_response_breached" as const,
      },
      {
        due: ticket.action_due_at,
        satisfied: ticket.action_started_at,
        name: "Work start",
        warning: "sla_action_warning" as const,
        breached: "sla_action_breached" as const,
      },
    ];

    for (const clock of clocks) {
      if (clock.satisfied) continue;
      const minutes = minutesUntil(clock.due, now);
      if (minutes === null) continue;
      const urgent = ticket.priority === "p1";

      if (minutes < 0) {
        alerts.push({
          kind: clock.breached,
          userId: ticket.assigned_to,
          title: `${clock.name} time has run out — ${ticketName(ticket)}`,
          body: `${clock.name.toLowerCase()} was due ${lateBy(minutes)} ago and has not happened yet. Take the next step or hand it to someone who can.`,
          entityType: "ticket",
          entityId: ticket.id,
          linkPath: `/tickets/${ticket.id}`,
          priority: "urgent",
          isDemo: Boolean(ticket.is_demo),
        });
      } else if (minutes <= SLA_WARNING_MINUTES) {
        alerts.push({
          kind: clock.warning,
          userId: ticket.assigned_to,
          title: `${clock.name} due in ${minutes} minute${minutes === 1 ? "" : "s"} — ${ticketName(ticket)}`,
          body: `The clock on this one is nearly out. ${clock.name} is still outstanding.`,
          entityType: "ticket",
          entityId: ticket.id,
          linkPath: `/tickets/${ticket.id}`,
          priority: urgent ? "urgent" : "normal",
          isDemo: Boolean(ticket.is_demo),
        });
      }
    }
  }
  return alerts;
}

/**
 * Vendor dispatch that did not land: contacted with no acknowledgement inside
 * the window, or an arrival time that came and went with nobody on site.
 */
export function vendorDispatchAlerts(
  workOrders: WorkOrderForAlerts[],
  now = new Date(),
  defaultAcknowledgeMinutes = 60,
): DeadlineAlert[] {
  const alerts: DeadlineAlert[] = [];
  for (const wo of workOrders) {
    if (wo.closed_at) continue;
    if (!wo.assigned_to) continue;
    const vendor = wo.vendor_name ?? "The vendor";
    const job = wo.title ?? "Work order";

    const window = wo.acknowledge_minutes ?? defaultAcknowledgeMinutes;
    const sinceContact = wo.vendor_contacted_at
      ? -(minutesUntil(wo.vendor_contacted_at, now) ?? 0)
      : null;

    if (!wo.vendor_acknowledged_at && sinceContact !== null && sinceContact > window) {
      alerts.push({
        kind: "vendor_no_acknowledgment",
        userId: wo.assigned_to,
        title: `No word back from ${vendor} — ${job}`,
        body: `${vendor} was contacted ${lateBy(sinceContact)} ago and has not confirmed. Chase it or move to the backup vendor.`,
        entityType: "work_order",
        entityId: wo.id,
        linkPath: `/work-orders?open=${wo.id}`,
        priority: "urgent",
        isDemo: Boolean(wo.is_demo),
      });
      continue;
    }

    const untilEta = minutesUntil(wo.vendor_eta_at, now);
    if (!wo.vendor_arrived_at && untilEta !== null && untilEta < 0) {
      alerts.push({
        kind: "vendor_missed_eta",
        userId: wo.assigned_to,
        title: `${vendor} missed the arrival time — ${job}`,
        body: `The arrival time passed ${lateBy(untilEta)} ago with no arrival recorded. Get a new time or dispatch a backup.`,
        entityType: "work_order",
        entityId: wo.id,
        linkPath: `/work-orders?open=${wo.id}`,
        priority: "urgent",
        isDemo: Boolean(wo.is_demo),
      });
    }
  }
  return alerts;
}

function daysUntilDate(deadline: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const [y, m, d] = deadline.split("-").map(Number);
  const due = Date.UTC(y!, m! - 1, d!);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((due - today) / 86_400_000);
}

/** Claim filing windows: a few days' notice, then a single "it has passed". */
export function claimDeadlineAlerts(claims: ClaimForAlerts[], now = new Date()): DeadlineAlert[] {
  const alerts: DeadlineAlert[] = [];
  for (const claim of claims) {
    if (CLOSED_CLAIM_STAGES.includes(claim.stage)) continue;
    if (!claim.assigned_to || !claim.deadline_on) continue;
    const days = daysUntilDate(claim.deadline_on, now);
    if (days === null) continue;
    const name = claim.ref ? `${claim.ref} — ${claim.title ?? "Claim"}` : (claim.title ?? "Claim");

    if (days < 0) {
      alerts.push({
        kind: "claim_deadline_passed",
        userId: claim.assigned_to,
        title: `Claim filing deadline has passed — ${name}`,
        body: `The deadline was ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago and this claim is still open. Escalate it today.`,
        entityType: "claim",
        entityId: claim.id,
        linkPath: `/claims?open=${claim.id}`,
        priority: "urgent",
        isDemo: Boolean(claim.is_demo),
      });
    } else if (days <= CLAIM_WARNING_DAYS) {
      alerts.push({
        kind: "claim_deadline_soon",
        userId: claim.assigned_to,
        title:
          days === 0
            ? `Claim deadline is today — ${name}`
            : `Claim deadline in ${days} day${days === 1 ? "" : "s"} — ${name}`,
        body: "Finish the evidence and file before the window closes.",
        entityType: "claim",
        entityId: claim.id,
        linkPath: `/claims?open=${claim.id}`,
        priority: days === 0 ? "urgent" : "normal",
        isDemo: Boolean(claim.is_demo),
      });
    }
  }
  return alerts;
}

/** One alert per person, record and stage — the key the pass dedupes on. */
export function alertKey(alert: Pick<DeadlineAlert, "kind" | "userId" | "entityId">) {
  return `${alert.kind}::${alert.userId}::${alert.entityId}`;
}

/** Drops anything already sent, and any duplicate inside this same pass. */
export function newAlerts(alerts: DeadlineAlert[], alreadySent: Set<string>): DeadlineAlert[] {
  const seen = new Set<string>();
  const out: DeadlineAlert[] = [];
  for (const alert of alerts) {
    const key = alertKey(alert);
    if (alreadySent.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(alert);
  }
  return out;
}
