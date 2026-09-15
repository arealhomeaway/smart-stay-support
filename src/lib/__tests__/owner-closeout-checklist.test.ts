import { expect, it } from "bun:test";
import { completionChecklist } from "../owner-program.server";

it("does not allow closeout while counted participation has no activity", () => {
  const result = completionChecklist({
    goalMet: true,
    includedProperties: [{ openTasks: 0 }],
    reviews: [],
    entries: [{ id: "entry", amends_entry_id: null, review_status: "approved", activity: "  " }],
  } as never);
  expect(result.entriesAttributed).toBe(false);
  expect(result.allClear).toBe(false);
});

it("allows a documented correction without requiring historical originals to be rewritten", () => {
  const result = completionChecklist({
    goalMet: true,
    includedProperties: [{ openTasks: 0 }],
    reviews: [],
    entries: [
      { id: "original", amends_entry_id: null, review_status: "returned", activity: "" },
      {
        id: "correction",
        amends_entry_id: "original",
        review_status: "approved",
        activity: "Reviewed furnishing layout",
      },
    ],
  } as never);
  expect(result.entriesAttributed).toBe(true);
  expect(result.allClear).toBe(true);
});
