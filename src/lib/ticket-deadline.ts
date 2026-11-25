/**
 * One deadline per ticket (Emily, Nov 25 2026). Display only: never changes clocks, alerts,
 * routing or stored times.
 * - The reply and start clocks show only when a guest is waiting for an answer. In tickets
 *   that is source_channel "guest_message". Direct Bookings are leads, not tickets.
 * - Every other open ticket has one deadline: its due date (due_on). Late = past due_on.
 */
import { dueOverdueDays } from "@/lib/ticket-due-date";

const DONE = ["resolved", "closed", "cancelled"];
const GUEST_CHANNELS = ["guest_message"];

export type DeadlineTicket = {
  status: string;
  source_channel?: string | null;
  due_on?: string | null;
  acknowledged_at?: string | null;
  action_started_at?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
};

export function guestIsWaiting(t: { source_channel?: string | null }): boolean {
  return GUEST_CHANNELS.includes(String(t.source_channel ?? ""));
}

/** The clock time still running for a guest-waiting ticket, else null. */
export function guestClockAt(t: DeadlineTicket): string | null {
  if (!guestIsWaiting(t) || DONE.includes(t.status)) return null;
  if (!t.acknowledged_at) return t.response_due_at ?? null;
  if (!t.action_started_at) return t.action_due_at ?? null;
  return null;
}

/** Late: past its due date; a guest-waiting ticket is also late once its running clock passes. */
export function ticketLate(t: DeadlineTicket, now = new Date()): boolean {
  if (DONE.includes(t.status)) return false;
  if (dueOverdueDays(t, now) > 0) return true;
  const clock = guestClockAt(t);
  return Boolean(clock && new Date(clock).getTime() < now.getTime());
}

/** The Central day the ticket is due, for Due today / This week / Next week. */
export function ticketDueDay(t: DeadlineTicket): string | null {
  const clock = guestClockAt(t);
  const clockDay = clock ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(clock)) : null;
  const due = t.due_on ? t.due_on.slice(0, 10) : null;
  if (clockDay && due) return clockDay < due ? clockDay : due;
  return clockDay ?? due;
}

/** Ticket panel clocks: a non-guest ticket shows no reply or start clock. Escalation is untouched. */
export function guestClockView<S extends { response: unknown; action: unknown; breached: boolean }>(
  t: { source_channel?: string | null },
  sla: S,
): S {
  return guestIsWaiting(t) ? sla : { ...sla, response: null, action: null, breached: false };
}
