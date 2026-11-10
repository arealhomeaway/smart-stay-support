/**
 * Databases, Tickets: the tabs across the top and the filters every tab shares
 * (Emily, Nov 9; register P3, N2, N4, T12, C1). Pure and browser-safe.
 *
 * One rule for every tab:
 * - The original created date is the Notion created date for imported tickets
 *   (stored as reported_at by the import) and the created date for the rest.
 *   Recent, Period and the date sort all read it.
 * - Older open and Closed history follow notionTicketState, the same rule the
 *   badges, the Team Queue and the quiet rule use, so a tab never disagrees
 *   with the label on the ticket.
 * - Closed history never shows an owner (N2): the row's owner cell is already
 *   blank for every untouched import (showsAssignee).
 */
import {
  ALL,
  CLAIMS_TO_WORK_FILTER,
  claimTotals,
  inPeriod,
  money,
  normalize,
  rowText,
  type DbRow,
  type Period,
} from "@/lib/databases";
import { OPEN_STATUSES } from "@/lib/tickets";
import { NOTION_RECENT_DAYS, notionTicketState } from "@/lib/notion-ticket-display";

export type TicketTabKey = "all" | "recent" | "older_open" | "closed_history" | "needs_home" | "claims_history";

export const TICKET_TABS: { key: TicketTabKey; label: string; empty: string }[] = [
  { key: "all", label: "All", empty: "No tickets yet." },
  { key: "recent", label: "Recent", empty: "No open tickets from the past 30 days." },
  { key: "older_open", label: "Older open", empty: "No older open tickets from Notion." },
  { key: "closed_history", label: "Closed history", empty: "No closed tickets from Notion." },
  { key: "needs_home", label: "Needs a home", empty: "Every ticket has its home." },
  { key: "claims_history", label: "Claims history", empty: "No tickets with a claim." },
];

export const TICKET_TAB_DEFAULT: TicketTabKey = "all";

/** The label each tab's rows carry (N2). */
export const OLDER_OPEN_LABEL = "Older open ticket from Notion";
export const HISTORICAL_LABEL = "Historical record from Notion";

/** What the tabs read from a ticket row. */
export type TicketFacts = {
  status: string;
  external_source: string | null;
  external_status: string | null;
  external_id: string | null;
  reported_at: string | null;
  created_at: string;
  import_hold: string | null;
  property_id: string | null;
  /** The linked claim (one per ticket), when there is one. */
  claim: TicketClaim | null;
};

export type TicketClaim = {
  amount: number | null;
  paidBack: number | null;
  status: string;
  open: boolean;
  /** The claim's original date (an imported claim keeps its Notion created date). */
  openedAt: string;
};

/** The Notion created date for imports, the created date for everything else. */
export function originalCreatedAt(t: Pick<TicketFacts, "external_source" | "reported_at" | "created_at">): string {
  return t.external_source === "notion" && t.reported_at ? t.reported_at : t.created_at;
}

export function isOpenTicket(status: string): boolean {
  return OPEN_STATUSES.includes(status);
}

/** Whether a ticket belongs on a tab. */
export function inTicketTab(tab: TicketTabKey, t: TicketFacts, now: number = Date.now()): boolean {
  switch (tab) {
    case "all":
      return true;
    case "recent": {
      if (!isOpenTicket(t.status)) return false;
      const at = Date.parse(originalCreatedAt(t));
      return Number.isFinite(at) && now - at <= NOTION_RECENT_DAYS * 86_400_000;
    }
    case "older_open":
      return notionTicketState(t, now) === "older_open";
    case "closed_history":
      return notionTicketState(t, now) === "historical";
    case "needs_home":
      return !t.property_id || t.import_hold === "needs_home";
    case "claims_history":
      return t.claim !== null;
  }
}

/** The number on each tab: every ticket on it, before any filter. */
export function ticketTabCounts(rows: DbRow[], now: number = Date.now()): Record<TicketTabKey, number> {
  const out = Object.fromEntries(TICKET_TABS.map((t) => [t.key, 0])) as Record<TicketTabKey, number>;
  for (const r of rows) {
    if (!r.ticket) continue;
    for (const { key } of TICKET_TABS) if (inTicketTab(key, r.ticket, now)) out[key]++;
  }
  return out;
}

/* Filters every tab shares. Row cells: Ref, Title, Home, Problem type, Status, Owner. */

export const TICKET_COLUMNS = ["Ref", "Title", "Home", "Problem type", "Status", "Owner"] as const;
const CELL = { ref: 0, title: 1, home: 2, problemType: 3, status: 4, owner: 5 } as const;

export const TICKET_FILTER_LABELS = {
  search: "Search tickets",
  searchHint: "Home, title, reference or Notion number",
  period: "Period",
  problemType: "Problem type",
  status: "Status",
  owner: "Owner",
  claimsToWork: CLAIMS_TO_WORK_FILTER,
  sort: "Sort",
} as const;

export const NO_OWNER = "No owner";
export const TICKET_SORT_OPTIONS = ["Newest first", "Oldest first"] as const;
export type TicketSort = (typeof TICKET_SORT_OPTIONS)[number];

export type TicketView = {
  tab: TicketTabKey;
  term: string;
  period: Period;
  problemType: string;
  status: string;
  owner: string;
  claimsToWork: string;
  sort: TicketSort;
};

export const TICKET_VIEW_DEFAULT: TicketView = {
  tab: TICKET_TAB_DEFAULT,
  term: "",
  period: { kind: "all" },
  problemType: ALL,
  status: ALL,
  owner: ALL,
  claimsToWork: ALL,
  sort: "Newest first",
};

const ownerOf = (r: DbRow) => r.cells[CELL.owner] || NO_OWNER;

/** The choices for Problem type, Status and Owner, read from the rows. */
export function ticketFilterOptions(rows: DbRow[], filter: "problemType" | "status" | "owner"): string[] {
  const values = new Set<string>();
  for (const r of rows) {
    const v = filter === "owner" ? ownerOf(r) : r.cells[CELL[filter]];
    if (v) values.add(v);
  }
  const sorted = [...values].sort((a, b) => (a === NO_OWNER ? 1 : b === NO_OWNER ? -1 : a.localeCompare(b)));
  return [ALL, ...sorted];
}

/** Every word typed must appear in the ticket. A leading # on a reference is ignored. */
export function ticketMatches(r: DbRow, term: string): boolean {
  const words = normalize(term)
    .split(" ")
    .map((w) => w.replace(/^#/, ""))
    .filter(Boolean);
  if (!words.length) return true;
  const text = rowText(r);
  return words.every((w) => text.includes(w));
}

/** The date a row sorts by: the claim's original date on Claims history, else the ticket's. */
export function ticketSortDate(r: DbRow, tab: TicketTabKey): string {
  if (!r.ticket) return "";
  if (tab === "claims_history" && r.ticket.claim) return r.ticket.claim.openedAt;
  return originalCreatedAt(r.ticket);
}

/** The tab, then search, Period (original created date), Problem type, Status, Owner, Claims to work, then the date sort. */
export function applyTicketView(rows: DbRow[], view: TicketView, now: number = Date.now()): DbRow[] {
  const out = rows.filter((r) => {
    const t = r.ticket;
    if (!t || !inTicketTab(view.tab, t, now)) return false;
    if (!ticketMatches(r, view.term)) return false;
    if (!inPeriod(originalCreatedAt(t), view.period, now)) return false;
    if (view.problemType !== ALL && r.cells[CELL.problemType] !== view.problemType) return false;
    if (view.status !== ALL && r.cells[CELL.status] !== view.status) return false;
    if (view.owner !== ALL && ownerOf(r) !== view.owner) return false;
    if (view.claimsToWork !== ALL && r.tags?.[CLAIMS_TO_WORK_FILTER] !== CLAIMS_TO_WORK_FILTER) return false;
    return true;
  });
  const dir = view.sort === "Oldest first" ? 1 : -1;
  return out
    .map((r, i) => ({ r, i, at: Date.parse(ticketSortDate(r, view.tab)) }))
    .sort((a, b) => {
      const ta = Number.isFinite(a.at) ? a.at : null;
      const tb = Number.isFinite(b.at) ? b.at : null;
      if (ta === null && tb === null) return a.i - b.i;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta === tb ? a.i - b.i : (ta - tb) * dir;
    })
    .map((x) => x.r);
}

const ticketsWord = (n: number) => `${n} ${n === 1 ? "ticket" : "tickets"}`;
const claimsWord = (n: number) => `${n} ${n === 1 ? "claim" : "claims"}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** "12 tickets", and on Claims history the damages, paid back and still open. */
export function ticketTotalsLine(rows: DbRow[], tab: TicketTabKey): string {
  const head = ticketsWord(rows.length);
  if (tab !== "claims_history") return head;
  const t = claimTotals(
    rows.flatMap((r) =>
      r.ticket?.claim
        ? [
            {
              ...r,
              claim: {
                kind: "claim" as const,
                open: r.ticket.claim.open,
                openedAt: r.ticket.claim.openedAt,
                damages: r.ticket.claim.amount,
                paidBack: r.ticket.claim.paidBack,
              },
            },
          ]
        : [],
    ),
  );
  return [
    head,
    `Total damages ${money(round2(t.damages))}`,
    `Paid back ${money(round2(t.paidBack))}`,
    `Still open: ${claimsWord(t.openCount)}, ${money(round2(t.stillOpen))}`,
  ].join(" · ");
}

/** The record label a row shows under its title, if any. */
export function ticketRecordLabel(t: TicketFacts, now: number = Date.now()): string | null {
  const s = notionTicketState(t, now);
  if (s === "historical") return HISTORICAL_LABEL;
  if (s === "older_open") return OLDER_OPEN_LABEL;
  return null;
}

/** Choosing the home on Needs a home: the people who could do it on the old review list. */
export const NEEDS_HOME_COPY = {
  choose: "Choose the home",
  save: "Save the home",
  saved: (ref: string) => `Ticket ${ref ? `#${ref} ` : ""}now has its home.`,
  who: "An Operations Supervisor or an Admin chooses the home.",
} as const;

/* ---------- Move to queue (Build 9 B1) ---------- */

export const MOVE_TO_QUEUE_COPY = {
  button: (n: number) => (n === 1 ? "Move 1 ticket to the queue" : `Move ${n} tickets to the queue`),
  selectAll: "Select all shown",
  clear: "Clear",
  pick: (ref: string) => `Pick ticket ${ref}`,
  moved: (n: number) => (n === 1 ? "1 ticket moved to the Team Queue." : `${n} tickets moved to the Team Queue.`),
  needsHome: "Choose the home first.",
  notReady: "Move to queue is not ready yet.",
} as const;

/** An older open Notion import the Operations Supervisor or the Director of Operations may move into the Team Queue. */
export function movableToQueue(t: TicketFacts, now: number = Date.now()): boolean {
  return notionTicketState(t, now) === "older_open" && t.import_hold !== "needs_home";
}

/** Who sees Move to queue: the Operations Supervisor and the Director of Operations (Emily, Nov 10). */
export function canMoveToQueue(seats: { opsSupervisor?: boolean; opsDirector?: boolean }, readOnly: boolean): boolean {
  return !readOnly && Boolean(seats.opsSupervisor || seats.opsDirector);
}

