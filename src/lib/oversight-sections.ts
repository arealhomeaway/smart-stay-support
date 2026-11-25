/**
 * Oversight supervisor sections (Emily, Nov 25 2026). Pure and browser-safe.
 * Reads existing ticket fields only; late uses the one-deadline rule (ticketLate).
 */
import { currentOwnerId } from "@/lib/matters";
import { ticketDueDay, ticketLate, type DeadlineTicket } from "@/lib/ticket-deadline";
import { centralToday } from "@/lib/team-schedule";

export const SECTION_LIMIT = 10;

export type SectionTicket = DeadlineTicket & {
  id: string;
  priority: string | null;
  reported_at: string;
  assigned_to: string | null;
  current_action_owner: string | null;
  record_owner?: string | null;
  accountable_owner?: string | null;
};

export type SectionKey = "p1" | "no_owner" | "past_due";

const rank = (p: string | null) => (p === "p1" ? 1 : p === "p2" ? 2 : p === "p3" ? 3 : 4);
const oldest = (a: SectionTicket, b: SectionTicket) => a.reported_at.localeCompare(b.reported_at);

export function hasNoOwner(t: SectionTicket): boolean {
  return !t.assigned_to && !t.current_action_owner;
}

export function sectionRows<T extends SectionTicket>(key: SectionKey, open: T[], now = new Date()): T[] {
  if (key === "p1") return open.filter((t) => t.priority === "p1").sort(oldest);
  if (key === "no_owner")
    return open.filter(hasNoOwner).sort((a, b) => rank(a.priority) - rank(b.priority) || oldest(a, b));
  return open
    .filter((t) => ticketLate(t, now))
    .sort((a, b) => (ticketDueDay(a) ?? "").localeCompare(ticketDueDay(b) ?? "") || oldest(a, b));
}

export type PersonLoad = { id: string; open: number; pastDue: number; dueToday: number };

/** One row per person: open, past due and due today, read from the same open list. */
export function loadFor<T extends SectionTicket>(personIds: string[], open: T[], now = new Date()): PersonLoad[] {
  const today = centralToday(now);
  return personIds.map((id) => {
    const mine = open.filter((t) => currentOwnerId(t) === id);
    return {
      id,
      open: mine.length,
      pastDue: mine.filter((t) => ticketLate(t, now)).length,
      dueToday: mine.filter((t) => !ticketLate(t, now) && ticketDueDay(t) === today).length,
    };
  });
}

/** True when a person's shift blocks today include the current Central minute. */
export function onShiftAt(blocks: { start: number; end: number }[], now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const minute = h * 60 + m;
  return blocks.some((b) => minute >= b.start && minute < b.end);
}
