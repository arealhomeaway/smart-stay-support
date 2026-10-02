import { describe, expect, it } from "bun:test";
import {
  cleanCategories,
  needsFollowUp,
  parseSurveyAnswers,
  repeatIssues,
  repeatIssueText,
  surveyWindowOpen,
} from "@/lib/guest-feedback";

describe("guest feedback rules", () => {
  it("only a perfect score skips follow-up", () => {
    expect(needsFollowUp(5)).toBe(false);
    expect(needsFollowUp(4)).toBe(true);
    expect(needsFollowUp(1)).toBe(true);
    expect(needsFollowUp(null)).toBe(false);
  });

  it("drops hidden conditional answers when there were no issues", () => {
    const a = parseSurveyAnswers({
      overall: 4, stay_again: 5, had_issues: false, severity: "major",
      issue_categories: ["Cleaning"], reported_during_stay: "yes", follow_up_ok: true,
    });
    expect(a.severity).toBeUndefined();
    expect(a.issue_categories).toBeUndefined();
    expect(a.reported_during_stay).toBeUndefined();
  });

  it("keeps resolution only when the issue was reported", () => {
    const a = parseSurveyAnswers({ overall: 3, stay_again: 3, had_issues: true, reported_during_stay: "no", resolved_satisfactorily: "yes" });
    expect(a.resolved_satisfactorily).toBeUndefined();
    const b = parseSurveyAnswers({ overall: 3, stay_again: 3, had_issues: true, reported_during_stay: "yes", resolved_satisfactorily: "partly", issue_categories: ["Cleaning", "Bogus", "Cleaning"] });
    expect(b.resolved_satisfactorily).toBe("partly");
    expect(b.issue_categories).toEqual(["Cleaning"]);
  });

  it("requires the overall rating", () => {
    expect(() => parseSurveyAnswers({ stay_again: 3 })).toThrow();
  });

  it("filters unknown categories", () => {
    expect(cleanCategories(["Noise", "x", 3])).toEqual(["Noise"]);
  });

  it("counts prior matching categories inside the lookback only", () => {
    const cur = { id: "c", submitted_at: "2026-10-01T00:00:00Z", issue_categories: ["Cleaning", "Noise"] };
    const others = [
      { id: "a", submitted_at: "2026-09-01T00:00:00Z", issue_categories: ["Cleaning"] },
      { id: "b", submitted_at: "2026-06-01T00:00:00Z", issue_categories: ["Cleaning"] },
      { id: "old", submitted_at: "2025-01-01T00:00:00Z", issue_categories: ["Cleaning"] },
      { id: "later", submitted_at: "2026-10-05T00:00:00Z", issue_categories: ["Cleaning"] },
      cur,
    ];
    const r = repeatIssues(cur, others);
    expect(r).toEqual([{ category: "Cleaning", count: 2 }]);
    expect(repeatIssueText(r[0]!)).toBe("Possible repeat issue: Cleaning appeared in 2 prior feedback records in the last 180 days.");
  });

  it("keeps the survey open 14 days after checkout", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    expect(surveyWindowOpen("2026-09-20", now)).toBe(true);
    expect(surveyWindowOpen("2026-09-17", now)).toBe(false);
    expect(surveyWindowOpen("2026-10-03", now)).toBe(true);
    expect(surveyWindowOpen("2026-10-10", now)).toBe(false);
  });
});
