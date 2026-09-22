/**
 * Day 30 / 60 / 90 checkpoints for the 90-day Active Owner program.
 *
 * Pure, browser-safe pacing arithmetic on top of the existing benchmark curve.
 * Nothing here estimates or suggests an amount of time, and nothing here makes
 * any statement about tax treatment — a checkpoint only compares the hours the
 * homeowner already reported against the program's own pace benchmark.
 */

import { benchmarkHours, hoursFromMinutes, PROGRAM_TOTAL_DAYS } from "./owner-participation";

/** The three checkpoints staff and homeowners both watch. */
export const MILESTONE_DAYS = [30, 60, 90] as const;
export type MilestoneDay = (typeof MILESTONE_DAYS)[number];

/** How close to a checkpoint counts as "approaching" and opens the window. */
export const MILESTONE_WINDOW_DAYS = 7;
/** How long after the checkpoint the touchpoint window stays open. */
export const MILESTONE_GRACE_DAYS = 3;

export type MilestoneState = "upcoming" | "approaching" | "met" | "behind";

export type MilestoneCheckpoint = {
  day: MilestoneDay;
  /** The program pace benchmark at that day, in hours. */
  expectedHours: number;
  state: MilestoneState;
  /** Short chip text: "On pace", "Behind pace", "In 5 days", "Day 60". */
  label: string;
  /** Hours still short of the benchmark, 0 when on pace. */
  shortfallHours: number;
  daysAway: number;
  /** True while this checkpoint is the one worth a touchpoint today. */
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

/** Whether today falls inside a checkpoint's touchpoint window. */
export function milestoneWindow(day: number): MilestoneDay | null {
  for (const m of MILESTONE_DAYS) {
    if (day >= m - MILESTONE_WINDOW_DAYS && day <= m + MILESTONE_GRACE_DAYS) return m;
  }
  return null;
}

/** The three checkpoints as they stand today. */
export function milestoneCheckpoints(input: {
  day: number;
  reportedHours: number;
  goalMet?: boolean;
}): MilestoneCheckpoint[] {
  const day = Math.max(0, Math.min(PROGRAM_TOTAL_DAYS, Math.round(input.day)));
  const open = milestoneWindow(day);

  return MILESTONE_DAYS.map((m) => {
    const expectedHours = Math.round(benchmarkHours(m));
    const daysAway = m - day;
    const reached = input.goalMet === true || input.reportedHours >= expectedHours;

    let state: MilestoneState;
    if (reached) state = "met";
    else if (day >= m) state = "behind";
    else if (daysAway <= MILESTONE_WINDOW_DAYS) state = "approaching";
    else state = "upcoming";

    const label =
      state === "met"
        ? "On pace"
        : state === "behind"
          ? "Behind pace"
          : state === "approaching"
            ? daysAway <= 0
              ? "Today"
              : `In ${daysAway} day${daysAway === 1 ? "" : "s"}`
            : `Day ${m}`;

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
