/**
 * Oversight, Shift handoffs (Admin, Nov 16). Pure and browser-safe: who was on shift (the
 * coverage schedule with that day's cover and time off), when each coordinator pressed End my
 * shift, missed shift ends, and every handoff with its status. It only reads rows the page
 * loads under the existing access rules; it never writes. Handoffs are still written only by
 * end_my_shift (End my shift, lunch) and the ticket's Hand off action.
 */
import { COORDINATOR_ROLE_LABELS, TEAM_A, TEAM_B, teamOf } from "@/lib/coverage-model";
import { currentOwnerId } from "@/lib/matters";
import { isQuietNotion } from "@/lib/notion-ticket-display";
import { OPEN_STATUSES } from "@/lib/tickets";
import { addDays, cellBlocks, centralDate, centralInstant, centralToday, type SOverride, type SShift } from "@/lib/team-schedule";

export const SH_COORDINATOR_CODES = ["ge_day", "ge_evening", "ge_parttime", "po_day", "po_evening"] as const;
/** Register: a waiting Right now handoff is late after 15 minutes. */
export const SH_RIGHT_NOW_LATE_MINUTES = 15;
export const SH_DAYS = 14;

export type SHTeam = "all" | "A" | "B";
export const SH_TEAMS: { value: SHTeam; label: string }[] = [
  { value: "all", label: "All teams" },
  { value: "A", label: "Team A" },
  { value: "B", label: "Team B" },
];
const TEAM_CODE: Record<Exclude<SHTeam, "all">, string> = { A: TEAM_A, B: TEAM_B };

export type SHRole = { code: string; name: string | null; current_seat_holder: string | null; active?: boolean | null };
export type SHEndRecord = {
  id: string;
  user_id: string;
  kind: string;
  ended_at: string;
  nothing_to_hand_off: boolean;
  handoff_ids: string[] | null;
  is_demo: boolean;
};
export type SHTicket = {
  id: string;
  status: string;
  is_demo: boolean;
  archived_at?: string | null;
  current_action_owner?: string | null;
  assigned_to?: string | null;
  record_owner?: string | null;
  accountable_owner?: string | null;
  external_source?: string | null;
  external_status?: string | null;
  reported_at?: string | null;
  import_hold?: string | null;
};
export type SHHandoff = {
  id: string;
  ticket_id: string;
  from_user: string | null;
  to_user: string | null;
  to_role_code: string | null;
  handoff_type: string | null;
  priority: string | null;
  actions_completed: string | null;
  current_status: string | null;
  next_action: string | null;
  due_at: string | null;
  status: string;
  responded_at: string | null;
  response_reason: string | null;
  accepted_at: string | null;
  created_at: string;
  is_demo: boolean;
  ticket: { id: string; ref: number | null; title: string | null; priority: string | null; is_demo: boolean; functional_role_code: string | null } | null;
};
export type SHInput = {
  roles: SHRole[];
  shifts: SShift[];
  overrides: SOverride[];
  records: SHEndRecord[];
  handoffs: SHHandoff[];
  tickets: SHTicket[];
};

export const SH_COPY = {
  title: "Shift handoffs",
  hint: "Who was on shift, who ended their shift, and every handoff still waiting.",
  date: "Date",
  team: "Team",
  missedTitle: "Missed shift ends",
  missedHint: "The shift is over but End my shift was not pressed.",
  missedNone: "No missed shift ends.",
  lateTitle: "Right now handoffs waiting too long",
  shiftsTitle: "Shifts",
  shiftsNone: "No coordinator shifts on this day.",
  handoffsTitle: "Handoffs",
  handoffsNone: "No handoffs on this day.",
  nothing: "Nothing to hand off",
  notYet: "Not yet",
  onShift: "On shift",
  later: "Later today",
  missed: "Missed",
  cover: "cover",
  done: "Done so far",
  next: "Next step",
  due: "Due",
  from: "From",
  to: "To",
  asked: "Asked",
  openTicket: "Open ticket",
  error: "Shift handoffs could not load.",
  tryAgain: "Try again",
} as const;

/* ---------- words ---------- */

const LEAD_LABELS: Record<string, string> = {
  ops_supervisor: "Operations Supervisor",
  director_ops: "Director of Operations",
};

/** A role's plain name. Never a person's name, never a code, never a long dash. */
export function roleLabel(code: string | null | undefined, roles: SHRole[] = []): string {
  if (!code) return "Teammate";
  const plain = COORDINATOR_ROLE_LABELS[code] ?? LEAD_LABELS[code];
  if (plain) return plain.charAt(0).toUpperCase() + plain.slice(1);
  const name = roles.find((r) => r.code === code)?.name;
  return name ? name.replace(/\s*[\u2014\u2013]\s*/g, ", ") : "Teammate";
}

const TIME = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
const DAY_TIME = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
/** "3:05 PM", Central time. */
export function centralTime(iso: string | null | undefined): string {
  return iso ? TIME.format(new Date(iso)) : "";
}
/** "Nov 16, 3:05 PM", Central time. */
export function centralDayTime(iso: string | null | undefined): string {
  return iso ? DAY_TIME.format(new Date(iso)) : "";
}
/** "1 PM to 10 PM" from minutes after midnight, Central. */
export function hoursLabel(start: number, end: number): string {
  const t = (m: number) => {
    const mm = ((m % 1440) + 1440) % 1440;
    const h = Math.floor(mm / 60);
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}${mm % 60 ? `:${String(mm % 60).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
  };
  return `${t(start)} to ${t(end)}`;
}
/** "42 min", "2 h 5 min". */
export function minutesLabel(min: number): string {
  const m = Math.max(0, Math.floor(min));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** The date choices: today and the 13 days before it, newest first. */
export function dateChoices(now: Date = new Date()): { value: string; label: string }[] {
  const today = centralToday(now);
  return Array.from({ length: SH_DAYS }, (_, i) => {
    const d = addDays(today, -i);
    const [y, m, day] = d.split("-").map(Number);
    const pretty = new Date(Date.UTC(y!, m! - 1, day!)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
    return { value: d, label: i === 0 ? `Today, ${pretty}` : i === 1 ? `Yesterday, ${pretty}` : pretty };
  });
}

/* ---------- shifts ---------- */

export type SHPersonDay = {
  userId: string;
  roleCodes: string[];
  roleLabel: string;
  team: string | null;
  start: number;
  end: number;
  endsAt: string;
  covering: boolean;
  state: "ended" | "missed" | "on_shift" | "later";
  endedAt: string | null;
  handedOff: number;
  nothing: boolean;
  openOwned: number;
};

const holderOf = (roles: SHRole[], code: string) => roles.find((r) => r.code === code && r.active !== false)?.current_seat_holder ?? null;

/** Who worked which coordinator roles on a date, from the schedule with that day's cover and time off. */
function peopleOn(input: Pick<SHInput, "roles" | "shifts" | "overrides">, date: string) {
  const byPerson = new Map<string, { codes: string[]; start: number; end: number; covering: boolean }>();
  for (const code of SH_COORDINATOR_CODES) {
    if (!input.roles.some((r) => r.code === code && r.active !== false)) continue;
    for (const b of cellBlocks(code, date, input.shifts, input.overrides)) {
      const person = b.coverUserId ?? (b.out ? null : holderOf(input.roles, code));
      if (!person) continue;
      const cur = byPerson.get(person);
      if (cur) {
        if (!cur.codes.includes(code)) cur.codes.push(code);
        cur.start = Math.min(cur.start, b.start);
        cur.end = Math.max(cur.end, b.end);
        cur.covering = cur.covering || Boolean(b.coverUserId);
      } else byPerson.set(person, { codes: [code], start: b.start, end: b.end, covering: Boolean(b.coverUserId) });
    }
  }
  return byPerson;
}

/** Each coordinator on shift on a date, with End my shift and the open tickets they still own. */
export function shiftsOn(input: SHInput, date: string, demo: boolean, now: Date = new Date()): SHPersonDay[] {
  const byPerson = peopleOn(input, date);
  const nowMs = now.getTime();
  const open = openOwnedBy(input.tickets, demo, nowMs);
  const out: SHPersonDay[] = [];
  for (const [userId, p] of byPerson) {
    const ends = input.records.filter(
      (r) => r.user_id === userId && r.kind === "end_of_shift" && r.is_demo === demo && centralDate(r.ended_at) === date,
    );
    const last = ends.sort((a, b) => b.ended_at.localeCompare(a.ended_at))[0] ?? null;
    const handedOff = ends.reduce((n, r) => n + (r.handoff_ids?.length ?? 0), 0);
    const endsAt = centralInstant(date, p.end);
    const startsAt = Date.parse(centralInstant(date, p.start));
    const state: SHPersonDay["state"] = last ? "ended" : nowMs >= Date.parse(endsAt) ? "missed" : nowMs >= startsAt ? "on_shift" : "later";
    out.push({
      userId,
      roleCodes: p.codes,
      roleLabel: p.codes.map((c) => roleLabel(c, input.roles)).join(" and "),
      team: teamOf(p.codes[0]!),
      start: p.start,
      end: p.end,
      endsAt,
      covering: p.covering,
      state,
      endedAt: last?.ended_at ?? null,
      handedOff,
      nothing: Boolean(last) && handedOff === 0 && ends.some((r) => r.nothing_to_hand_off),
      openOwned: open.get(userId) ?? 0,
    });
  }
  return out.sort((a, b) => a.start - b.start || a.roleLabel.localeCompare(b.roleLabel));
}

/** Open tickets each person still owns, in this lens. Quiet Notion imports are not work yet. */
export function openOwnedBy(tickets: SHTicket[], demo: boolean, now: number = Date.now()): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tickets) {
    if (t.is_demo !== demo || t.archived_at || !OPEN_STATUSES.includes(t.status) || isQuietNotion(t, now)) continue;
    const owner = currentOwnerId(t);
    if (owner) m.set(owner, (m.get(owner) ?? 0) + 1);
  }
  return m;
}

/* ---------- handoffs ---------- */

export type SHKind = "end_of_shift" | "lunch" | "hand_off";
export const SH_KIND_LABEL: Record<SHKind, string> = { end_of_shift: "End my shift", lunch: "Lunch", hand_off: "Hand off" };

export type SHRow = {
  id: string;
  ticketId: string;
  ticketRef: number | null;
  ticketTitle: string;
  kind: SHKind;
  fromLabel: string;
  toLabel: string;
  team: string | null;
  createdAt: string;
  status: "waiting" | "accepted" | "declined";
  statusText: string;
  minutesWaited: number;
  late: boolean;
  priority: string;
  done: string | null;
  next: string | null;
  dueAt: string | null;
};

/** Which way a handoff was made: End my shift, lunch, or the ticket's Hand off action. */
export function handoffKind(h: Pick<SHHandoff, "id" | "handoff_type" | "current_status">, records: SHEndRecord[]): SHKind {
  const rec = records.find((r) => (r.handoff_ids ?? []).includes(h.id));
  if (rec) return rec.kind === "lunch" ? "lunch" : "end_of_shift";
  if (h.handoff_type === "shift_coverage" && h.current_status === "Handed off before lunch") return "lunch";
  if (h.handoff_type === "shift_coverage" && h.current_status === "Handed off at the end of a shift") return "end_of_shift";
  return "hand_off";
}

const handoffDemo = (h: SHHandoff) => h.ticket?.is_demo ?? h.is_demo;

/** The role a person worked that day, else the role they hold. */
function personRole(input: SHInput, userId: string | null, date: string): string | null {
  if (!userId) return null;
  const day = peopleOn(input, date).get(userId);
  if (day) return day.codes[0] ?? null;
  return input.roles.find((r) => r.active !== false && r.current_seat_holder === userId)?.code ?? null;
}

export function handoffRow(input: SHInput, h: SHHandoff, now: Date = new Date()): SHRow {
  const date = centralDate(h.created_at);
  const fromCode = personRole(input, h.from_user, date);
  const toCode = h.to_role_code ?? personRole(input, h.to_user, date);
  const minutesWaited = (now.getTime() - Date.parse(h.created_at)) / 60_000;
  const priority = h.priority ?? h.ticket?.priority ?? "p3";
  const status: SHRow["status"] = h.status === "accepted" ? "accepted" : h.status === "rejected" || h.status === "declined" ? "declined" : "waiting";
  const statusText =
    status === "waiting"
      ? `Waiting ${minutesLabel(minutesWaited)}`
      : status === "accepted"
        ? `Accepted ${centralDayTime(h.accepted_at ?? h.responded_at)}`.trim()
        : `Declined${h.response_reason ? `: ${h.response_reason}` : ""}`;
  return {
    id: h.id,
    ticketId: h.ticket_id,
    ticketRef: h.ticket?.ref ?? null,
    ticketTitle: h.ticket?.title ?? "Ticket",
    kind: handoffKind(h, input.records),
    fromLabel: roleLabel(fromCode, input.roles),
    toLabel: roleLabel(toCode, input.roles),
    team: teamOf(h.ticket?.functional_role_code ?? "") ?? teamOf(h.to_role_code ?? "") ?? (fromCode ? teamOf(fromCode) : null),
    createdAt: h.created_at,
    status,
    statusText,
    minutesWaited,
    late: status === "waiting" && priority === "p1" && minutesWaited > SH_RIGHT_NOW_LATE_MINUTES,
    priority,
    done: h.actions_completed,
    next: h.next_action,
    dueAt: h.due_at,
  };
}

const teamMatch = (team: SHTeam, t: string | null) => team === "all" || t === TEAM_CODE[team];

/**
 * The handoffs for a date in this lens. On today, every handoff still waiting shows too,
 * whatever day it was asked. Late Right now handoffs first, then the rest still waiting
 * (oldest first), then answered ones (newest first).
 */
export function handoffsOn(input: SHInput, date: string, team: SHTeam, demo: boolean, now: Date = new Date()): SHRow[] {
  const today = centralToday(now);
  const rows = input.handoffs
    .filter((h) => handoffDemo(h) === demo)
    .filter((h) => centralDate(h.created_at) === date || (date === today && h.status === "pending"))
    .map((h) => handoffRow(input, h, now))
    .filter((r) => teamMatch(team, r.team));
  const rank = (r: SHRow) => (r.late ? 0 : r.status === "waiting" ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b) || (rank(a) < 2 ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
}

export type SHView = { shifts: SHPersonDay[]; missed: SHPersonDay[]; late: SHRow[]; handoffs: SHRow[] };

export function shiftHandoffsView(input: SHInput, opts: { date: string; team: SHTeam; demo: boolean; now?: Date }): SHView {
  const now = opts.now ?? new Date();
  const shifts = shiftsOn(input, opts.date, opts.demo, now).filter((p) => teamMatch(opts.team, p.team));
  const handoffs = handoffsOn(input, opts.date, opts.team, opts.demo, now);
  return {
    shifts,
    missed: shifts.filter((p) => p.state === "missed").sort((a, b) => a.endsAt.localeCompare(b.endsAt)),
    late: handoffs.filter((r) => r.late),
    handoffs: handoffs.filter((r) => !r.late),
  };
}

/** The Oversight menu count and Needs you now rows: every waiting handoff and today's missed shift ends. */
export function shiftHandoffCounts(input: SHInput, demo: boolean, now: Date = new Date()): { waiting: number; late: number; missed: number; total: number } {
  const waitingRows = input.handoffs.filter((h) => handoffDemo(h) === demo && h.status === "pending").map((h) => handoffRow(input, h, now));
  const missed = shiftsOn(input, centralToday(now), demo, now).filter((p) => p.state === "missed").length;
  return { waiting: waitingRows.length, late: waitingRows.filter((r) => r.late).length, missed, total: waitingRows.length + missed };
}

export function shiftHandoffsSince(now: Date = new Date()): string {
  return centralInstant(addDays(centralToday(now), -(SH_DAYS - 1)), 0);
}

/** "1 handoff waiting to be accepted" / "2 missed shift ends today". */
export function waitingLine(n: number): string {
  return `${n} handoff${n === 1 ? "" : "s"} waiting to be accepted`;
}
export function missedLine(n: number): string {
  return `${n} missed shift end${n === 1 ? "" : "s"} today`;
}
