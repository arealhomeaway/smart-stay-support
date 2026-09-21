/**
 * Scheduling model for the dedicated Work Order calendar.
 *
 * Nothing here reads or writes: it takes the Work Orders already loaded and
 * answers the two scheduling questions a coordinator actually asks — what is
 * happening on a given day, and where has the same vendor or the same home
 * been committed twice. Conflicts are derived, never stored, so they cannot
 * drift from what is on the schedule.
 */
import type { WorkOrderRow } from "@/lib/work-order-types";

export type CalendarConflict = "vendor_double_booked" | "property_double_booked";

export const CONFLICT_LABELS: Record<CalendarConflict, string> = {
  vendor_double_booked: "Vendor booked twice",
  property_double_booked: "Two visits to this home",
};

export type ScheduledWorkOrder = {
  workOrder: WorkOrderRow;
  /** YYYY-MM-DD in the stored value's own terms. */
  day: string;
  /** Sortable time-of-day when one was recorded. */
  at: string;
  /** True when the vendor arrival time is the source, not the planned date. */
  fromVendorEta: boolean;
  conflicts: CalendarConflict[];
};

export type CalendarDay = {
  day: string;
  inMonth: boolean;
  isToday: boolean;
  entries: ScheduledWorkOrder[];
};

/** Local calendar day for a timestamp or a stored YYYY-MM-DD date. */
export function calendarDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function calendarMonth(value: string | undefined, today = new Date()): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return calendarMonth(undefined, new Date(year!, monthNumber! - 1 + offset, 1));
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year!, monthNumber! - 1, 1),
  );
}

/**
 * Every Work Order that has a place on the schedule, with conflicts marked.
 * The vendor's confirmed arrival wins over the planned date — it is the later,
 * more specific commitment.
 */
export function scheduleEntries(rows: WorkOrderRow[]): ScheduledWorkOrder[] {
  const entries: ScheduledWorkOrder[] = [];
  for (const workOrder of rows) {
    if (workOrder.closed_at) continue;
    const source = workOrder.vendor_eta_at ?? workOrder.scheduled_for;
    const day = calendarDay(source);
    if (!day) continue;
    entries.push({
      workOrder,
      day,
      at: String(source),
      fromVendorEta: Boolean(workOrder.vendor_eta_at),
      conflicts: [],
    });
  }

  markConflicts(entries, (e) => e.workOrder.vendor_org_id ?? e.workOrder.vendor_name, "vendor_double_booked");
  markConflicts(entries, (e) => e.workOrder.property_id, "property_double_booked");

  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

function markConflicts(
  entries: ScheduledWorkOrder[],
  keyOf: (entry: ScheduledWorkOrder) => string | null | undefined,
  conflict: CalendarConflict,
) {
  const groups = new Map<string, ScheduledWorkOrder[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (!key) continue;
    const composite = `${entry.day}::${String(key).toLowerCase()}`;
    groups.set(composite, [...(groups.get(composite) ?? []), entry]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const entry of group) entry.conflicts.push(conflict);
  }
}

/** Six-week grid, Sunday first, the way a wall calendar reads. */
export function monthGrid(
  month: string,
  entries: ScheduledWorkOrder[],
  today = new Date(),
): CalendarDay[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year!, monthNumber! - 1, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const byDay = new Map<string, ScheduledWorkOrder[]>();
  for (const entry of entries) byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return {
      day,
      inMonth: date.getMonth() === monthNumber! - 1,
      isToday: day === todayKey,
      entries: byDay.get(day) ?? [],
    };
  });
}

/** Chronological run of upcoming days, for the timeline view. */
export function timelineDays(
  entries: ScheduledWorkOrder[],
  fromDay: string,
): { day: string; entries: ScheduledWorkOrder[] }[] {
  const byDay = new Map<string, ScheduledWorkOrder[]>();
  for (const entry of entries) {
    if (entry.day < fromDay) continue;
    byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, rows]) => ({ day, entries: rows }));
}

/** Work that is open but has no place on the schedule at all. */
export function unscheduled(rows: WorkOrderRow[]): WorkOrderRow[] {
  return rows.filter((row) => !row.closed_at && !row.vendor_eta_at && !row.scheduled_for);
}

export function conflictCount(entries: ScheduledWorkOrder[]): number {
  return entries.filter((entry) => entry.conflicts.length > 0).length;
}
