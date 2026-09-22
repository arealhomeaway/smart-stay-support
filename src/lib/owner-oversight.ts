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
  properties: { id: string; name: string }[];
};

export type OversightRow = OversightInput & {
  /** Hours the whole 90 days is aiming at. */
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
  return hay.includes(q);
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

/** One call for the page: filter, search and sort together. */
export function viewOversight(
  rows: OversightRow[],
  opts: { search?: string; filter?: PaceFilter; sort?: OversightSort } = {},
): OversightRow[] {
  return sortOversight(
    rows
      .filter((r) => matchesPaceFilter(r, opts.filter ?? "all"))
      .filter((r) => matchesOversightSearch(r, opts.search ?? "")),
    opts.sort ?? "pace",
  );
}
