import { expect, it } from "bun:test";
import { participationYearTotals, inParticipationWindow } from "../owner-participation";

it("homes closing the same year share one total; each activity once", () => {
  const entries = [
    { entry_date: "2026-09-15", minutes: 60 }, // pre-closing, same year: counts
    { entry_date: "2026-10-10", minutes: 120 }, // House A only
    { entry_date: "2026-11-05", minutes: 180 }, // A, B or General
    { entry_date: "2027-02-01", minutes: 90 }, // another year
  ];
  const t = "2027-12-31";
  expect(participationYearTotals(entries, ["2026-10-01", "2026-11-01"], t)).toEqual([
    { year: "2026", minutes: 360 },
  ]);
  // A home in 2027 is separate and never inherits 2026 hours.
  expect(participationYearTotals(entries, ["2026-10-01", "2027-01-15"], t)).toEqual([
    { year: "2026", minutes: 360 },
    { year: "2027", minutes: 90 },
  ]);
  expect(inParticipationWindow("2026-01-02", "2026-10-01", "2026-12-31", t)).toBe(true);
  expect(inParticipationWindow("2025-12-31", "2026-10-01", "2026-12-31", t)).toBe(false);
});
