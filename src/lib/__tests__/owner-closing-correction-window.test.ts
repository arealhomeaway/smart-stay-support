import { expect, it } from "bun:test";
import { propertyWindowMinutes, combinedWindowMinutes } from "../owner-participation";

// Correcting one home's closing changes only that home's window: the other
// home's total, the recorded entries and the combined (once-only) total of
// activities inside some window are otherwise unaffected.
it("closing correction moves only the corrected home's window", () => {
  const entries = [
    { entry_date: "2026-10-10", minutes: 120 }, // A only (before B closes)
    { entry_date: "2026-11-05", minutes: 180 }, // both
    { entry_date: "2026-11-20", minutes: 60 }, // general, both
  ];
  const today = "2026-12-01";
  const before = { a: "2026-10-01", b: "2026-11-01" };
  const after = { a: "2026-10-01", b: "2026-11-10" }; // B corrected later
  expect(propertyWindowMinutes(entries, before.a, today)).toBe(360);
  expect(propertyWindowMinutes(entries, after.a, today)).toBe(360);
  expect(propertyWindowMinutes(entries, before.b, today)).toBe(240);
  expect(propertyWindowMinutes(entries, after.b, today)).toBe(60);
  expect(combinedWindowMinutes(entries, [before.a, before.b], today)).toBe(360);
  expect(combinedWindowMinutes(entries, [after.a, after.b], today)).toBe(360);
  expect(entries.length).toBe(3); // nothing removed
});
