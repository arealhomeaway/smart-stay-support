/**
 * Home: the one page for a person's working day. Pure rules for the
 * "My work" tabs, search, board columns, the Team Queue unclaimed count and
 * the "Needs you now" items. Browser-safe and display-only: no clocks, owners
 * or statuses are changed here.
 */
import { isImportHeld } from "@/lib/import-hold";
import { currentOwnerId, isMine, type MatterOwnership } from "@/lib/matters";
import { isQuietNotion, isRecentOpenImport, type NotionTicketLike } from "@/lib/notion-ticket-display";
import { matchesPropertySearch, formatPropertyLabel, type PropertyLabelFields } from "@/lib/property-label";
import { OPEN_STATUSES, STATUSES, isClosed, slaState } from "@/lib/tickets";
import { TEAM_B, teamOf } from "@/lib/coverage-model";
import { automatedSourceOf } from "@/lib/automated-sources";

export type HomeTab = "active" | "waiting" | "done";

export const HOME_TABS: { value: HomeTab; label: string; empty: string }[] = [
  { value: "active", label: "Active", empty: "You are clear. Everything you own is moving." },
  { value: "waiting", label: "Waiting", empty: "Nothing of yours is waiting on someone else." },
  { value: "done", label: "Done recently", empty: "Nothing finished in the last 7 days yet." },
];

export const DONE_RECENT_DAYS = 7;

export type HomeTicket = MatterOwnership &
  NotionTicketLike & {
    id: string;
    ref?: number | null;
    title?: string | null;
    description?: string | null;
    guest_name?: string | null;
    priority: string;
    status: string;
    resolved_at?: string | null;
    closed_at?: string | null;
    import_hold?: string | null;
    functional_role_code?: string | null;
    handoff_status?: string | null;
    escalation_level?: string | null;
    acknowledged_at?: string | null;
    action_started_at?: string | null;
    response_due_at?: string | null;
    action_due_at?: string | null;
    properties?: PropertyLabelFields | null;
    work_types?: { name?: string | null } | null;
  };

/** Counts as Resolve work at all: not held on an import list, not a quiet Notion import. */
export function isResolveWork(t: HomeTicket, now: number = Date.now()): boolean {
  return !isImportHeld(t) && !isQuietNotion(t, now);
}

const WAITING = new Set(["waiting", "awaiting_guest"]);

/**
 * A recent open Notion import (past 30 days) assigned to this person. It shows
 * in their My work under Active with the "Imported from Notion" badge, but it
 * stays quiet: no clocks, no alerts, and it counts nowhere (unclaimed count,
 * Needs you now, Oversight, scorecards) until they press Take this ticket.
 */
export function isMyRecentImport(t: HomeTicket, userId: string | null, now: number = Date.now()): boolean {
  return !isImportHeld(t) && isRecentOpenImport(t, now) && isMine(t, userId);
}

export function inHomeTab(t: HomeTicket, tab: HomeTab, userId: string | null, now: number = Date.now()): boolean {
  if (isMyRecentImport(t, userId, now)) return tab === "active";
  if (!isResolveWork(t, now) || !isMine(t, userId)) return false;
  if (tab === "done") {
    if (!isClosed(t.status)) return false;
    const at = Date.parse(t.resolved_at ?? t.closed_at ?? "");
    return Number.isFinite(at) && now - at <= DONE_RECENT_DAYS * 86_400_000;
  }
  if (!OPEN_STATUSES.includes(t.status)) return false;
  return tab === "waiting" ? WAITING.has(t.status) : !WAITING.has(t.status);
}

/** Any keyword: reference, title, notes, guest, address, home name, work type or owner. */
export function homeSearchMatch(t: HomeTicket, query: string, ownerName?: string | null): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (t.properties && matchesPropertySearch(t.properties, q)) return true;
  const hay = [
    t.ref != null ? `#${t.ref}` : null,
    t.ref != null ? String(t.ref) : null,
    t.title,
    t.description,
    t.guest_name,
    formatPropertyLabel(t.properties).full,
    t.work_types?.name,
    ownerName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/** Board columns are statuses, in the usual order, showing only those the tab can hold. */
export function boardColumns(tab: HomeTab): { value: string; label: string }[] {
  const keep =
    tab === "done"
      ? (s: string) => isClosed(s)
      : tab === "waiting"
        ? (s: string) => WAITING.has(s)
        : (s: string) => OPEN_STATUSES.includes(s) && !WAITING.has(s);
  return STATUSES.filter((s) => keep(s.value)).map((s) => ({ value: s.value, label: s.label }));
}

/** The board column a row sits in. A recent import shown under Active always sits in Open. */
export function boardColumnOf(t: HomeTicket, tab: HomeTab, now: number = Date.now()): string {
  if (tab === "active" && isRecentOpenImport(t, now) && WAITING.has(t.status)) return "open";
  return t.status;
}

/** How urgent, in plain words: priority plus the live clock. Quiet imports have no clock. */
export function urgencyLabel(t: HomeTicket, now: number = Date.now()): string {
  const p = priorityMeta(t.priority ?? "p3").short;
  if (isClosed(t.status) || isQuietNotion(t, now)) return p;
  const sla = slaState(t);
  if (sla.escalation) return `${p} · Escalated`;
  if (sla.breached) return `${p} · Overdue`;
  const live = sla.response?.met === false ? sla.response : sla.action?.met === false ? sla.action : null;
  return live ? `${p} · ${live.label}` : p;
}

/**
 * The Team Queue count beside My work: open work nobody owns yet, on this
 * person's team. People without a home team (leaders) see the whole team's
 * count. Imported Notion tickets and held imports are never counted.
 */
export function unclaimedCount(
  rows: HomeTicket[],
  myTeam: string | null,
  now: number = Date.now(),
): number {
  return rows.filter((t) => {
    if (!isResolveWork(t, now)) return false;
    if (!OPEN_STATUSES.includes(t.status)) return false;
    if (currentOwnerId(t)) return false;
    if (!myTeam) return true;
    // A Breezeway ticket with no role belongs to Team B (register T15, automated-sources.ts).
    const team = t.functional_role_code
      ? teamOf(t.functional_role_code)
      : automatedSourceOf(t) === "breezeway" ? TEAM_B : null;
    return team === null || team === myTeam;
  }).length;
}

export type NeedsYouItem = {
  id: string;
  kind: "handoff" | "escalation" | "approval";
  title: string;
  detail: string;
  ticketId?: string;
};

/**
 * Decisions and items addressed to this person by name: a ticket handed to
 * them to accept, and their own escalated tickets. Never unowned Team Queue
 * work and never a quiet Notion import.
 */
export function needsYouNow(
  rows: HomeTicket[],
  userId: string | null,
  now: number = Date.now(),
): NeedsYouItem[] {
  if (!userId) return [];
  const out: NeedsYouItem[] = [];
  for (const t of rows) {
    if (!isResolveWork(t, now) || !OPEN_STATUSES.includes(t.status)) continue;
    const home = formatPropertyLabel(t.properties).full;
    if (t.handoff_status === "pending" && t.pending_handoff_to === userId) {
      out.push({ id: `handoff:${t.id}`, kind: "handoff", title: t.title ?? "Ticket", detail: `Handed to you to accept · ${home}`, ticketId: t.id });
      continue;
    }
    if (!isMine(t, userId) || t.pending_handoff_to === userId) continue;
    const escalated = (t.escalation_level && t.escalation_level !== "none") || Boolean(slaState(t).escalation);
    if (escalated) {
      out.push({ id: `escalation:${t.id}`, kind: "escalation", title: t.title ?? "Ticket", detail: `Escalated · ${home}`, ticketId: t.id });
    }
  }
  return out;
}

/** Routine work for a person's team, without the retired checkout kind. */
export const ROUTINE_SECTION_TITLE = "Routine work due today";
export const ROUTINE_SECTION_HINT = "Guest touch bases, guest reviews and work order reviews for your team.";

/** Home's words. Kept here so the word check can read every one of them. */
export const HOME_COPY = {
  heroLine: "Protect the stay. Own the outcome.",
  needsYouTitle: "Needs you now",
  needsYouHint: "Decisions and work handed to you by name.",
  needsYouEmpty: "Nothing is waiting on you right now.",
  myWorkTitle: "My work",
  myWorkHint: "The work you own, so every guest and every home is looked after.",
  searchPlaceholder: "Search by address, guest, ticket number or any word",
  teamQueueLink: (n: number) => `Team queue (${n} unclaimed)`,
  routineTitle: ROUTINE_SECTION_TITLE,
  routineHint: ROUTINE_SECTION_HINT,
  routineButton: "Record routine work",
  routineEmpty: "No routine checks due today.",
  importBadge: "Imported from Notion",
  importNext: "Open it and press Take this ticket to start",
  activityTitle: "Recent activity",
  activityEmpty: "Nothing has moved in your work yet today.",
} as const;
