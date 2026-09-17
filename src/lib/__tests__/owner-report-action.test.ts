import { expect, it } from "bun:test";
import { ownerReportAction } from "../owner-report-action";

it("records known program events without publishing arbitrary audit text or values", () => {
  const event = {
    kind: "program_updated",
    created_at: "2026-09-16T12:00:00Z",
    summary: "PRIVATE staff instructions",
    new_value: "PRIVATE credentials",
    detail: { internalNotes: "PRIVATE" },
  };
  expect(ownerReportAction(event)).toEqual({
    date: "2026-09-16",
    kind: "program updated",
    summary: "ARHA updated the participation program details.",
    document: "",
  });
  expect(event.summary).toBe("PRIVATE staff instructions");
});

it("does not infer owner publication from event prefixes or inherited object names", () => {
  for (const kind of [
    "program_private",
    "review_internal",
    "decision_staff",
    "constructor",
    "__proto__",
  ]) {
    expect(ownerReportAction({ kind, created_at: "2026-09-16" })).toBe(null);
  }
});
