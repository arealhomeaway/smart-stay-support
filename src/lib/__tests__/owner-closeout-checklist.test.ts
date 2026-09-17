import { expect, it } from "bun:test";
import { completionChecklist } from "../owner-program.server";

it("does not allow closeout while counted participation has no activity", () => {
  const result = completionChecklist({
    goalMet: true,
    program: { startedOn: "2026-01-01", endsOn: "2026-03-31" },
    includedProperties: [{ openTasks: 0 }],
    reviews: [],
    entries: [
      {
        id: "entry",
        entry_date: "2026-01-02",
        amends_entry_id: null,
        review_status: "approved",
        activity: "  ",
      },
    ],
  } as never);
  expect(result.entriesAttributed).toBe(false);
  expect(result.allClear).toBe(false);
});

it("allows a documented correction without requiring historical originals to be rewritten", () => {
  const result = completionChecklist({
    goalMet: true,
    program: { startedOn: "2026-01-01", endsOn: "2026-03-31" },
    includedProperties: [{ openTasks: 0 }],
    reviews: [],
    entries: [
      {
        id: "original",
        entry_date: "2026-01-02",
        amends_entry_id: null,
        review_status: "returned",
        activity: "",
      },
      {
        id: "correction",
        entry_date: "2026-01-02",
        amends_entry_id: "original",
        review_status: "approved",
        activity: "Reviewed furnishing layout",
      },
    ],
  } as never);
  expect(result.entriesAttributed).toBe(true);
  expect(result.allClear).toBe(true);
});
