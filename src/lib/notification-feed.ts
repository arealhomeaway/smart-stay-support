/**
 * Staff notification feed rules (browser-safe, pure).
 *
 * One place decides where a notification opens, which day group it sits in
 * and how repeats of the same kind on the same item collapse. The bell and
 * the Notifications page both read these rules.
 */

export type FeedRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link_path: string | null;
  priority: string;
  read_at: string | null;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
};

/** What an approval record points at, read separately (RLS applies). */
export type ApprovalTarget = { kind: string; entity_id: string | null; property_id: string | null };

export const PAGE_SIZE = 20;
export const MARK_ALL_CONFIRM_OVER = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Plain-language names for every kind written today. */
export const KIND_LABELS: Record<string, string> = {
  approval_required: "Approval needed",
  claim_waiver: "Claim waiver",
  claim_waiver_decision: "Claim waiver decision",
  cleaner_safeguard_activated: "STR cleaner time",
  cleaner_safeguard_digest: "STR cleaner weekly summary",
  closure_qa: "Closure check",
  approval_decided: "Approval decided",
  note_mention: "You were mentioned",
  team_queue_director: "Team Queue: nobody has taken it",
  team_queue_supervisor: "Team Queue: nobody has taken it",
  ticket_note: "New note",
  handoff_accepted: "Handoff accepted",
  handoff_pending: "Handoff waiting",
  handoff_rejected: "Handoff sent back",
  onboarding_task_comment: "Task comment",
  onboarding_task_completed: "Task completed",
  owner_collaboration: "Homeowner update",
  owner_completion_review: "Homeowner completion to review",
  owner_followup: "Homeowner follow-up",
  sla_action_breached: "Response time passed",
  ticket_assigned: "Ticket assigned",
  vendor_no_acknowledgment: "Vendor has not confirmed",
  waiting_returned: "Waiting time ended",
  work_order_update: "Work Order update",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function safeInternal(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

/**
 * The most specific place a notification can open. Stored links are kept
 * when they already name the exact item; generic or broken ones are
 * resolved from the record the notification is about.
 */
export function notificationLink(row: FeedRow, approval?: ApprovalTarget | null): string | null {
  const stored = safeInternal(row.link_path);
  const id = row.entity_id && UUID.test(row.entity_id) ? row.entity_id : null;

  if (row.kind === "approval_required") {
    // Approval alerts open the exact ticket when the database stored one (Emily, Nov 7, 2026).
    if (stored && /^\/tickets\/[0-9a-f-]{36}$/i.test(stored)) return stored;
    if (approval && approval.entity_id && UUID.test(approval.entity_id)) {
      if (approval.kind === "onboarding_task" && approval.property_id && UUID.test(approval.property_id)) {
        return `/onboarding/${approval.property_id}?tab=work&task=${approval.entity_id}`;
      }
      if (approval.kind.startsWith("work_order")) return `/work-orders?open=${approval.entity_id}`;
      if (approval.kind.startsWith("ticket")) return `/tickets/${approval.entity_id}`;
    }
    // "/approvals" has no page; the oversight board lists every approval.
    return "/oversight";
  }

  // Homeowner items: the stored link opens the home's Tasks tab only, so
  // add the item itself when the notification is about an Opportunity.
  if (
    (row.kind === "owner_collaboration" || row.kind === "owner_completion_review") &&
    row.entity_type === "work_item" &&
    id &&
    stored &&
    /^\/onboarding\/[^/?]+\?tab=work$/.test(stored)
  ) {
    return `${stored}&opp=${id}`;
  }

  if (!stored) {
    if (row.entity_type === "ticket" && id) return `/tickets/${id}`;
    if (row.entity_type === "work_order" && id) return `/work-orders?open=${id}`;
    if (row.entity_type === "property" && id) return `/property/${id}`;
    if (row.entity_type === "claim" && id) return `/claims?claim=${id}`;
  }
  return stored;
}

/** Calendar day key in America/Chicago, where ARHA works. */
export function centralDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export type DayBucket = "Today" | "Yesterday" | "Earlier";

export function dayBucket(iso: string, now: Date = new Date()): DayBucket {
  const day = centralDay(iso);
  const today = centralDay(now.toISOString());
  if (day === today) return "Today";
  const y = centralDay(new Date(now.getTime() - 24 * 3600 * 1000).toISOString());
  // Around DST the 24 hour step can land on the same day; step once more.
  const yesterday =
    y === today ? centralDay(new Date(now.getTime() - 25 * 3600 * 1000).toISOString()) : y;
  return day === yesterday ? "Yesterday" : "Earlier";
}

export type FeedEntry = {
  key: string;
  /** Newest row first. */
  rows: FeedRow[];
  lead: FeedRow;
  count: number;
  unreadIds: string[];
};

export type FeedGroup = { bucket: DayBucket; entries: FeedEntry[]; unreadIds: string[] };

/** Body is stored as "Item · Property". */
export function splitBody(body: string): { item: string; property: string | null } {
  const i = body.lastIndexOf(" · ");
  if (i <= 0) return { item: body, property: null };
  return { item: body.slice(0, i), property: body.slice(i + 3) };
}

/** "3 updates on 1399 Foxtail Ln: Task X" for a collapsed repeat. */
export function entrySummary(entry: FeedEntry): string {
  const { item, property } = splitBody(entry.lead.body);
  if (entry.count <= 1) return entry.lead.body;
  const where = property ? ` on ${property}` : "";
  return `${entry.count} updates${where}${item ? `: ${item}` : ""}`;
}

/**
 * Group rows (newest first) into Today / Yesterday / Earlier, collapsing
 * repeats of the same kind about the same item on the same day.
 */
export function groupFeed(rows: FeedRow[], now: Date = new Date()): FeedGroup[] {
  const order: DayBucket[] = ["Today", "Yesterday", "Earlier"];
  const groups = new Map<DayBucket, FeedGroup>();
  const entries = new Map<string, FeedEntry>();
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const row of sorted) {
    const bucket = dayBucket(row.created_at, now);
    let group = groups.get(bucket);
    if (!group) {
      group = { bucket, entries: [], unreadIds: [] };
      groups.set(bucket, group);
    }
    if (!row.read_at) group.unreadIds.push(row.id);
    const subject = row.entity_id ?? row.link_path ?? row.body;
    const key = `${bucket}|${centralDay(row.created_at)}|${row.kind}|${subject}`;
    const existing = entries.get(key);
    if (existing) {
      existing.rows.push(row);
      existing.count += 1;
      if (!row.read_at) existing.unreadIds.push(row.id);
      continue;
    }
    const entry: FeedEntry = {
      key,
      rows: [row],
      lead: row,
      count: 1,
      unreadIds: row.read_at ? [] : [row.id],
    };
    entries.set(key, entry);
    group.entries.push(entry);
  }
  return order.filter((b) => groups.has(b)).map((b) => groups.get(b)!);
}
