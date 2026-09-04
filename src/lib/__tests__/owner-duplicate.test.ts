import { describe, expect, it } from "bun:test";
import { findPossibleDuplicate, minutesAreSimilar, textSimilarity } from "@/lib/owner-duplicate";

const base = {
  id: "e1",
  entry_date: "2026-09-01",
  minutes: 60,
  activity: "Reviewed the furnishing quote and approved the layout",
  activity_category: "Review",
};

describe("owner near-duplicate detection", () => {
  it("flags an exact re-submission", () => {
    const hit = findPossibleDuplicate(
      { entryDate: "2026-09-01", minutes: 60, activity: base.activity, activityCategory: "Review" },
      [base],
    );
    expect(hit?.id).toBe("e1");
  });

  it("flags a near-identical duration and wording", () => {
    const hit = findPossibleDuplicate(
      {
        entryDate: "2026-09-01",
        minutes: 63,
        activity: "reviewed the furnishing quote, and approved the layout.",
        activityCategory: "Review",
      },
      [base],
    );
    expect(hit?.id).toBe("e1");
  });

  it("does not flag genuinely different work on the same day", () => {
    const hit = findPossibleDuplicate(
      {
        entryDate: "2026-09-01",
        minutes: 60,
        activity: "Met the landscaper on site",
        activityCategory: "Review",
      },
      [base],
    );
    expect(hit).toBeNull();
  });

  it("does not flag the same activity on a different date", () => {
    const hit = findPossibleDuplicate(
      { entryDate: "2026-09-02", minutes: 60, activity: base.activity, activityCategory: "Review" },
      [base],
    );
    expect(hit).toBeNull();
  });

  it("does not flag a materially different duration", () => {
    const hit = findPossibleDuplicate(
      {
        entryDate: "2026-09-01",
        minutes: 180,
        activity: base.activity,
        activityCategory: "Review",
      },
      [base],
    );
    expect(hit).toBeNull();
  });

  it("does not flag when the recorded category differs", () => {
    const hit = findPossibleDuplicate(
      {
        entryDate: "2026-09-01",
        minutes: 60,
        activity: base.activity,
        activityCategory: "Vendor coordination",
      },
      [base],
    );
    expect(hit).toBeNull();
  });

  it("ignores an entry already superseded by a correction", () => {
    const hit = findPossibleDuplicate(
      { entryDate: "2026-09-01", minutes: 60, activity: base.activity, activityCategory: "Review" },
      [{ ...base, superseded: true }],
    );
    expect(hit).toBeNull();
  });

  it("keeps minute and text helpers conservative", () => {
    expect(minutesAreSimilar(60, 66)).toBe(true);
    expect(minutesAreSimilar(60, 90)).toBe(false);
    expect(textSimilarity("walk through the home", "walk through the home")).toBe(1);
    expect(textSimilarity("walk through the home", "call the insurance adjuster") < 0.3).toBe(true);
  });
});
