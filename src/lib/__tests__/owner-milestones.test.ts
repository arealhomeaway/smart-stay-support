import { expect, it } from "bun:test";
import {
  MILESTONE_DAYS,
  milestoneCheckpoints,
  milestoneWindow,
  paceHealth,
} from "../owner-milestones";

it("tracks day 30, 60 and 90 only", () => {
  expect([...MILESTONE_DAYS]).toEqual([30, 60, 90]);
  expect(milestoneCheckpoints({ day: 1, reportedHours: 0 }).map((c) => c.day)).toEqual([
    30, 60, 90,
  ]);
});

it("opens a touchpoint window a week before and three days after each checkpoint", () => {
  expect(milestoneWindow(22)).toBeNull();
  expect(milestoneWindow(23)).toBe(30);
  expect(milestoneWindow(33)).toBe(30);
  expect(milestoneWindow(34)).toBeNull();
  expect(milestoneWindow(60)).toBe(60);
  expect(milestoneWindow(90)).toBe(90);
});

it("calls a checkpoint met when the reported hours reach its pace point", () => {
  const [d30] = milestoneCheckpoints({ day: 31, reportedHours: 60 });
  expect(d30!.state).toBe("met");
  expect(d30!.label).toBe("On pace");
  expect(d30!.shortfallHours).toBe(0);
});

it("reports how far behind a passed checkpoint is", () => {
  const [d30] = milestoneCheckpoints({ day: 31, reportedHours: 20 });
  expect(d30!.state).toBe("behind");
  expect(d30!.label).toBe("Behind pace");
  expect(d30!.shortfallHours).toBe(d30!.expectedHours - 20);
});

it("counts down to an approaching checkpoint", () => {
  const [d30] = milestoneCheckpoints({ day: 26, reportedHours: 5 });
  expect(d30!.state).toBe("approaching");
  expect(d30!.label).toBe("In 4 days");
  expect(d30!.inWindow).toBe(true);
});

it("a met hour goal shows every checkpoint on pace", () => {
  const all = milestoneCheckpoints({ day: 40, reportedHours: 101, goalMet: true });
  expect(all.every((c) => c.state === "met")).toBe(true);
});

it("pace health forgives under an hour of drift and never mentions taxes", () => {
  expect(paceHealth({ day: 0, reportedHours: 0, benchmark: 0 }).label).toBe("Not started");
  expect(paceHealth({ day: 20, reportedHours: 33.5, benchmark: 34 }).label).toBe("On pace");
  const behind = paceHealth({ day: 20, reportedHours: 20, benchmark: 34 });
  expect(behind.label).toBe("Behind pace");
  expect(behind.behindHours).toBe(14);
  expect(paceHealth({ day: 20, reportedHours: 100, benchmark: 34, goalMet: true }).label).toBe(
    "Target reached",
  );
});
