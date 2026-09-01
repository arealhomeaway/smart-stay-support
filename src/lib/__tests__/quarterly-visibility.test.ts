import { describe, expect, it } from "bun:test";
import { validateHandoff } from "@/lib/onboarding";

const property = {
  address_line1: "1 Main St",
  city: "Oklahoma City",
  state: "OK",
  postal_code: "73008",
  latitude: 35.5,
  longitude: -97.5,
  access_notes: "Lockbox at the side door.",
  quarterly_review_due_on: null,
};

describe("quarterly review visibility", () => {
  it("hides the review readiness check while the feature is off", () => {
    const { checks } = validateHandoff(property, [], { includeQuarterlyReview: false });
    expect(checks.some((c) => c.key === "review_due")).toBe(false);
  });

  it("shows the review readiness check when the feature is on", () => {
    const { checks } = validateHandoff(property, [], { includeQuarterlyReview: true });
    expect(checks.some((c) => c.key === "review_due")).toBe(true);
  });

  it("keeps the review check out of the blocking set either way", () => {
    const on = validateHandoff(property, [], { includeQuarterlyReview: true });
    const off = validateHandoff(property, [], { includeQuarterlyReview: false });
    expect(on.ready).toBe(off.ready);
  });
});
