/**
 * Hour checkpoints for the Active Owner program (25 / 50 / 75 / 100 hours),
 * spaced evenly across the closing-date-to-December-31 window.
 *
 * Pure, browser-safe pacing arithmetic. Nothing here estimates or suggests an
 * amount of time for any activity and nothing here makes any statement about
 * tax treatment — a checkpoint only compares the hours already logged.
 */

import { benchmarkHours, hoursFromMinutes, OWNER_GOAL_HOURS } from "./owner-participation";

/** Share of the goal each checkpoint represents. */
export const MILESTONE_FRACTIONS = [0.25, 0.5, 0.75, 1] as const;

/** How close to a checkpoint counts as "approaching" and opens the window. */
export const MILESTONE_WINDOW_DAYS = 7;
/** How long after the checkpoint the touchpoint window stays open. */
export const MILESTONE_GRACE_DAYS = 3;

export type MilestoneState = "upcoming" | "approaching" | "met" | "behind";

export type MilestoneCheckpoint = {
  /** Program day the checkpoint falls on. */
  day: number;
  /** Hours this checkpoint represents (25 / 50 / 75 / 100). */
  expectedHours: number;
  state: MilestoneState;
  label: string;
  shortfallHours: number;
  daysAway: number;
  inWindow: boolean;
};

export type PaceHealth = {
  label: "Not started" | "On pace" | "Behind pace" | "Target reached";
  tone: "muted" | "good" | "warn";
  behindHours: number;
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function checkpointDays(totalDays: number) {
  return MILESTONE_FRACTIONS.map((f) => Math.max(1, Math.round(totalDays * f)));
}

/** The checkpoint day whose touchpoint window contains today, if any. */
export function milestoneWindow(day: number, totalDays: number): number | null {
  if (totalDays <= 0) return null;
  for (const m of checkpointDays(totalDays)) {
    if (day >= m - MILESTONE_WINDOW_DAYS && day <= m + MILESTONE_GRACE_DAYS) return m;
  }
  return null;
}

/** The four hour checkpoints as they stand today. */
export function milestoneCheckpoints(input: {
  day: number;
  totalDays: number;
  reportedHours: number;
  goalMet?: boolean;
}): MilestoneCheckpoint[] {
  const totalDays = Math.max(0, input.totalDays);
  const day = Math.max(0, Math.min(totalDays, Math.round(input.day)));
  const open = milestoneWindow(day, totalDays);
  const days = checkpointDays(totalDays);

  return MILESTONE_FRACTIONS.map((f, i) => {
    const m = days[i]!;
    const expectedHours = Math.round(OWNER_GOAL_HOURS * f);
    const daysAway = m - day;
    const reached = input.goalMet === true || input.reportedHours >= expectedHours;

    let state: MilestoneState;
    if (reached) state = "met";
    else if (day >= m) state = "behind";
    else if (daysAway <= MILESTONE_WINDOW_DAYS) state = "approaching";
    else state = "upcoming";

    const label =
      state === "met"
        ? "Reached"
        : state === "behind"
          ? "Behind pace"
          : state === "approaching"
            ? daysAway <= 0
              ? "Today"
              : `In ${daysAway} day${daysAway === 1 ? "" : "s"}`
            : `${expectedHours} hrs`;

    return {
      day: m,
      expectedHours,
      state,
      label,
      shortfallHours: reached ? 0 : round(Math.max(0, expectedHours - input.reportedHours)),
      daysAway,
      inWindow: open === m,
    };
  });
}

/** Even-pace hours expected by `day` of a `totalDays` window. */
export function expectedHoursOn(day: number, totalDays: number) {
  return benchmarkHours(day, totalDays);
}

/** One-word pacing health for a program row or portal header. */
export function paceHealth(input: {
  day: number;
  reportedHours: number;
  goalMet?: boolean;
  benchmark: number;
}): PaceHealth {
  if (input.goalMet) return { label: "Target reached", tone: "good", behindHours: 0 };
  if (input.day <= 0) return { label: "Not started", tone: "muted", behindHours: 0 };
  const behind = round(Math.max(0, input.benchmark - input.reportedHours));
  // A single hour of drift is noise, not a pacing problem.
  if (behind < 1) return { label: "On pace", tone: "good", behindHours: 0 };
  return { label: "Behind pace", tone: "warn", behindHours: behind };
}

/** Convenience for server callers holding minutes rather than hours. */
export function paceHealthFromMinutes(input: {
  day: number;
  reportedMinutes: number;
  goalMet?: boolean;
  benchmark: number;
}): PaceHealth {
  return paceHealth({ ...input, reportedHours: hoursFromMinutes(input.reportedMinutes) });
}
