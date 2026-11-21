import { describe, expect, it } from "vitest";
import { shownBadges } from "../owner-participation";

describe("flagged badges are not shown as earned", () => {
  const badges = [
    { code: "first_step", needs_review: false },
    { code: "halfway", needs_review: true },
    { code: "strong_finish", needs_review: true },
    { code: "engaged_owner", needs_review: null },
  ];

  it("leaves out every badge the refresh flagged", () => {
    expect(shownBadges(badges).map((b) => b.code)).toEqual(["first_step", "engaged_owner"]);
  });

  it("shows a badge again once the refresh clears the flag", () => {
    const recovered = badges.map((b) => (b.code === "halfway" ? { ...b, needs_review: false } : b));
    expect(shownBadges(recovered).map((b) => b.code)).toContain("halfway");
  });
});
