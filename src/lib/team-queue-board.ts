/**
 * Team Queue board (Emily, Nov 7, 2026; register T6, T7, T12, T13, N4).
 *
 * The approved board's words, groups, order, late rules and alert lines. Pure and
 * browser-safe; the page and its groups only display what these return. Ticket routing,
 * clocks, SLAs and alerts are not decided here.
 */
import { TEAM_A, TEAM_B } from "@/lib/coverage-model";
import { localParts, shiftDate } from "@/lib/coverage";
import { URGENCY_NAMES } from "@/lib/tickets";
import { automatedQueueGroups, automatedTeam, type AutomatedSource, type AutomatedTicket } from "@/lib/automated-sources";

export type QueueScope = "a" | "b" | "all" | "unclaimed";
export const QUEUE_SCOPES: readonly QueueScope[] = ["a", "b", "all", "unclaimed"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const TEAM_QUEUE_COPY = {
  title: "Team Queue",
  subtitle: "Work nobody owns yet. Take what you can do.",
  chipsLabel: "Choose a team",
  chips: { a: "Team A", b: "Team B", all: "All teams", unclaimed: "All unclaimed" } as Record<QueueScope, string>,
  pickUp: "Pick up work",
  summary: (waiting: number, handoffs: number) =>
    [`${waiting} waiting for an owner`, handoffs ? plural(handoffs, "handoff waiting for you", "handoffs waiting for you") : null]
      .filter(Boolean)
      .join(" · "),
  empty: "Nothing is waiting for an owner in this team.",
  groups: {
    handoffs: "Handoffs waiting for you",
    email: "From email",
    breezeway: "From Breezeway",
    ownerrez: "From OwnerRez",
    notion: "Imported from Notion",
  },
  groupCount: (n: number, longest: string) => `${n} waiting · Longest: ${longest}`,
  // Build 16 C5 (register T7): no number on the quiet Notion group.
  notionCount: (_n?: number) => "Quiet · No clocks or alerts",
  show: "Show",
  hide: "Hide",
  notionTeams: { team_a: "Team A", team_b: "Team B", unassigned: "Unassigned" },
  sourceChip: { handoff: "Handoff", email: "Email", breezeway: "Breezeway", ownerrez: "OwnerRez", notion: "Notion" },
  guest: "Guest in the home",
  noHome: "No home found. Pick the home.",
  notionLine: "Imported from Notion. No clock.",
  waiting: (label: string) => `Waiting ${label}`,
  lateSuffix: "Late.",
  alert: {
    before: (sup: number, dir: number) => `If nobody takes it, a supervisor is alerted at ${sup} minutes and the director at ${dir}.`,
    supervisor: (dir: number) => `A supervisor has been alerted. The director is alerted at ${dir} minutes.`,
    both: "A supervisor and the director have been alerted.",
  },
  openBreezeway: "Open in Breezeway",
  nextStep: (s: string) => `Next step: ${s}`,
  take: "Take it",
  taking: "Taking…",
  took: "You took it.",
  accepted: "You accepted it.",
  declined: "Declined. It goes back with your reason.",
  openTicket: "Open ticket",
  giveBack: "Give it back",
  undo: "Undo",
  accept: "Accept",
  decline: "Decline",
  declineLabel: "Why can you not accept this?",
  declinePlaceholder: "Write a short reason",
  send: "Send",
  cancel: "Cancel",
  at: (type: string, home: string) => `${type} at ${home}`,
  alreadyTaken: "Someone else took it first.",
  notDone: "That did not go through. Try again.",
  everyone: "Everyone's work",
  otherViews: "Other views:",
  views: { list: "List", kanban: "Kanban", calendar: "Calendar" },
  owner: "Owner",
  allOwners: "All owners",
  noOwner: "No owner",
  urgent: "How urgent",
  any: "Any",
  home: "Home",
  allHomes: "All homes",
  problemType: "Problem type",
  allTypes: "All problem types",
  search: "Search by title or home",
  moreFilters: "More filters",
  clear: (n: number) => `Clear ${plural(n, "filter", "filters")}`,
  emptyList: "Nothing matches these filters.",
  due: (label: string) => `Due ${label}`,
  backToYou: (label: string) => `Back to you ${label}`,
  noDue: "No due time",
  history: {
    took: "Picked this ticket up.",
    gaveBack: "Gave it back to the Team Queue.",
    accepted: "Handoff accepted. The next step is now mine.",
    declined: (reason: string) => `Handoff declined: ${reason}`,
    undoDecline: "Took back the decline. The handoff is waiting again.",
    gaveBackHandoff: "Gave the handoff back. It is waiting again.",
  },
  notionTakeReason: "Taken from the Team Queue",
} as const;

export const URGENCY_ORDER: Record<string, number> = { p1: 0, p2: 1, p3: 2 };

export function urgencyName(priority: string | null | undefined): string {
  return URGENCY_NAMES[(priority ?? "p3") as keyof typeof URGENCY_NAMES] ?? URGENCY_NAMES.p3;
}

/** The board's chip colours, as design tokens. */
export function urgencyChipClass(priority: string | null | undefined): string {
  if (priority === "p1") return "bg-danger/12 text-danger";
  if (priority === "p2") return "bg-warning/20 text-warning-foreground";
  return "bg-muted text-foreground";
}

/** The viewer's team chip is selected first; people with no team start on All teams. */
export function defaultScope(myTeam: string | null): QueueScope {
  if (myTeam === TEAM_A) return "a";
  if (myTeam === TEAM_B) return "b";
  return "all";
}

export function parseScope(value: unknown, myTeam: string | null): QueueScope {
  return (QUEUE_SCOPES as readonly unknown[]).includes(value) ? (value as QueueScope) : defaultScope(myTeam);
}

export function scopeTeam(scope: QueueScope): string | null {
  return scope === "a" ? TEAM_A : scope === "b" ? TEAM_B : null;
}

/** A ticket in a team chip: that team's work, plus work with no team yet (anyone may take it). */
export function inScope(team: string | null, scope: QueueScope): boolean {
  const want = scopeTeam(scope);
  return !want || team === null || team === want;
}

/** The ticket's team, the same rule the automated groups use (role, else work type). */
export function ticketTeam(t: AutomatedTicket): string | null {
  return automatedTeam(t);
}

/** "12 minutes", "3 hours", "2 days". */
export function durationLabel(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return plural(m, "minute", "minutes");
  if (m < 48 * 60) return plural(Math.floor(m / 60), "hour", "hours");
  return plural(Math.floor(m / 1440), "day", "days");
}

export function minutesSince(iso: string | null | undefined, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 60_000);
}

/**
 * Team Queue timing (Emily, Nov 7, 2026), saved in app_settings `team_queue_timing` and read by
 * the minute alert check too, so a later edit needs no code change. Missing or bad values fall
 * back to the decided defaults.
 */
export type QueueTiming = {
  timezone: string;
  rightNowRedMinutes: number;
  supervisorMinutes: number;
  directorMinutes: number;
  todayDayEndMinute: number;
  todayNightEndMinute: number;
  todayRedBeforeMinutes: number;
  routineDefaultMinutes: number;
};

export const DEFAULT_QUEUE_TIMING: QueueTiming = {
  timezone: "America/Chicago",
  rightNowRedMinutes: 3,
  supervisorMinutes: 10,
  directorMinutes: 15,
  todayDayEndMinute: 17 * 60,
  todayNightEndMinute: 22 * 60,
  todayRedBeforeMinutes: 120,
  routineDefaultMinutes: 24 * 60,
};

function positive(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clockMinute(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : fallback;
}

/** The saved setting (and the coverage time zone) as complete timing. */
export function readQueueTiming(value: unknown, timezone?: string | null): QueueTiming {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const d = DEFAULT_QUEUE_TIMING;
  return {
    timezone: timezone || d.timezone,
    rightNowRedMinutes: positive(v["right_now_red_minutes"], d.rightNowRedMinutes),
    supervisorMinutes: positive(v["supervisor_minutes"], d.supervisorMinutes),
    directorMinutes: positive(v["director_minutes"], d.directorMinutes),
    todayDayEndMinute: clockMinute(v["today_day_shift_ends"], d.todayDayEndMinute),
    todayNightEndMinute: clockMinute(v["today_night_shift_ends"], d.todayNightEndMinute),
    todayRedBeforeMinutes: positive(v["today_red_minutes_before"], d.todayRedBeforeMinutes),
    routineDefaultMinutes: positive(v["routine_default_hours"], d.routineDefaultMinutes / 60) * 60,
  };
}

/** The day a moment belongs to: after the night shift ends it counts as the next day. */
function workDay(at: Date, t: QueueTiming): string {
  const p = localParts(at, t.timezone);
  return p.minutes >= t.todayNightEndMinute ? shiftDate(p.date, 1) : p.date;
}

/** When a ticket started waiting for an owner: the saved wait start, else when it arrived. */
export function queueSince(t: { unowned_since?: string | null; reported_at?: string | null }): string | null {
  return t.unowned_since ?? t.reported_at ?? null;
}

/**
 * Red on screen (Emily, Nov 7, 2026):
 * - Right now: at 3 minutes waiting.
 * - Today: in the 2 hours before the day shift ends (3 PM to 5 PM) and again in the 2 hours
 *   before the night shift ends (8 PM to 10 PM); always once its day has passed.
 * - Routine: once it passes its problem type's start standard (a work order review: 24 hours),
 *   else 24 hours.
 */
export function isLate(
  priority: string | null | undefined,
  since: string | null | undefined,
  now: Date,
  timing: QueueTiming = DEFAULT_QUEUE_TIMING,
  standardMinutes?: number | null,
): boolean {
  if (!since) return false;
  const mins = minutesSince(since, now);
  if (priority === "p1") return mins >= timing.rightNowRedMinutes;
  if (priority === "p2") {
    if (workDay(new Date(since), timing) < workDay(now, timing)) return true;
    const m = localParts(now, timing.timezone).minutes;
    const inWindow = (end: number) => m >= end - timing.todayRedBeforeMinutes && m < end;
    return inWindow(timing.todayDayEndMinute) || inWindow(timing.todayNightEndMinute);
  }
  const standard = standardMinutes && standardMinutes > 0 ? standardMinutes : timing.routineDefaultMinutes;
  return mins > standard;
}

export function waitLine(since: string | null | undefined, now: Date, late: boolean): string {
  const base = TEAM_QUEUE_COPY.waiting(durationLabel(minutesSince(since, now)));
  return late ? `${base}. ${TEAM_QUEUE_COPY.lateSuffix}` : base;
}

/** Which Team Queue alerts the minute check has already sent for this wait. */
export type SentAlerts = { supervisor: boolean; director: boolean };

/**
 * The alert line under a Right now row, from the alerts the minute check has recorded for the
 * ticket's current wait (ticket_timed_alerts), never from a manual escalation.
 */
export function alertLine(
  priority: string | null | undefined,
  sent: SentAlerts | null | undefined,
  timing: QueueTiming = DEFAULT_QUEUE_TIMING,
): string | null {
  if (priority !== "p1") return null;
  if (sent?.director) return TEAM_QUEUE_COPY.alert.both;
  if (sent?.supervisor) return TEAM_QUEUE_COPY.alert.supervisor(timing.directorMinutes);
  return TEAM_QUEUE_COPY.alert.before(timing.supervisorMinutes, timing.directorMinutes);
}

/** Groups the recorded alerts by ticket, keeping only those for the ticket's current wait. */
export function sentAlertsFor(
  rows: { ticket_id: string; kind: string; episode_at: string }[],
  since: string | null | undefined,
  ticketId: string,
): SentAlerts {
  const at = since ? Date.parse(since) : NaN;
  const mine = rows.filter((r) => r.ticket_id === ticketId && Date.parse(r.episode_at) === at);
  return {
    supervisor: mine.some((r) => r.kind === "team_queue_supervisor"),
    director: mine.some((r) => r.kind === "team_queue_director"),
  };
}

/** Inside a group: urgency, then the viewer's own team first, then longest waiting. */
export function sortPickRows<T>(
  rows: T[],
  read: (row: T) => { priority?: string | null; team: string | null; since?: string | null },
  myTeam: string | null,
): T[] {
  return [...rows].sort((x, y) => {
    const a = read(x);
    const b = read(y);
    const u = (URGENCY_ORDER[a.priority ?? "p3"] ?? 3) - (URGENCY_ORDER[b.priority ?? "p3"] ?? 3);
    if (u) return u;
    if (myTeam) {
      const t = (a.team === myTeam ? 0 : 1) - (b.team === myTeam ? 0 : 1);
      if (t) return t;
    }
    return (a.since ?? "9999").localeCompare(b.since ?? "9999");
  });
}

export function groupCountLine(sinces: (string | null | undefined)[], now: Date): string {
  const longest = Math.max(0, ...sinces.map((s) => minutesSince(s, now)));
  return TEAM_QUEUE_COPY.groupCount(sinces.length, durationLabel(longest));
}

/** Board order of the source groups after Handoffs waiting for you. */
export const SOURCE_GROUP_ORDER: readonly AutomatedSource[] = ["email", "breezeway", "ownerrez"];

/**
 * Every ticket waiting in a source group, with its team and source, from the one rule in
 * automated-sources.ts (open, nobody owns it, not archived, from the info inbox, OwnerRez
 * or Breezeway).
 */
export function automatedWaiting<T extends AutomatedTicket>(rows: T[]): { row: T; team: string | null; source: AutomatedSource }[] {
  return automatedQueueGroups(rows).flatMap((g) =>
    g.sources.flatMap((s) => s.rows.map((row) => ({ row, team: g.team, source: s.source }))),
  );
}

/** The source groups for one chip, in board order, each sorted as drawn. Empty groups drop out. */
export function sourceGroups<T extends AutomatedTicket & { priority?: string | null }>(
  rows: T[],
  scope: QueueScope,
  myTeam: string | null,
): { source: AutomatedSource; rows: { row: T; team: string | null }[] }[] {
  const waiting = automatedWaiting(rows).filter((w) => inScope(w.team, scope));
  return SOURCE_GROUP_ORDER.map((source) => ({
    source,
    rows: sortPickRows(
      waiting.filter((w) => w.source === source),
      (w) => ({ priority: w.row.priority ?? null, team: w.team, since: queueSince(w.row) }),
      myTeam,
    ),
  })).filter((g) => g.rows.length > 0);
}

/**
 * Chip counts: how many wait for an owner in each chip. Team chips and All teams count the
 * automated groups (and overnight Direct Bookings for people who work them, Team A); All
 * unclaimed counts every open ticket nobody owns. Imported Notion tickets never count.
 */
export function chipCounts(input: {
  automatedTeams: (string | null)[];
  unownedTeams: (string | null)[];
  overnight: number;
}): Record<QueueScope, number> {
  const a = input.automatedTeams.filter((t) => inScope(t, "a")).length + input.overnight;
  const b = input.automatedTeams.filter((t) => inScope(t, "b")).length;
  return {
    a,
    b,
    all: input.automatedTeams.length + input.overnight,
    unclaimed: input.unownedTeams.length + input.overnight,
  };
}

/** Who a handoff came from and where it goes, with roles and teams only. */
export function handoffFromLine(fromTeam: string | null, toTeam: string | null): string {
  const label = (t: string | null) => (t === TEAM_A ? "Team A" : t === TEAM_B ? "Team B" : null);
  const from = label(fromTeam);
  const to = label(toTeam);
  const who = from ? "a coordinator" : "a teammate";
  return from && to ? `From ${who}, ${from} to ${to}.` : `From ${who}.`;
}

export type HandoffQueueRow = {
  id: string;
  ticket_id: string;
  from_user: string | null;
  to_user: string | null;
  to_role_code: string | null;
  priority: string | null;
  next_action: string | null;
  created_at: string;
  status: string;
  ticket: (AutomatedTicket & { is_demo?: boolean | null; priority?: string | null }) | null;
};

/**
 * Handoffs waiting for you: pending, offered to you by name or to a role you hold now
 * (a handoff to a role goes to the person in that role, T6), never your own request, on an
 * open ticket that is not archived. Oldest first.
 */
export function handoffsForMe<T extends HandoffQueueRow>(
  rows: T[],
  userId: string | null,
  myRoleCodes: ReadonlySet<string>,
  demoMode: boolean,
  openStatuses: readonly string[],
): T[] {
  if (!userId) return [];
  return rows
    .filter((h) => {
      if (h.status !== "pending" || !h.ticket) return false;
      if (h.from_user === userId) return false;
      const forMe = h.to_user === userId || (!h.to_user && !!h.to_role_code && myRoleCodes.has(h.to_role_code));
      if (!forMe) return false;
      if (h.ticket.archived_at) return false;
      if (Boolean(h.ticket.is_demo) !== demoMode) return false;
      return openStatuses.includes(h.ticket.status);
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function declineReasonOk(reason: string): boolean {
  const r = reason.trim();
  return r.length > 0 && r.length <= 500;
}

/** What Give it back writes after Take it: the owners as they were, only while still mine. */
export function giveBackPatch(before: {
  record_owner?: string | null;
  accountable_owner?: string | null;
  assignment_source?: string | null;
  assignment_note?: string | null;
}) {
  return {
    assigned_to: null,
    current_action_owner: null,
    record_owner: before.record_owner ?? null,
    accountable_owner: before.accountable_owner ?? null,
    assignment_source: before.assignment_source ?? null,
    assignment_note: before.assignment_note ?? null,
  };
}

/** Everyone's work: the due line, or when a waiting ticket comes back. */
export function dueLine(
  t: { status: string; next_review_at?: string | null; next_action_due_at?: string | null; action_due_at?: string | null; response_due_at?: string | null; due_at?: string | null },
  format: (iso: string) => string,
): string {
  if (t.status === "waiting" && t.next_review_at) return TEAM_QUEUE_COPY.backToYou(format(t.next_review_at));
  const due = t.next_action_due_at ?? t.action_due_at ?? t.response_due_at ?? t.due_at ?? null;
  return due ? TEAM_QUEUE_COPY.due(format(due)) : TEAM_QUEUE_COPY.noDue;
}
