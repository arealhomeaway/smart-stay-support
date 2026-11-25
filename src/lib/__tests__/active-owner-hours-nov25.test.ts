import { describe, expect, it } from "bun:test";
import { centralToday } from "@/lib/central-today";
import { daysRemaining, ownerGoalMet, progressSnapshot, OWNER_GOAL_DISPLAY, OWNER_GOAL_LABEL } from "@/lib/owner-participation";
import { OWNER_SAVE_FALLBACK, activityCounter, ownerEntryProblem, ownerSaveMessage } from "@/lib/owner-save-error";
import { linkCount, linkCountLabel, splitLinks } from "@/lib/owner-links";
import { hoursChangeProblem } from "@/lib/homeowner-reopen";
import { answerRecipient } from "@/lib/owner-answers";

describe("Nov 25 Active Owner hours rules", () => {
  it("7:30 PM Central is still today in Central (UTC is already tomorrow)", () => {
    const at = new Date("2026-11-26T01:30:00Z"); // 7:30 PM CST Nov 25
    expect(centralToday(at)).toBe("2026-11-25");
  });
  it("exactly 100.0 hours is not goal met; more than 100 is", () => {
    expect(ownerGoalMet(6000)).toBe(false);
    expect(ownerGoalMet(6001)).toBe(true);
  });
  it("goal wording", () => {
    expect(OWNER_GOAL_LABEL).toBe("More than 100 hours");
    expect(OWNER_GOAL_DISPLAY).toBe("Goal: more than 100 hours · Recommended: 120 hours");
  });
  it("days left count from today Central to ends_on, including a future closing", () => {
    const now = new Date("2026-11-25T18:00:00Z");
    expect(daysRemaining("2026-11-30", "2026-12-31", now)).toBe(36);
    expect(daysRemaining("2026-03-01", "2026-12-31", now)).toBe(36);
  });
  it("pace targets 120 hours", () => {
    const s = progressSnapshot({ status: "active", startedOn: "2026-01-01", endsOn: "2026-12-31", reportedMinutes: 60 * 60 });
    expect(s.percentOfTarget).toBe(50);
    expect(s.hoursToGoal).toBe(60);
  });
  it("2,000 characters allowed, 2,001 names the field", () => {
    expect(ownerEntryProblem({ activity: "a".repeat(2000), minutes: "30" })).toBeNull();
    expect(ownerEntryProblem({ activity: "a".repeat(2001), minutes: "30" })).toMatch(/^What did you do\?/);
    expect(hoursChangeProblem({ mode: "edit", activity: "a".repeat(600), entryDate: "2026-11-25", minutes: 30, note: "", newFiles: 0 }, { activity: "x", entry_date: "2026-11-25", minutes: 30 }, "2026-11-25")).toBeNull();
    expect(activityCounter("a".repeat(517))).toBe("517 / 2,000");
  });
  it("internal wording never reaches owners", () => {
    expect(ownerSaveMessage(new Error("This opportunity needs a valid participation scope."))).toBe(OWNER_SAVE_FALLBACK);
    expect(ownerSaveMessage(new Error("This opportunity needs its canonical Property."))).toBe(OWNER_SAVE_FALLBACK);
    expect(ownerSaveMessage(new Error("The opportunity Ticket context changed."))).toBe(OWNER_SAVE_FALLBACK);
    expect(ownerSaveMessage(new Error("Choose a date no later than today."))).toBe("Choose a date no later than today.");
  });
  it("a Google Docs link is one clickable link", () => {
    const t = "Wrote the guidebook https://docs.google.com/document/d/abc/edit. Done";
    expect(splitLinks(t).filter((p) => p.kind === "link")[0]?.value).toBe("https://docs.google.com/document/d/abc/edit");
    expect(linkCountLabel(linkCount(t))).toBe("1 link attached");
  });
  it("answers go to the PM in onboarding, the follow-up role after handoff", () => {
    const seat = { holder: "followup", cover: null, onboardingDirector: "dir" };
    expect(answerRecipient({ propertyId: "h", project: { project_manager: "pm", director: null, ops_accepted_at: null, status: "active" } }, seat)).toBe("pm");
    expect(answerRecipient({ propertyId: "h", project: { project_manager: "pm", director: null, ops_accepted_at: "2026-11-01", status: "active" } }, seat)).toBe("followup");
  });
});
