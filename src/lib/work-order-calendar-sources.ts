/**
 * Combines Resolve Work Orders and synced Breezeway work orders for the Work
 * Order calendar. Read-only: nothing here writes to either system.
 *
 * A Resolve Work Order that was sent to Breezeway (breezeway_task_ref) and the
 * Breezeway task it created are the same job, so "All" shows it once, as the
 * Resolve Work Order.
 */
export type CalendarSource = "all" | "resolve" | "breezeway";

export const SOURCE_LABELS: Record<CalendarSource, string> = {
  all: "All",
  resolve: "Resolve Work Orders",
  breezeway: "Breezeway Work Orders",
};

export type WorkType =
  | "departure_clean"
  | "other_cleaning"
  | "mowing"
  | "pool"
  | "maintenance"
  | "inspection";

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  departure_clean: "Departure cleans",
  other_cleaning: "Other cleaning",
  mowing: "Mowing and lawn care",
  pool: "Pool service",
  maintenance: "Maintenance",
  inspection: "Inspections",
};

/** Work type from the Breezeway department and task name. */
export function breezewayWorkType(department: string | null, name: string | null): WorkType {
  const n = (name ?? "").toLowerCase();
  const d = (department ?? "").toLowerCase();
  if (/\bpool\b/.test(n)) return "pool";
  if (/\b(mow|mowing|lawn)\b/.test(n)) return "mowing";
  if (d === "inspection") return "inspection";
  if (d === "housekeeping" || d === "cleaning") {
    return /departure/.test(n) ? "departure_clean" : "other_cleaning";
  }
  return "maintenance";
}

export type CalendarItem = {
  key: string;
  source: "resolve" | "breezeway";
  /** Resolve Work Order id or Breezeway mirror row id. */
  id: string;
  day: string;
  title: string;
  propertyId: string | null;
  workType: WorkType;
  assignees: string[];
};

export type BreezewayCalendarRow = {
  id: string;
  breezeway_task_id: number | string;
  name: string | null;
  department: string | null;
  status: string | null;
  scheduled_date: string | null;
  property_id: string | null;
  assignees: unknown;
};

export function breezewayAssignees(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => (a && typeof a === "object" ? (a as { name?: unknown }).name : null))
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/**
 * Breezeway rows that belong on the calendar: dated, not deleted, and not
 * already shown as a linked Resolve Work Order.
 */
export function breezewayCalendarItems(
  rows: BreezewayCalendarRow[],
  linkedTaskRefs: Set<string>,
): CalendarItem[] {
  const out: CalendarItem[] = [];
  for (const r of rows) {
    if (!r.scheduled_date) continue;
    if ((r.status ?? "").toLowerCase() === "deleted") continue;
    if (linkedTaskRefs.has(String(r.breezeway_task_id))) continue;
    out.push({
      key: `bz:${r.id}`,
      source: "breezeway",
      id: r.id,
      day: r.scheduled_date.slice(0, 10),
      title: r.name ?? "Breezeway work order",
      propertyId: r.property_id,
      workType: breezewayWorkType(r.department, r.name),
      assignees: breezewayAssignees(r.assignees),
    });
  }
  return out;
}

export type CalendarFilters = {
  source: CalendarSource;
  workType: WorkType | "all";
  propertyId: string | "all";
  assignee: string | "all";
};

export const DEFAULT_FILTERS: CalendarFilters = {
  source: "all",
  workType: "all",
  propertyId: "all",
  assignee: "all",
};

export function matchesCalendarFilters(item: CalendarItem, f: CalendarFilters): boolean {
  if (f.source !== "all" && item.source !== f.source) return false;
  if (f.workType !== "all" && item.workType !== f.workType) return false;
  if (f.propertyId !== "all" && item.propertyId !== f.propertyId) return false;
  if (f.assignee !== "all" && !item.assignees.includes(f.assignee)) return false;
  return true;
}

export function activeFilterCount(f: CalendarFilters): number {
  return (Object.keys(f) as (keyof CalendarFilters)[]).filter((k) => f[k] !== "all").length;
}
