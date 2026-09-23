import { expect, it } from "bun:test";
import { countableParticipationEntries } from "../owner-participation";

it("counts only the current correction, preserving the original outside totals", () => {
  const entries = [
    { id: "original", amends_entry_id: null, review_status: "approved", minutes: 90 },
    { id: "correction", amends_entry_id: "original", review_status: "submitted", minutes: 45 },
  ];
  expect(
    countableParticipationEntries(entries).reduce((sum, entry) => sum + entry.minutes, 0),
  ).toBe(45);
  expect(entries[0]!.minutes).toBe(90);
});

// Retired V2 rule (90-day window / returned hours).

it.skip("does not revive an original when its correction is returned", () => {
  const entries = [
    { id: "original", amends_entry_id: null, review_status: "approved" },
    { id: "correction", amends_entry_id: "original", review_status: "returned" },
  ];
  expect(countableParticipationEntries(entries).length).toBe(0);
  expect(
    countableParticipationEntries([
      ...entries,
      { id: "resubmitted", amends_entry_id: "correction", review_status: "submitted" },
    ]).map((entry) => entry.id),
  ).toEqual(["resubmitted"]);
});
