/**
 * Active Owner QA: day count, 90-day window, pace, milestones and goal state.
 */
import { describe, expect, it } from "bun:test";
import {
  OPERATING_TARGET_HOURS,
  OWNER_GOAL_HOURS,
  PROGRAM_TOTAL_DAYS,
  benchmarkHours,
  daysRemaining,
  nextMilestone,
  progressSnapshot,
  projectDay,
} from "@/lib/owner-participation";

/** ISO date `n` days before today, so tests stay stable over time. */
function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe("program day and window", () => {
  it("counts the start day as day 1 and caps at 90", () => {
    expect(projectDay(daysAgo(0))).toBe(1);
    expect(projectDay(daysAgo(34))).toBe(35);
    expect(projectDay(daysAgo(200))).toBe(PROGRAM_TOTAL_DAYS);
    expect(projectDay(null)).toBe(0);
  });

  it("reports the days left in the 90-day window", () => {
    expect(daysRemaining(daysAgo(0))).toBe(89);
    expect(daysRemaining(daysAgo(89))).toBe(0);
  });
});

describe("benchmark pace", () => {
  it("hits 60 hours by day 35 and the operating target by day 90", () => {
    expect(benchmarkHours(35)).toBe(60);
    expect(benchmarkHours(PROGRAM_TOTAL_DAYS)).toBe(OPERATING_TARGET_HOURS);
    expect(benchmarkHours(0)).toBe(0);
  });

  it("names the next milestone ahead of the current day", () => {
    expect(nextMilestone(1).day).toBe(7);
    expect(nextMilestone(35).day).toBe(45);
    expect(nextMilestone(90)).toEqual({ day: 90, hours: OPERATING_TARGET_HOURS });
  });
});

describe("progress state", () => {
  const snap = (day: number, hours: number, status = "active") =>
    progressSnapshot({
      status: status as never,
      startedOn: daysAgo(day - 1),
      reportedMinutes: hours * 60,
    });

  it("early program on pace", () => {
    const s = snap(7, 13);
    expect(s.day).toBe(7);
    expect(s.state).toBe("on_track");
  });

  it("mid program behind pace uses graded, non-punitive states", () => {
    expect(snap(35, 57).state).toBe("slightly_behind");
    expect(snap(35, 52).state).toBe("action_needed");
    expect(snap(35, 40).state).toBe("significantly_behind");
  });

  it("requires strictly more than 100 hours to reach the goal", () => {
    expect(snap(85, OWNER_GOAL_HOURS).state).not.toBe("target_reached");
    expect(snap(85, OWNER_GOAL_HOURS + 0.5).state).toBe("target_reached");
  });

  it("computes remaining hours to the goal and never goes negative", () => {
    expect(snap(50, 60).hoursToGoal).toBeCloseTo(40.1, 1);
    expect(snap(50, 130).hoursToGoal).toBe(0);
  });

  it("marks a finished program complete regardless of pace", () => {
    expect(snap(90, 40, "completed").state).toBe("program_completed");
  });

  it("treats an unstarted program as not started", () => {
    const s = progressSnapshot({ status: "active" as never, startedOn: null, reportedMinutes: 0 });
    expect(s.state).toBe("not_started");
    expect(s.day).toBe(0);
    expect(s.daysLeft).toBe(PROGRAM_TOTAL_DAYS);
  });
});
