import { describe, expect, it } from "bun:test";
import { findRepeatEntry, isAlreadySaved, repeatQuestion, similarDescription } from "@/lib/hours-repeat";

const ME = "owner-1";
const entries = [
  { id: "a", entry_date: "2026-11-16", activity: "Review your Make Ready Estimate", review_id: "opp-1", owner_user_id: ME, created_at: "2026-11-16T15:00:00Z" },
  { id: "b", entry_date: "2026-11-16", activity: "Called the insurance agent about coverage", review_id: null, owner_user_id: ME, created_at: "2026-11-16T16:00:00Z" },
  { id: "c", entry_date: "2026-11-16", activity: "Called the insurance agent about coverage", review_id: null, owner_user_id: ME, superseded: true, created_at: "2026-11-16T14:00:00Z" },
  { id: "d", entry_date: "2026-11-16", activity: "Walked the home with the stager", review_id: null, owner_user_id: "co-owner", created_at: "2026-11-16T17:00:00Z" },
];

describe("Update that one instead? (Nov 21)", () => {
  it("asks when the same date has a similar description", () => {
    const m = findRepeatEntry({ entryDate: "2026-11-16", activity: "Called the insurance agent about our coverage", reviewId: null }, entries, ME);
    expect(m?.id).toBe("b");
  });
  it("asks when the same date has the same opportunity, even with new wording", () => {
    const m = findRepeatEntry({ entryDate: "2026-11-16", activity: "Reviewed the make-ready report and photos", reviewId: "opp-1" }, entries, ME);
    expect(m?.id).toBe("a");
  });
  it("does not ask on a different date", () => {
    expect(findRepeatEntry({ entryDate: "2026-11-17", activity: "Called the insurance agent about coverage", reviewId: "opp-1" }, entries, ME)).toBeNull();
  });
  it("ignores replaced entries and another homeowner's entries", () => {
    const onlyOld = entries.filter((e) => e.id === "c" || e.id === "d");
    expect(findRepeatEntry({ entryDate: "2026-11-16", activity: "Called the insurance agent about coverage", reviewId: null }, onlyOld, ME)).toBeNull();
    expect(findRepeatEntry({ entryDate: "2026-11-16", activity: "Walked the home with the stager", reviewId: null }, entries, ME)).toBeNull();
  });
  it("does not ask for unrelated work on the same date", () => {
    expect(similarDescription("Picked paint colors for the bedrooms", "Called the insurance agent about coverage")).toBe(false);
    expect(findRepeatEntry({ entryDate: "2026-11-16", activity: "Picked paint colors for the bedrooms", reviewId: null }, entries, ME)).toBeNull();
  });
  it("words the question with the title and date", () => {
    expect(repeatQuestion("Review your Make Ready Estimate", "Nov 16")).toBe("You already logged Review your Make Ready Estimate on Nov 16. Update that one instead?");
  });
});

describe("double save answer", () => {
  it("recognizes the server's Already saved.", () => {
    expect(isAlreadySaved(new Error("Already saved."))).toBe(true);
    expect(isAlreadySaved(new Error("This entry was already updated. Refresh to see the latest version."))).toBe(false);
  });
});
