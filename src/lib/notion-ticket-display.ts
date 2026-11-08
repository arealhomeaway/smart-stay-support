/**
 * How tickets imported from Notion show up in Resolve. Pure and browser-safe.
 *
 * One rule for every screen:
 * - recent_open: open, created in Notion within the last 30 days. Shown only in
 *   the Team Queue group "Imported from Notion". Quiet: no clocks, alerts,
 *   unclaimed count, Needs you now, Oversight, scorecards or rates.
 * - older_open: open, created more than 30 days ago. Badge only, never in the
 *   queue or My work.
 * - historical: closed or resolved. Badge only, never in the queue, My work or
 *   Needs you now, and never shows an assignee.
 * - live: someone reopened or took it in Resolve. From then on it is ordinary
 *   work with fresh clocks, credited to the person who reopened it.
 *
 * Age is the Notion created date (stored as reported_at by the import), never
 * the last edit and never the date it was copied into Resolve.
 */
import { OPEN_STATUSES, slaDueDates } from "@/lib/tickets";

export const NOTION_RECENT_DAYS = 30;
/** Written to tickets.external_status by the reopen action. */
export const NOTION_LIVE_STATUS = "reopened_in_resolve";
export const NOTION_REOPEN_HISTORY_LINE = "Reopened from Notion history";
export const NOTION_TAKEN_HISTORY_LINE = "Taken from the Notion import";

export type NotionState = "none" | "live" | "recent_open" | "older_open" | "historical";

export type NotionTicketLike = {
  external_source?: string | null;
  external_status?: string | null;
  status: string;
  reported_at?: string | null;
};

export function notionTicketState(t: NotionTicketLike, now: number = Date.now()): NotionState {
  if (t.external_source !== "notion") return "none";
  if (t.external_status === NOTION_LIVE_STATUS) return "live";
  if (!OPEN_STATUSES.includes(t.status)) return "historical";
  const created = Date.parse(t.reported_at ?? "");
  if (!Number.isFinite(created)) return "older_open";
  return now - created <= NOTION_RECENT_DAYS * 86_400_000 ? "recent_open" : "older_open";
}

/** True while an imported ticket has not been made live in Resolve. */
export function isQuietNotion(t: NotionTicketLike, now: number = Date.now()): boolean {
  const s = notionTicketState(t, now);
  return s === "recent_open" || s === "older_open" || s === "historical";
}

/** Rows that count as Resolve work: queues, My work, counts, Oversight, rates. */
export function withoutQuietNotion<T>(rows: T[], now: number = Date.now()): T[] {
  return rows.filter((r) => !isQuietNotion(r as unknown as NotionTicketLike, now));
}

/** The badge shown wherever the ticket appears. Null when no badge applies. */
export function notionBadge(t: NotionTicketLike, now: number = Date.now()): string | null {
  switch (notionTicketState(t, now)) {
    case "historical":
      return "Historical record from Notion";
    case "older_open":
      return "Older open ticket from Notion";
    case "recent_open":
      return "Imported from Notion";
    case "live":
      return "Reopened from Notion";
    default:
      return null;
  }
}

/** Historical records never show an assignee, and no imported ticket shows the Notion person as one. */
export function showsAssignee(t: NotionTicketLike, now: number = Date.now()): boolean {
  return !isQuietNotion(t, now);
}

export type NotionAction = { kind: "reopen" | "take"; label: string; historyLine: string } | null;

/**
 * The button on the ticket page. Historical and older open tickets get
 * "Reopen". Recent open imports get "Take this ticket", which makes it live the
 * same way. Only staff who can work tickets see either.
 */
export function notionAction(t: NotionTicketLike, canWorkTickets: boolean, now: number = Date.now()): NotionAction {
  if (!canWorkTickets) return null;
  const s = notionTicketState(t, now);
  if (s === "historical" || s === "older_open")
    return { kind: "reopen", label: "Reopen", historyLine: NOTION_REOPEN_HISTORY_LINE };
  if (s === "recent_open")
    return { kind: "take", label: "Take this ticket", historyLine: NOTION_TAKEN_HISTORY_LINE };
  return null;
}

export const REOPEN_REASON_MIN = 3;
export const REOPEN_REASON_MAX = 500;

/** Null when the reason is fine, otherwise the message to show. */
export function reopenReasonProblem(reason: string | null | undefined): string | null {
  const r = (reason ?? "").trim();
  if (r.length < REOPEN_REASON_MIN) return "Add a short reason.";
  if (r.length > REOPEN_REASON_MAX) return `Keep the reason under ${REOPEN_REASON_MAX} characters.`;
  return null;
}

/** Fresh clocks from the moment of reopening, using the same rule as a new ticket. */
export function reopenClocks(
  priority: string,
  now: Date,
  workType?: { response_minutes?: number | null; action_start_minutes?: number | null } | null,
) {
  return { reopened_at: now.toISOString(), ...slaDueDates(priority, now, workType ?? null) };
}

/** A ticket with a claim keeps its claim steps whatever its age, status or label. */
export function claimStepsAvailable(hasClaim: boolean, _t?: NotionTicketLike): boolean {
  return hasClaim;
}

// ---------- wording ----------

const HIDDEN_STATUS = /pending\s+claim\s+review\s+with\s+josh/gi;

/** The Notion status shown on a screen. The claim review status is always "Claim review". */
export function notionStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  if (!s) return "";
  if (s === NOTION_LIVE_STATUS) return "Reopened in Resolve";
  if (/pending\s+claim\s+review\s+with\s+josh/i.test(s)) return "Claim review";
  return cleanNotionText(s);
}

/** Cleans any text that came from Notion before it reaches a screen. */
export function cleanNotionText(text: string | null | undefined): string {
  return (text ?? "").replace(HIDDEN_STATUS, "Claim review");
}

// ---------- the "Imported from Notion" block in the description ----------

const BLOCK_HEADER = "Imported from Notion";
const ASSIGNED_LINE = /^Assigned in Notion to:\s*(.+)$/i;
const LEGACY_ASSIGNEE_LINE = /^Notion assignee:\s*(.+?)(\s*\(no Resolve login at import\))?$/i;

export type NotionBlock = {
  /** The description without the import block. */
  body: string;
  /** Read-only lines from the import block, cleaned for the screen. */
  lines: string[];
  /** The Notion assignee as plain text. Never a Resolve assignee. */
  assigneeName: string | null;
};

export function parseNotionBlock(description: string | null | undefined): NotionBlock {
  const text = description ?? "";
  const paragraphs = text.split(/\n\s*\n/);
  const idx = paragraphs.findIndex((p) => p.trim().split("\n")[0]?.trim() === BLOCK_HEADER);
  if (idx === -1) return { body: cleanNotionText(text).trim(), lines: [], assigneeName: null };
  const blockLines = paragraphs
    .slice(idx)
    .join("\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== BLOCK_HEADER);
  let assigneeName: string | null = null;
  const lines: string[] = [];
  for (const line of blockLines) {
    const a = ASSIGNED_LINE.exec(line) ?? LEGACY_ASSIGNEE_LINE.exec(line);
    if (a?.[1]) {
      assigneeName = a[1].trim();
      continue;
    }
    if (/^Notion status:/i.test(line)) {
      lines.push(`Notion status: ${notionStatusLabel(line.replace(/^Notion status:\s*/i, ""))}`);
      continue;
    }
    lines.push(cleanNotionText(line));
  }
  const body = cleanNotionText(paragraphs.slice(0, idx).join("\n\n")).trim();
  return { body, lines, assigneeName };
}

export function assignedInNotionLine(name: string | null | undefined): string | null {
  const n = (name ?? "").trim();
  return n ? `Assigned in Notion to: ${n}` : null;
}

// ---------- Team Queue group ----------

export type NotionGroup = "team_a" | "team_b" | "unassigned";
export const NOTION_GROUPS: { value: NotionGroup; label: string }[] = [
  { value: "team_a", label: "Team A" },
  { value: "team_b", label: "Team B" },
  { value: "unassigned", label: "Unassigned" },
];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Which sub group an open imported ticket sits in: the home team of the staff
 * member whose name exactly matches the Notion assignee text. No exact match,
 * or a person with no home team, is Unassigned.
 */
export function notionGroupFor(
  assigneeName: string | null,
  staff: { id: string; full_name: string | null }[],
  homeTeamOf: (userId: string | null) => string | null,
): NotionGroup {
  const n = norm(assigneeName);
  if (!n) return "unassigned";
  const hits = staff.filter((s) => norm(s.full_name) === n);
  if (hits.length !== 1) return "unassigned";
  const team = homeTeamOf(hits[0]!.id);
  if (team === "guest_experience") return "team_a";
  if (team === "property_operations") return "team_b";
  return "unassigned";
}

/** Only open imports created in the last 30 days, grouped Team A, Team B, Unassigned. */
export function notionQueueGroups<T extends NotionTicketLike & { description?: string | null }>(
  rows: T[],
  staff: { id: string; full_name: string | null }[],
  homeTeamOf: (userId: string | null) => string | null,
  now: number = Date.now(),
): Record<NotionGroup, T[]> {
  const out: Record<NotionGroup, T[]> = { team_a: [], team_b: [], unassigned: [] };
  for (const t of rows) {
    if (notionTicketState(t, now) !== "recent_open") continue;
    out[notionGroupFor(parseNotionBlock(t.description).assigneeName, staff, homeTeamOf)].push(t);
  }
  return out;
}
