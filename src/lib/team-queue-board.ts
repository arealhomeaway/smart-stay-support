/**
 * Team Queue board (Emily, Nov 7, 2026; register T6, T7, T12, T13, N4).
 *
 * The approved board's words, groups, order, late rules and alert lines. Pure and
 * browser-safe; the page and its groups only display what these return. Ticket routing,
 * clocks, SLAs and alerts are not decided here.
 */
import { TEAM_A, TEAM_B } from "@/lib/coverage-model";
import { localParts, isConfigured, type CoverageConfig } from "@/lib/coverage";
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
  notionCount: (n: number) => `${n} quiet · No clocks or alerts`,
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
    before: "If nobody takes it, a supervisor is alerted at 10 minutes and the director at 15.",
    supervisor: "A supervisor has been alerted. The director is alerted at 15 minutes.",
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
 * Late, as drawn: Right now at 3 minutes; Today when the shift is ending; Routine past
 * 24 hours. "The shift is ending" is the last 30 minutes before the after-hours window in
 * the coverage settings (today 9:30 PM), or any later day. With no window saved, Today is
 * never shown late.
 */
export const TODAY_LATE_BEFORE_WINDOW_MINUTES = 30;

export function isLate(
  priority: string | null | undefined,
  since: string | null | undefined,
  now: Date,
  cfg: CoverageConfig | null | undefined,
): boolean {
  if (!since) return false;
  const mins = minutesSince(since, now);
  if (priority === "p1") return mins >= 3;
  if (priority === "p2") {
    if (!isConfigured(cfg)) return false;
    const a = localParts(new Date(since), cfg.timezone);
    const b = localParts(now, cfg.timezone);
    if (a.date < b.date) return true;
    return b.minutes >= cfg.after_hours_start_minute - TODAY_LATE_BEFORE_WINDOW_MINUTES;
  }
  return mins > 24 * 60;
}

export function waitLine(since: string | null | undefined, now: Date, late: boolean): string {
  const base = TEAM_QUEUE_COPY.waiting(durationLabel(minutesSince(since, now)));
  return late ? `${base}. ${TEAM_QUEUE_COPY.lateSuffix}` : base;
}

/** The alert line under a Right now row, from what has already happened to the ticket. */
export function alertLine(priority: string | null | undefined, escalationLevel: string | null | undefined): string | null {
  if (priority !== "p1") return null;
  const level = (escalationLevel ?? "none").toLowerCase();
  if (level === "none" || level === "") return TEAM_QUEUE_COPY.alert.before;
  if (level === "supervisor") return TEAM_QUEUE_COPY.alert.supervisor;
  return TEAM_QUEUE_COPY.alert.both;
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
      (w) => ({ priority: w.row.priority ?? null, team: w.team, since: w.row.reported_at ?? null }),
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
