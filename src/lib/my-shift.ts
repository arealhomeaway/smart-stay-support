/**
 * Home: My shift, End my shift, the lunch handoff and Request time off
 * (Emily, Nov 7, confirmed Nov 9; register T1, T2, T4, T6, S1, S4).
 * Pure and browser-safe. It reads the same schedule rows routing reads
 * (functional_roles, coverage_shifts, coverage_overrides); it never writes.
 * Handoffs are written only by the database function end_my_shift.
 */
import { centralInstant, centralToday, weekdayOf } from "@/lib/team-schedule";
import { currentOwnerId } from "@/lib/matters";
import { isQuietNotion, type NotionTicketLike } from "@/lib/notion-ticket-display";
import { isImportHeld } from "@/lib/import-hold";
import { OPEN_STATUSES } from "@/lib/tickets";
import { COORDINATOR_ROLE_LABELS, teamOf } from "@/lib/coverage-model";

const TZ = "America/Chicago";

export type ShiftRole = { code: string; current_seat_holder: string | null; active?: boolean | null };
export type ShiftRow = {
  role_code: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  lunch_start_minute: number | null;
  lunch_end_minute: number | null;
  active?: boolean | null;
};
export type ShiftOverride = { role_code: string; kind: string; user_id: string | null; starts_at: string; ends_at: string; created_at?: string | null };

export type ShiftBlock = {
  roleCode: string;
  /** Minutes from midnight, Central. */
  start: number;
  end: number;
  lunchStart: number | null;
  lunchEnd: number | null;
  covering: boolean;
};

export type MyShiftToday = {
  /** Shows the My shift card: holds a scheduled role, covers one today, or is a coordinator. */
  worksShifts: boolean;
  date: string;
  blocks: ShiftBlock[];
  /** Time off covers today's own shift. */
  off: boolean;
};

const overlaps = (aFrom: number, aTo: number, bFrom: number, bTo: number) => aFrom < bTo && aTo > bFrom;

/** Today's hours for one person, from the schedule, time off and cover. */
export function myShiftToday(input: {
  userId: string;
  isCoordinator: boolean;
  roles: ShiftRole[];
  shifts: ShiftRow[];
  overrides: ShiftOverride[];
  now?: Date;
}): MyShiftToday {
  const now = input.now ?? new Date();
  const date = centralToday(now);
  const wd = weekdayOf(date);
  const active = input.shifts.filter((s) => s.active !== false);
  const held = input.roles.filter((r) => r.active !== false && r.current_seat_holder === input.userId).map((r) => r.code);
  const heldWithShifts = held.filter((c) => active.some((s) => s.role_code === c));
  const blocks: ShiftBlock[] = [];
  let off = false;

  const at = (m: number) => Date.parse(centralInstant(date, m));
  // The newest override touching a window wins, the same as routing.
  const latest = (roleCode: string, from: number, to: number) =>
    input.overrides
      .filter((o) => o.role_code === roleCode && overlaps(Date.parse(o.starts_at), Date.parse(o.ends_at), from, to))
      .sort((a, b) => (b.created_at ?? b.starts_at).localeCompare(a.created_at ?? a.starts_at))[0] ?? null;

  for (const s of active.filter((x) => x.weekday === wd)) {
    const from = at(s.start_minute);
    const to = at(s.end_minute);
    if (held.includes(s.role_code)) {
      const o = latest(s.role_code, from, to);
      if (o && (o.kind === "off" || (o.kind === "cover" && o.user_id !== input.userId))) {
        off = true;
        continue;
      }
      blocks.push({ roleCode: s.role_code, start: s.start_minute, end: s.end_minute, lunchStart: s.lunch_start_minute, lunchEnd: s.lunch_end_minute, covering: false });
      continue;
    }
    // Covering someone else's shift today: the part of the shift the cover spans.
    const cover = input.overrides.find(
      (o) => o.kind === "cover" && o.role_code === s.role_code && o.user_id === input.userId && overlaps(Date.parse(o.starts_at), Date.parse(o.ends_at), from, to),
    );
    if (cover) {
      const minuteOf = (ms: number) => Math.round((ms - at(0)) / 60_000);
      const start = Math.max(s.start_minute, minuteOf(Date.parse(cover.starts_at)));
      const end = Math.min(s.end_minute, minuteOf(Date.parse(cover.ends_at)));
      const lunchInside = s.lunch_start_minute !== null && s.lunch_end_minute !== null && s.lunch_start_minute >= start && s.lunch_end_minute <= end;
      blocks.push({
        roleCode: s.role_code,
        start,
        end,
        lunchStart: lunchInside ? s.lunch_start_minute : null,
        lunchEnd: lunchInside ? s.lunch_end_minute : null,
        covering: true,
      });
    }
  }
  blocks.sort((a, b) => a.start - b.start);
  return {
    worksShifts: input.isCoordinator || heldWithShifts.length > 0 || blocks.length > 0,
    date,
    blocks,
    off: off && blocks.length === 0,
  };
}

/** "1 PM", "1:30 PM", "12 AM". */
export function timeLabel(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** "4 to 5" for a lunch hour. */
export function lunchLabel(start: number, end: number): string {
  const short = (minute: number) => timeLabel(minute).replace(/ (AM|PM)$/, "");
  return `${short(start)} to ${short(end)}`;
}

/** "Today: 1 PM to 10 PM, lunch 4 to 5, Central time", or "No shift today" (Central time, Emily, Nov 10). */
export function shiftLine(s: Pick<MyShiftToday, "blocks" | "off">): string {
  if (s.blocks.length === 0) return s.off ? MY_SHIFT_COPY.offToday : MY_SHIFT_COPY.noShift;
  return (
    "Today: " +
    s.blocks
      .map((b) => {
        const hours = `${timeLabel(b.start)} to ${timeLabel(b.end)}`;
        const lunch = b.lunchStart !== null && b.lunchEnd !== null ? `, lunch ${lunchLabel(b.lunchStart, b.lunchEnd)}` : "";
        return `${hours}${lunch}${b.covering ? " (covering)" : ""}`;
      })
      .join("; ") +
    ", Central time"
  );
}

/** The person's team for handoff defaults: the team of the coordinator role they work today. */
export function myTeamToday(s: Pick<MyShiftToday, "blocks">): string | null {
  for (const b of s.blocks) {
    const t = teamOf(b.roleCode);
    if (t === "guest_experience" || t === "property_operations") return t;
  }
  return null;
}

/**
 * The time handoffs are planned for: the end of today's shift when it is still
 * ahead (the person is then off the schedule, so routing picks the next person),
 * otherwise now. Lunch: the lunch start when it is still ahead.
 */
export function handoffAt(kind: "end_of_shift" | "lunch", s: MyShiftToday, now: Date = new Date()): string {
  const nowMs = now.getTime();
  const pick = (minutes: number[]) => {
    const future = minutes.map((m) => Date.parse(centralInstant(s.date, m))).filter((ms) => ms > nowMs).sort((a, b) => a - b);
    return future.length ? new Date(future[0]!).toISOString() : now.toISOString();
  };
  if (kind === "lunch") return pick(s.blocks.flatMap((b) => (b.lunchStart !== null ? [b.lunchStart] : [])));
  const ends = s.blocks.map((b) => b.end);
  if (!ends.length) return now.toISOString();
  // The end of the shift the person is in now, or the next one today.
  const nowMin = minuteNow(now);
  const current = s.blocks.find((b) => nowMin >= b.start && nowMin < b.end);
  return pick(current ? [current.end] : ends);
}

function minuteNow(now: Date): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return g("hour") * 60 + g("minute");
}

/** Register S1: the lunch question shows from 15 minutes before lunch until it ends. */
export const LUNCH_PROMPT_LEAD_MINUTES = 15;
export function lunchPrompt(s: MyShiftToday, now: Date = new Date()): { lunchStart: number; lunchEnd: number } | null {
  const m = minuteNow(now);
  for (const b of s.blocks) {
    if (b.lunchStart === null || b.lunchEnd === null) continue;
    if (m >= b.lunchStart - LUNCH_PROMPT_LEAD_MINUTES && m < b.lunchEnd) return { lunchStart: b.lunchStart, lunchEnd: b.lunchEnd };
  }
  return null;
}

/* ---------- the open work a person hands off ---------- */

export type HandoffTicket = NotionTicketLike & {
  id: string;
  ref?: number | null;
  title?: string | null;
  priority: string;
  status: string;
  functional_role_code?: string | null;
  import_hold?: string | null;
  handoff_status?: string | null;
  next_action?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
  assigned_to?: string | null;
  current_action_owner?: string | null;
  record_owner?: string | null;
  accountable_owner?: string | null;
  pending_handoff_to?: string | null;
};

const WAITING = new Set(["waiting", "awaiting_guest"]);

const dueMs = (t: HandoffTicket) => {
  const v = Date.parse(t.response_due_at ?? t.action_due_at ?? "");
  return Number.isFinite(v) ? v : null;
};

/**
 * Time sensitive Today: a Today ticket that is not waiting and whose clock
 * runs out before `untilMs` (or already has).
 */
export function isTimeSensitiveToday(t: HandoffTicket, untilMs: number): boolean {
  if (t.priority !== "p2" || WAITING.has(t.status)) return false;
  const d = dueMs(t);
  return d !== null && d <= untilMs;
}

export function isRightNow(t: HandoffTicket): boolean {
  return t.priority === "p1" && !WAITING.has(t.status);
}

/**
 * Every open ticket this person owns, Right now first, then time sensitive
 * Today, then the rest by due time. Tickets already waiting for someone to
 * accept them and quiet imports are left out.
 */
export function ticketsToHandOff(rows: HandoffTicket[], userId: string, untilMs: number, now: number = Date.now()): HandoffTicket[] {
  const rank = (t: HandoffTicket) => (isRightNow(t) ? 0 : isTimeSensitiveToday(t, untilMs) ? 1 : t.priority === "p1" ? 2 : t.priority === "p2" ? 3 : 4);
  return rows
    .filter(
      (t) =>
        OPEN_STATUSES.includes(t.status) &&
        currentOwnerId(t) === userId &&
        t.handoff_status !== "pending" &&
        !isImportHeld(t) &&
        !isQuietNotion(t, now),
    )
    .sort((a, b) => rank(a) - rank(b) || (dueMs(a) ?? Infinity) - (dueMs(b) ?? Infinity));
}

/** Register S1: before lunch only Right now and time sensitive Today work is asked about. */
export function urgentBeforeLunch(rows: HandoffTicket[], userId: string, lunchEndMs: number, now: number = Date.now()): HandoffTicket[] {
  return ticketsToHandOff(rows, userId, lunchEndMs, now).filter((t) => isRightNow(t) || isTimeSensitiveToday(t, lunchEndMs));
}

/* ---------- who gets it ---------- */

export type HandoffDefault = { team: string; user_id: string | null; role_code: string | null; note: string | null };

/** Receiver choices: a person by id, or a role that resolves to the person on shift in it. */
export const RECEIVER_ROLES: { value: string; label: string }[] = [
  { value: "role:coordinator", label: "Property Coordinator on shift" },
  ...Object.entries(COORDINATOR_ROLE_LABELS).map(([code, label]) => ({ value: `role:${code}`, label: `${label[0]!.toUpperCase()}${label.slice(1)} on shift` })),
  { value: "role:ops_supervisor", label: "Operations Supervisor" },
];

/** The default receiver for a ticket: the next person on shift on the ticket's team (else my team, else the Supervisor). */
export function defaultReceiver(t: Pick<HandoffTicket, "functional_role_code">, defaults: HandoffDefault[], myTeam: string | null): HandoffDefault | null {
  const team = (t.functional_role_code ? teamOf(t.functional_role_code) : null) ?? myTeam;
  const pick = defaults.find((d) => d.team === (team === "guest_experience" || team === "property_operations" ? team : "supervisor"));
  return pick && pick.user_id ? pick : (defaults.find((d) => d.team === "supervisor" && d.user_id) ?? null);
}

/** The default due time: the ticket's own next due when it is still ahead. */
export function defaultDue(t: HandoffTicket, now: number = Date.now()): string {
  const d = dueMs(t);
  return d !== null && d > now ? new Date(d).toISOString() : "";
}

export type HandoffDraft = { ticketId: string; receiver: string; done: string; nextStep: string; dueAt: string };

/** What end_my_shift receives for each ticket. */
export function itemFor(d: HandoffDraft): { ticket_id: string; to_user: string | null; to_role: string | null; done: string; next_step: string; due_at: string } {
  const isRole = d.receiver.startsWith("role:");
  return {
    ticket_id: d.ticketId,
    to_user: isRole ? null : d.receiver.replace(/^user:/, "") || null,
    to_role: isRole ? d.receiver.slice(5) : null,
    done: d.done.trim(),
    next_step: d.nextStep.trim(),
    due_at: d.dueAt ? new Date(d.dueAt).toISOString() : "",
  };
}

/** The first thing missing on a ticket, in the order the form asks. */
export function draftProblem(d: HandoffDraft): string | null {
  if (!d.receiver) return MY_SHIFT_COPY.needReceiver;
  if (!d.done.trim()) return MY_SHIFT_COPY.needDone;
  if (!d.nextStep.trim()) return MY_SHIFT_COPY.needNext;
  if (!d.dueAt) return MY_SHIFT_COPY.needDue;
  return null;
}

/* ---------- time off ---------- */

export const TIME_OFF_START_KEY = "time_off_requests_start";
export const TIME_OFF_START_DEFAULT = "2026-11-16";

export function timeOffStart(setting: unknown): string {
  const v = typeof setting === "string" ? setting : null;
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : TIME_OFF_START_DEFAULT;
}

export function timeOffOpen(setting: unknown, now: Date = new Date()): boolean {
  return centralToday(now) >= timeOffStart(setting);
}

export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

export function dateRangeLabel(from: string, to: string): string {
  return from === to ? dayLabel(from) : `${dayLabel(from)} to ${dayLabel(to)}`;
}

export type TimeOffRequest = { id: string; user_id: string; starts_on: string; ends_on: string; note: string | null; status: string; decision_note: string | null; created_at: string };

export function timeOffStatusLine(r: Pick<TimeOffRequest, "starts_on" | "ends_on" | "status" | "decision_note">): string {
  const when = dateRangeLabel(r.starts_on, r.ends_on);
  if (r.status === "approved") return `${when}: approved`;
  if (r.status === "declined") return `${when}: declined${r.decision_note ? `. ${r.decision_note}` : ""}`;
  return `${when}: waiting for the Operations Supervisor`;
}

/** My shift's words. Kept here so the word check can read every one of them. */
export const MY_SHIFT_COPY = {
  title: "My shift",
  hint: "Your hours today and who is on call tonight.",
  noShift: "No shift today",
  offToday: "Time off today",
  onCall: (name: string | null) => (name ? `On call tonight: ${name}` : "On call tonight: nobody is set"),
  requestTimeOff: "Request time off",
  timeOffNotYet: (start: string) => `Time off requests start ${dayLabel(start)}`,
  endShift: "End my shift",
  timeOffTitle: "Request time off",
  timeOffFirst: "First day off",
  timeOffLast: "Last day off",
  timeOffNote: "Note (optional)",
  timeOffSend: "Send to the Operations Supervisor",
  timeOffSent: "Sent. The Operations Supervisor will approve or decline it.",
  timeOffMine: "Your requests",
  walkTitle: "End my shift",
  walkHint: "Hand each open ticket to the next person on shift. You still own each one until it is accepted.",
  lunchTitle: "Hand off before lunch",
  lunchHint: "Hand Right now and time sensitive work to the person covering your lunch. You still own each one until it is accepted.",
  nothing: "Nothing to hand off",
  nothingOpen: "You have no open tickets. Nothing to hand off.",
  receiver: "Who gets it",
  next: "next on shift",
  done: "Done so far",
  nextStep: "Next step",
  due: "Due",
  confirm: (n: number) => (n === 1 ? "Hand off 1 ticket and end my shift" : `Hand off ${n} tickets and end my shift`),
  confirmLunch: (n: number) => (n === 1 ? "Hand off 1 ticket" : `Hand off ${n} tickets`),
  finish: "End my shift",
  ended: (n: number) =>
    n === 0
      ? "Your shift is ended. Nothing was handed off."
      : `Your shift is ended. ${n === 1 ? "1 handoff waits" : `${n} handoffs wait`} for Accept. You still own each until it is accepted.`,
  lunchDone: (n: number) => `${n === 1 ? "1 handoff waits" : `${n} handoffs wait`} for Accept. Enjoy your lunch.`,
  needReceiver: "Choose who gets it.",
  needDone: "Write what is done so far.",
  needNext: "Write the next step.",
  needDue: "Choose when it is due.",
  rightNow: "Right now",
  timeSensitive: "Time sensitive",
  lunchAsk: (start: number) => `Your lunch starts at ${timeLabel(start)}. Any Right now or time sensitive work? Hand it off first.`,
  lunchUrgent: (n: number) => (n === 1 ? "1 ticket needs someone while you are away." : `${n} tickets need someone while you are away.`),
  lunchClear: "Nothing Right now or time sensitive is open. Enjoy your lunch.",
  lunchHandOff: "Hand off before lunch",
  lunchSkip: "Nothing to hand off",
  lunchOk: "OK",
  timeOffNeedsYou: "Time off request",
  approve: "Approve and choose cover",
  decline: "Decline",
  declineReason: "Why is it declined?",
  declineConfirm: "Decline the request",
} as const;
