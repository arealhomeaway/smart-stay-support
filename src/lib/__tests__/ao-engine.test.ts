import { describe, it, expect } from "bun:test";
import {
  joinOutcome, cardClock, dueEvent, addBusinessDays, ownerPace, canSendToActiveOwner,
  contributionsCsv, lockedLabel, expiryAlertText, type LibraryCard,
} from "../ao-engine";

const base: Omit<LibraryCard, "id" | "title" | "lane" | "stageWindow"> = {
  teamNeedsThis: true, lockRule: "none", linkedTemplateStepId: null,
  deadlineBusinessDays: 3, cutoffBusinessDays: 1, takeoverText: "ARHA will finish this.",
};
const early: LibraryCard = { ...base, id: "c1", title: "House rules", lane: "critical", stageWindow: "onboarding_early" };
const launch: LibraryCard = { ...base, id: "c2", title: "Welcome book photos", lane: "launch", stageWindow: "onboarding_launch", lockRule: "until_linked_step_done", linkedTemplateStepId: "step-photos" };
const flex: LibraryCard = { ...base, id: "c3", title: "Local favorites", lane: "flexible", stageWindow: "anytime" };

describe("join at current stage", () => {
  it("skips cards whose window has passed", () => {
    expect(joinOutcome(early, "onboarding_launch", new Set(), false)).toBe("skipped_passed");
    expect(joinOutcome(flex, "operations", new Set(), false)).toBe("open");
  });
  it("marks covered work", () => {
    expect(joinOutcome(early, "onboarding_early", new Set(["c1"]), false)).toBe("already_covered");
  });
  it("locks until the linked Task is done, then opens", () => {
    expect(joinOutcome(launch, "onboarding_launch", new Set(), false)).toBe("locked");
    expect(joinOutcome(launch, "onboarding_launch", new Set(), true)).toBe("open");
    expect(lockedLabel("take photos")).toBe("Coming soon: waiting on ARHA to take photos");
  });
});

describe("deadlines in business days, Central time", () => {
  it("skips weekends and holidays", () => {
    expect(addBusinessDays("2026-10-30", 1)).toBe("2026-11-02"); // Fri -> Mon
    expect(addBusinessDays("2026-10-30", 1, new Set(["2026-11-02"]))).toBe("2026-11-03");
  });
  it("deadline 5 pm, reminder 1 business day before, cutoff next business day 9 am", () => {
    const unlock = new Date("2026-10-29T15:00:00Z"); // Thu 10 am CDT
    const c = cardClock(launch, unlock);
    expect(c.deadline.toISOString()).toBe("2026-11-03T23:00:00.000Z"); // Tue 5 pm CST
    expect(c.reminder.toISOString()).toBe("2026-11-02T23:00:00.000Z"); // Mon 5 pm
    expect(c.cutoff.toISOString()).toBe("2026-11-04T15:00:00.000Z"); // Wed 9 am CST
  });
  it("reminds once, then expires; flexible never does", () => {
    const c = cardClock(launch, new Date("2026-10-29T15:00:00Z"));
    expect(dueEvent(launch, c, new Date("2026-11-03T00:00:00Z"), false, false)).toBe("send_reminder");
    expect(dueEvent(launch, c, new Date("2026-11-03T00:00:00Z"), true, false)).toBe("none");
    expect(dueEvent(launch, c, new Date("2026-11-04T15:00:00Z"), true, false)).toBe("expire");
    expect(dueEvent(flex, c, new Date("2026-12-01T00:00:00Z"), false, false)).toBe("none");
    expect(expiryAlertText("Welcome book photos")).toBe("Homeowner did not complete Welcome book photos; proceed as normal");
  });
});

describe("owner pace and send gate", () => {
  it("weekly hours to reach 100 by end date", () => {
    const p = ownerPace(60, new Date("2026-11-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"));
    expect(p.weeklyNeeded).toBe(4.7);
    expect(p.onTrack).toBe(true);
    expect(ownerPace(0, new Date("2026-12-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z")).label).toBe("Behind");
  });
  it("Send to Active Owner hidden for non-enrolled homes", () => {
    expect(canSendToActiveOwner(null)).toBe(false);
    expect(canSendToActiveOwner("pending")).toBe(false);
    expect(canSendToActiveOwner("active")).toBe(true);
  });
  it("exports contributions as CSV", () => {
    const csv = contributionsCsv([{ card: "House rules", home: "12 Elm", member: "Rachel", submittedAt: "2026-11-01", values: { pets: "no, sorry" } }]);
    expect(csv).toBe('Card,Home,Submitted by,Submitted at,pets\nHouse rules,12 Elm,Rachel,2026-11-01,"no, sorry"');
  });
});
