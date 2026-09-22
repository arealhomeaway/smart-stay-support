import { expect, it } from "bun:test";
import { goLiveCountdown, todayCalendarDate } from "../onboarding-golive";
import type { Blocker } from "../onboarding-lifecycle";

const blocker = (patch: Partial<Blocker>): Blocker => ({
  taskId: "",
  what: "Something",
  owner: "Team",
  followUp: null,
  kind: "other",
  ...patch,
});

it("counts the days left to the target go-live date", () => {
  const view = goLiveCountdown({
    target: "2026-10-01",
    blockers: [],
    accepted: false,
    today: "2026-09-22",
  });
  expect(view.daysRemaining).toBe(9);
  expect(view.state).toBe("on_track");
  expect(view.countdownLabel).toBe("9 days remaining");
});

it("flags a target that has already passed", () => {
  const view = goLiveCountdown({
    target: "2026-09-20",
    blockers: [],
    accepted: false,
    today: "2026-09-22",
  });
  expect(view.state).toBe("overdue");
  expect(view.countdownLabel).toBe("2 days past target");
});

it("names the most pressing blocker as the bottleneck", () => {
  const view = goLiveCountdown({
    target: "2026-10-01",
    blockers: [
      blocker({ kind: "evidence", what: "Photos missing" }),
      blocker({ kind: "owner", what: "Awaiting owner mood board sign-off", taskId: "t1" }),
    ],
    accepted: false,
    today: "2026-09-22",
  });
  expect(view.bottleneck).toBe("Awaiting owner mood board sign-off");
  expect(view.bottleneckTaskId).toBe("t1");
});

it("an accepted home reads as live with no bottleneck", () => {
  const view = goLiveCountdown({
    target: "2026-09-01",
    blockers: [blocker({ kind: "owner" })],
    accepted: true,
    today: "2026-09-22",
  });
  expect(view.state).toBe("live");
  expect(view.bottleneck).toBeNull();
});

it("handles a home with no target date", () => {
  const view = goLiveCountdown({ target: null, blockers: [], accepted: false, today: "2026-09-22" });
  expect(view.state).toBe("none");
  expect(view.countdownLabel).toBe("No target date set");
  expect(todayCalendarDate(new Date(2026, 8, 22))).toBe("2026-09-22");
});
