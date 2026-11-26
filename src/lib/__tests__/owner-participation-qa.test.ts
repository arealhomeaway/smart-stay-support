/**
 * Active Owner QA: closing-to-year-end window, pace, milestones and goal state.
 */
import * as bunTest from "bun:test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

const setSystemTime = (bunTest as unknown as { setSystemTime: (date?: Date) => void }).setSystemTime;
import {
  OWNER_GOAL_HOURS,
  programLengthDays,
  programWindowEnd,
  benchmarkHours,
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

describe("program window: closing date through December 31", () => {
  it("ends on December 31 of the closing year", () => {
    expect(programWindowEnd("2026-09-22")).toBe("2026-12-31");
    expect(programLengthDays("2026-09-22")).toBe(101);
    expect(programLengthDays("2026-12-31")).toBe(1);
    expect(projectDay(null)).toBe(0);
  });
});

describe("benchmark pace", () => {
  it("paces evenly to the 120-hour recommendation (Nov 25)", () => {
    expect(benchmarkHours(50, 100)).toBe(60);
    expect(benchmarkHours(100, 100)).toBe(120);
    expect(benchmarkHours(0, 100)).toBe(0);
  });

  it("names the next hour milestone", () => {
    expect(nextMilestone(1, 100)).toEqual({ day: 25, hours: 30 });
    expect(nextMilestone(100, 100)).toEqual({ day: 100, hours: 120 });
  });
});

describe("progress state", () => {
  beforeEach(() => setSystemTime(new Date("2026-11-25T18:00:00Z")));
  afterEach(() => setSystemTime());
  const snap = (day: number, hours: number, status = "active") =>
    progressSnapshot({
      status: status as never,
      startedOn: daysAgo(day - 1),
      reportedMinutes: hours * 60,
    });

  it("early program on pace", () => {
    const s = snap(7, 20);
    expect(s.day).toBe(7);
    expect(s.totalDays).toBe(43);
    expect(s.benchmark).toBe(19.53);
    expect(s.state).toBe("on_track");
  });

  it("13 hours on day 7 is behind the 120-hour year-end recommendation", () => {
    const s = snap(7, 13);
    expect(s.benchmark).toBe(19.53);
    expect(s.variance).toBe(-6.53);
    expect(s.state).toBe("action_needed");
  });

  // Retired V2 rule (90-day window / returned hours).

  retired("mid program behind pace uses graded, non-punitive states", () => {
    expect(snap(35, 57).state).toBe("slightly_behind");
    expect(snap(35, 52).state).toBe("action_needed");
    expect(snap(35, 40).state).toBe("significantly_behind");
  });

  it("goal met means more than 100 hours: exactly 100 is not met (Nov 25)", () => {
    expect(snap(85, OWNER_GOAL_HOURS - 1 / 60).state).not.toBe("target_reached");
    expect(snap(85, OWNER_GOAL_HOURS).state).not.toBe("target_reached");
    expect(snap(85, OWNER_GOAL_HOURS + 0.5).state).toBe("target_reached");
  });

  it("computes remaining hours to the goal and never goes negative", () => {
    expect(Math.round(snap(50, 60).hoursToGoal * 10) / 10).toBe(60);
    expect(snap(50, 130).hoursToGoal).toBe(0);
  });

  it("marks a finished program complete regardless of pace", () => {
    expect(snap(90, 40, "completed").state).toBe("program_completed");
  });

  it("treats an unstarted program as not started", () => {
    const s = progressSnapshot({ status: "active" as never, startedOn: null, reportedMinutes: 0 });
    expect(s.state).toBe("not_started");
    expect(s.day).toBe(0);
    expect(s.daysLeft).toBe(0);
  });
});

/** Retired V2 rules are kept as documentation only. */
function retired(_name: string, _fn: () => unknown) {}
