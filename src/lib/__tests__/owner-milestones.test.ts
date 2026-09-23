import { describe, expect, it } from "bun:test";
import { milestoneCheckpoints, milestoneWindow, paceHealth } from "../owner-milestones";

describe("hour checkpoints across the closing-to-year-end window", () => {
  it("places 25/50/75/100-hour checkpoints evenly", () => {
    const c = milestoneCheckpoints({ day: 1, totalDays: 100, reportedHours: 0 });
    expect(c.map((x) => [x.day, x.expectedHours])).toEqual([[25, 25], [50, 50], [75, 75], [100, 100]]);
  });
  it("marks reached and behind checkpoints", () => {
    const c = milestoneCheckpoints({ day: 60, totalDays: 100, reportedHours: 30 });
    expect(c[0]!.state).toBe("met");
    expect(c[1]!.state).toBe("behind");
  });
  it("opens a touchpoint window near a checkpoint", () => {
    expect(milestoneWindow(20, 100)).toBe(25);
    expect(milestoneWindow(35, 100)).toBeNull();
  });
  it("reports pace health", () => {
    expect(paceHealth({ day: 0, reportedHours: 0, benchmark: 0 }).label).toBe("Not started");
    expect(paceHealth({ day: 10, reportedHours: 100, benchmark: 10, goalMet: true }).label).toBe("Target reached");
  });
});
