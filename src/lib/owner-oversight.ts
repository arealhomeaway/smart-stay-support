import { programLengthDays } from "./owner-participation";
import { matchesPropertySearch, type PropertyLabelFields } from "./property-label";
/**
 * Supervisor oversight for the Active Owner participation program.
 *
 * Pure, browser-safe shaping of the rows the staff program loader already
 * returns, so directors and the platform owner can read the whole program at a
 * glance. Nothing here estimates time for a homeowner or says anything about
 * tax treatment — it only compares hours the homeowner already reported with
 * the program's own pace benchmark.
 */

import {
  MILESTONE_WINDOW_DAYS,
  milestoneCheckpoints,
  paceHealth,
  type MilestoneCheckpoint,
  type PaceHealth,
} from "./owner-milestones";
import { OWNER_GOAL_HOURS } from "./owner-participation";

/** The subset of the staff program row oversight needs. */
export type OversightInput = {
  id: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLinked: boolean;
  status: string;
  startedOn: string | null;
  endsOn: string | null;
  day: number;
  daysLeft: number;
  reportedHours: number;
  benchmark: number;
  goalMet: boolean;
  openTasks: number;
  lastOwnerActivityAt: string | null;
  lastNotificationAt: string | null;
  properties: (PropertyLabelFields & { id: string; name: string })[];
};

export type OversightRow = OversightInput & {
  /** Hours the whole program is aiming at. */
  targetHours: number;
  health: PaceHealth;
  checkpoints: MilestoneCheckpoint[];
  /** The checkpoint worth a touchpoint today, if any. */
  openCheckpoint: MilestoneCheckpoint | null;
  /** The next checkpoint still ahead (or the last one once day 90 passes). */
  nextCheckpoint: MilestoneCheckpoint;
  /** Latest of owner activity and outbound contact. */
  lastContactAt: string | null;
  /** True when a checkpoint lands inside the next seven days or is overdue. */
  reviewDueSoon: boolean;
};

export type PaceFilter = "all" | "on_pace" | "behind" | "review_due" | "waiting_on_owner";
export type OversightSort = "pace" | "review" | "days_left" | "hours" | "name";

/** Which 30/60/90 checkpoint window a homeowner sits in right now. */
export type CheckpointFilter = "all" | "open" | "next_7" | "next_30" | "q25" | "q50" | "q75" | "q100";
/** Whether anything is still sitting with the homeowner. */
export type OwnerItemsFilter = "all" | "waiting" | "clear";
/** How long since anyone last spoke with the homeowner. */
export type ContactFilter = "all" | "within_7" | "within_30" | "over_14" | "over_30" | "never";

const ACTIVE_STATUSES = new Set(["active", "target_reached"]);

function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Shape one staff program row for the oversight table. */
export function oversightRow(row: OversightInput): OversightRow {
  const checkpoints = milestoneCheckpoints({
    day: row.day,
    totalDays: programLengthDays(row.startedOn),
    reportedHours: row.reportedHours,
    goalMet: row.goalMet,
  });
  const health = paceHealth({
    day: row.day,
    reportedHours: row.reportedHours,
    goalMet: row.goalMet,
    benchmark: row.benchmark,
  });
  const openCheckpoint = checkpoints.find((c) => c.inWindow) ?? null;
  const nextCheckpoint =
    checkpoints.find((c) => c.daysAway >= 0) ?? checkpoints[checkpoints.length - 1]!;
  const reviewDueSoon =
    Boolean(openCheckpoint) ||
    (nextCheckpoint.daysAway >= 0 && nextCheckpoint.daysAway <= MILESTONE_WINDOW_DAYS);

  return {
    ...row,
    targetHours: OWNER_GOAL_HOURS,
    health,
    checkpoints,
    openCheckpoint,
    nextCheckpoint,
    lastContactAt: latest(row.lastOwnerActivityAt, row.lastNotificationAt),
    reviewDueSoon,
  };
}

/** Only enrolled programs belong in oversight; drafts are not running yet. */
export function enrolledRows(rows: OversightInput[]): OversightRow[] {
  return rows.filter((r) => ACTIVE_STATUSES.has(r.status)).map(oversightRow);
}

export type OversightSummary = {
  enrolled: number;
  onPace: number;
  behind: number;
  totalHours: number;
  reviewsDueSoon: number;
  awaitingOwner: number;
};

/** The strip above the table: the whole program in six numbers. */
export function oversightSummary(rows: OversightRow[]): OversightSummary {
  return {
    enrolled: rows.length,
    onPace: rows.filter((r) => r.health.tone === "good").length,
    behind: rows.filter((r) => r.health.tone === "warn").length,
    totalHours: Math.round(rows.reduce((sum, r) => sum + r.reportedHours, 0) * 100) / 100,
    reviewsDueSoon: rows.filter((r) => r.reviewDueSoon).length,
    awaitingOwner: rows.filter((r) => r.openTasks > 0).length,
  };
}

/** Search across owner name, email and the homes on the program. */
export function matchesOversightSearch(row: OversightRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [row.ownerName ?? "", row.ownerEmail ?? "", ...row.properties.map((p) => p.name)]
    .join(" ")
    .toLowerCase();
  return hay.includes(q) || row.properties.some(p => matchesPropertySearch(p, q));
}

export function matchesPaceFilter(row: OversightRow, filter: PaceFilter): boolean {
  switch (filter) {
    case "on_pace":
      return row.health.tone === "good";
    case "behind":
      return row.health.tone === "warn";
    case "review_due":
      return row.reviewDueSoon;
    case "waiting_on_owner":
      return row.openTasks > 0;
    default:
      return true;
  }
}

const PACE_ORDER: Record<PaceHealth["tone"], number> = { warn: 0, muted: 1, good: 2 };

export function sortOversight(rows: OversightRow[], sort: OversightSort): OversightRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "review":
        return (
          Number(b.reviewDueSoon) - Number(a.reviewDueSoon) ||
          a.nextCheckpoint.daysAway - b.nextCheckpoint.daysAway
        );
      case "days_left":
        return a.daysLeft - b.daysLeft;
      case "hours":
        return b.reportedHours - a.reportedHours;
      case "name":
        return (a.ownerName ?? "").localeCompare(b.ownerName ?? "");
      default:
        return (
          PACE_ORDER[a.health.tone] - PACE_ORDER[b.health.tone] ||
          b.health.behindHours - a.health.behindHours
        );
    }
  });
  return copy;
}

/** Days since the last contact, or null when nobody has spoken with them yet. */
export function daysSinceContact(row: OversightRow, now: Date = new Date()): number | null {
  if (!row.lastContactAt) return null;
  const then = new Date(row.lastContactAt).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}

export function matchesCheckpointFilter(row: OversightRow, filter: CheckpointFilter): boolean {
  switch (filter) {
    case "open":
      return Boolean(row.openCheckpoint);
    case "next_7":
      return row.reviewDueSoon;
    case "next_30":
      return Boolean(row.openCheckpoint) || row.nextCheckpoint.daysAway <= 30;
    case "q25":
    case "q50":
    case "q75":
    case "q100": {
      const hours = Number(filter.slice(1));
      return (row.openCheckpoint ?? row.nextCheckpoint).expectedHours === hours;
    }
    default:
      return true;
  }
}

export function matchesOwnerItemsFilter(row: OversightRow, filter: OwnerItemsFilter): boolean {
  if (filter === "waiting") return row.openTasks > 0;
  if (filter === "clear") return row.openTasks === 0;
  return true;
}

export function matchesContactFilter(
  row: OversightRow,
  filter: ContactFilter,
  now: Date = new Date(),
): boolean {
  if (filter === "all") return true;
  const days = daysSinceContact(row, now);
  if (filter === "never") return days === null;
  // Never contacted is always "overdue", never "recent".
  if (days === null) return filter === "over_14" || filter === "over_30";
  switch (filter) {
    case "within_7":
      return days <= 7;
    case "within_30":
      return days <= 30;
    case "over_14":
      return days > 14;
    case "over_30":
      return days > 30;
    default:
      return true;
  }
}

export type OversightView = {
  search?: string;
  filter?: PaceFilter;
  checkpoint?: CheckpointFilter;
  ownerItems?: OwnerItemsFilter;
  contact?: ContactFilter;
  sort?: OversightSort;
};

/** One call for the page: every filter, the search box and the sort together. */
export function viewOversight(
  rows: OversightRow[],
  opts: OversightView = {},
  now: Date = new Date(),
): OversightRow[] {
  return sortOversight(
    rows
      .filter((r) => matchesPaceFilter(r, opts.filter ?? "all"))
      .filter((r) => matchesCheckpointFilter(r, opts.checkpoint ?? "all"))
      .filter((r) => matchesOwnerItemsFilter(r, opts.ownerItems ?? "all"))
      .filter((r) => matchesContactFilter(r, opts.contact ?? "all", now))
      .filter((r) => matchesOversightSearch(r, opts.search ?? "")),
    opts.sort ?? "pace",
  );
}

/** True when any filter is narrowing the list — drives the "Clear filters" affordance. */
export function oversightFiltersActive(opts: OversightView): boolean {
  return Boolean(
    (opts.search ?? "").trim() ||
      (opts.filter && opts.filter !== "all") ||
      (opts.checkpoint && opts.checkpoint !== "all") ||
      (opts.ownerItems && opts.ownerItems !== "all") ||
      (opts.contact && opts.contact !== "all"),
  );
}
