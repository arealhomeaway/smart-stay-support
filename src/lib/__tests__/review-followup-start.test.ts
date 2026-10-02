import { describe, expect, it } from "bun:test";
import { readReviewFollowUpStart, reviewImportDecision } from "../guest-feedback";

describe("review follow-up start date", () => {
  it("no start date → every review is historical", () => {
    expect(reviewImportDecision(2, "2026-10-05T12:00:00Z", null)).toBe("historical");
  });
  it("before start → historical, even under 5 stars", () => {
    expect(reviewImportDecision(3, "2026-09-30T12:00:00Z", "2026-10-02")).toBe("historical");
  });
  it("uses Central calendar day (late evening UTC-5 counts as prior day)", () => {
    expect(reviewImportDecision(3, "2026-10-02T03:00:00Z", "2026-10-02")).toBe("historical");
    expect(reviewImportDecision(3, "2026-10-02T06:00:00Z", "2026-10-02")).toBe("follow_up");
  });
  it("on/after start → under 5 follows up, 5 does not", () => {
    expect(reviewImportDecision(4, "2026-10-03T12:00:00Z", "2026-10-02")).toBe("follow_up");
    expect(reviewImportDecision(5, "2026-10-03T12:00:00Z", "2026-10-02")).toBe("no_follow_up");
  });
  it("missing publish date is never followed up", () => {
    expect(reviewImportDecision(2, null, "2026-10-02")).toBe("historical");
  });
  it("reads only valid settings", () => {
    expect(readReviewFollowUpStart({ date: "2026-10-02" })).toBe("2026-10-02");
    expect(readReviewFollowUpStart({ date: "soon" })).toBe(null);
    expect(readReviewFollowUpStart(null)).toBe(null);
  });
});
