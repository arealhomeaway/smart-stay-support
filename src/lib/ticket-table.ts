/**
 * Shared rules for the ticket table on Team Queue and Operations oversight (Emily, Nov 18).
 * Layout only: every value here is read from fields tickets already carry. No clock, SLA,
 * filter or sort rule changes; queueSort stays the last tie breaker.
 */
import { priorityMeta, WAITING_ON, STATUSES, labelFor } from "@/lib/tickets";
import { queueSort } from "@/lib/matters";

const CENTRAL = "America/Chicago";

export type DueTicket = {
  status: string;
  priority?: string | null;
  acknowledged_at?: string | null;
  action_started_at?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
  next_review_at?: string | null;
};

export type DueCell = {
  line1: string;
  line2: string | null;
  /** The due item has passed: both lines bold red. */
  overdue: boolean;
  /** Lines shown red without being overdue (no check back date). */
  alert: boolean;
  /** The time this row is due, for ordering. Null when nothing is due. */
  dueAt: string | null;
};

const WAITING_STATUSES = ["waiting", "awaiting_guest"];
const DONE_STATUSES = ["resolved", "closed"];

function centralParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), time: `${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}` };
}

/** "Nov 18 · 2:00 PM" in Central time. */
export function shortDateTime(iso: string, now = new Date()): string {
  const p = centralParts(new Date(iso));
  const year = p.year !== centralParts(now).year ? `, ${p.year}` : "";
  return `${p.month} ${p.day}${year} · ${p.time}`;
}

/** Reported column: "Today 1:41 PM", "Nov 16", or "Sep 16, 2025" for another year. Central time. */
export function reportedShort(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  const p = centralParts(d);
  const n = centralParts(now);
  if (p.year === n.year && p.month === n.month && p.day === n.day) return `Today ${p.time}`;
  return p.year === n.year ? `${p.month} ${p.day}` : `${p.month} ${p.day}, ${p.year}`;
}

/**
 * The Due column. Waiting is read first because waiting pauses the reply and start clocks
 * (register T13); otherwise reply, then start, then nothing due.
 */
export function dueCell(t: DueTicket, now = new Date()): DueCell {
  if (DONE_STATUSES.includes(t.status)) return { line1: "No due date", line2: null, overdue: false, alert: false, dueAt: null };
  if (WAITING_STATUSES.includes(t.status)) {
    if (!t.next_review_at) return { line1: "No check back date", line2: "Set one", overdue: false, alert: true, dueAt: null };
    const late = new Date(t.next_review_at).getTime() < now.getTime();
    const label = late ? dueLabelAt(t.next_review_at, now) : null;
    return { line1: shortDateTime(t.next_review_at, now), line2: late ? label : "Check back", overdue: late, alert: false, dueAt: t.next_review_at };
  }
  if (!t.acknowledged_at) return clockCell("Reply now", t.response_due_at, now);
  if (!t.action_started_at) return clockCell("Start work", t.action_due_at, now);
  return { line1: "No due date", line2: null, overdue: false, alert: false, dueAt: null };
}

/** "Overdue by 3h" or "Due in 20m" from one stored time. */
export function dueLabelAt(iso: string, now: Date) {
  const mins = Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  const span = (m: number) => {
    const a = Math.abs(m);
    if (a < 60) return `${a}m`;
    if (a < 60 * 48) return `${Math.round(a / 60)}h`;
    return `${Math.round(a / 1440)}d`;
  };
  return mins < 0 ? `Overdue by ${span(mins)}` : `Due in ${span(mins)}`;
}

function clockCell(line1: string, at: string | null | undefined, now: Date): DueCell {
  if (!at) return { line1, line2: null, overdue: false, alert: false, dueAt: null };
  const overdue = new Date(at).getTime() < now.getTime();
  return { line1, line2: dueLabelAt(at, now), overdue, alert: false, dueAt: at };
}

/** Status pill words: waiting shows what it waits on when that is set. */
export function statusPillLabel(t: { status: string; waiting_on?: string | null }): string {
  if (WAITING_STATUSES.includes(t.status) && t.waiting_on) {
    if (t.waiting_on === "other") return "Waiting on someone";
    return `Waiting on ${labelFor(WAITING_ON, t.waiting_on).toLowerCase()}`;
  }
  return labelFor(STATUSES, t.status);
}

/** Overdue rows first, then the soonest due time, then the existing queueSort order. */
export function compareInGroup<T extends DueTicket & { priority: string }>(a: T, b: T, now = new Date()): number {
  const da = dueCell(a, now);
  const db = dueCell(b, now);
  if (da.overdue !== db.overdue) return da.overdue ? -1 : 1;
  if (da.dueAt !== db.dueAt) {
    if (!da.dueAt) return 1;
    if (!db.dueAt) return -1;
    const gap = new Date(da.dueAt).getTime() - new Date(db.dueAt).getTime();
    if (gap) return gap;
  }
  return queueSort(a as never, b as never);
}

export type GroupBy = "priority" | "status" | "person";
export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "person", label: "Person" },
];
export function parseGroupBy(value: unknown): GroupBy {
  return value === "status" || value === "person" ? value : "priority";
}

/**
 * Priority group words use the urgency names (register H4: codes stay internal).
 */
export const PRIORITY_GROUPS = ["p1", "p2", "p3"].map((p) => ({ key: p, label: priorityMeta(p).short }));

export const STATUS_GROUPS = [
  { key: "open", label: "Open", statuses: ["open"] },
  { key: "in_progress", label: "In progress", statuses: ["in_progress", "dispatched"] },
  { key: "waiting", label: "Waiting on someone", statuses: ["waiting", "awaiting_guest"] },
  { key: "resolved", label: "Resolved", statuses: ["resolved"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
] as const;

export type TableGroup<T> = { key: string; label: string; tone: "p1" | "p2" | "p3" | "status" | "unassigned" | "person"; status?: string; rows: T[]; overdue: number };

type GroupRow = DueTicket & { priority: string };

/** Rows into groups. Empty groups are left out. */
export function groupTableRows<T extends GroupRow>(
  rows: T[],
  by: GroupBy,
  pick: { priority: (row: T) => string; ownerId: (row: T) => string | null; ownerName: (id: string) => string },
  now = new Date(),
): TableGroup<T>[] {
  const finish = (groups: TableGroup<T>[]) =>
    groups
      .filter((g) => g.rows.length > 0)
      .map((g) => {
        const sorted = [...g.rows].sort((a, b) => compareInGroup(a, b, now));
        return { ...g, rows: sorted, overdue: sorted.filter((r) => dueCell(r, now).overdue).length };
      });
  if (by === "priority") {
    return finish(PRIORITY_GROUPS.map((g) => ({
      key: g.key, label: g.label, tone: g.key as "p1" | "p2" | "p3", overdue: 0,
      rows: rows.filter((r) => (pick.priority(r) === g.key) || (g.key === "p3" && !["p1", "p2", "p3"].includes(pick.priority(r)))),
    })));
  }
  if (by === "status") {
    const known = STATUS_GROUPS.flatMap((g) => g.statuses as readonly string[]);
    return finish(STATUS_GROUPS.map((g) => ({
      key: g.key, label: g.label, tone: "status" as const, status: g.statuses[0], overdue: 0,
      rows: rows.filter((r) => (g.statuses as readonly string[]).includes(r.status) || (g.key === "open" && !known.includes(r.status))),
    })));
  }
  const byOwner = new Map<string, T[]>();
  const none: T[] = [];
  for (const r of rows) {
    const id = pick.ownerId(r);
    if (!id) none.push(r);
    else byOwner.set(id, [...(byOwner.get(id) ?? []), r]);
  }
  const people = [...byOwner.entries()]
    .map(([id, list]) => ({ key: id, label: pick.ownerName(id), tone: "person" as const, overdue: 0, rows: list }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return finish([{ key: "unassigned", label: "Unassigned", tone: "unassigned", overdue: 0, rows: none }, ...people]);
}
