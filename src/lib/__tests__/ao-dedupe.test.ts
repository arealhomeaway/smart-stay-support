import { describe, expect, it } from "bun:test";
import { coveredReasonLabel, describeMatch, isCardExistsError } from "@/lib/ao-dedupe";

describe("card de-duplication screen rules", () => {
  it("recognizes the database refusal for a card already on the plan", () => {
    expect(isCardExistsError('This home already has "Authorize the make-ready estimate" on its Active Owner plan. Open that card')).toBe(true);
    expect(isCardExistsError("Not allowed")).toBe(false);
  });
  it("explains why a card is covered", () => {
    expect(coveredReasonLabel("confirmed_map", "Readiness call")).toBe("Matches an existing owner item you confirmed: Readiness call");
  });
  it("describes map entries plainly", () => {
    expect(describeMatch({ match_kind: "title_pattern", match_value: "%readiness call%" })).toBe('Title contains "readiness call"');
  });
});
