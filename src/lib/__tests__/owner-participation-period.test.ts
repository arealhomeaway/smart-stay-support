/**
 * One counting rule for every hours total (portal, staff, analytics, badges,
 * CSV, PDF): confirmed closings set the participation years; started_on is
 * only the fallback; with neither, nothing counts. Synthetic fixtures only.
 */
import { describe, expect, it } from "bun:test";
import {
  aggregateParticipationPeriod,
  countedParticipationEntries,
  countsTowardParticipation,
  participationYearTotals,
} from "../owner-participation";
import { ownerHoursEligibility } from "../owner-hours-eligibility";
import { earnedBadges } from "../owner-badges.server";
import type { ProgramAggregate } from "../owner-participation.server";

const TODAY = "2026-10-12";
const e = (
  id: string,
  entry_date: string,
  minutes: number,
  amends_entry_id: string | null = null,
  propertyIds: string[] = ["home-a"],
) => ({ id, entry_date, minutes, amends_entry_id, propertyIds });
const sum = (rows: { minutes: number }[]) => rows.reduce((n, r) => n + r.minutes, 0);

// Linder-shaped synthetic fixture: draft, no started_on, closing 2026-10-06.
const linderShaped = [
  e("1", "2026-10-06", 80),
  e("2", "2026-10-10", 60),
  e("3", "2026-10-10", 60),
  e("4", "2026-10-10", 90),
  e("5", "2026-10-10", 30),
  e("6", "2026-10-12", 120),
  e("7", "2026-10-12", 90),
];
const draftPeriod = { closingDates: ["2026-10-06"], startedOn: null, endsOn: null };

describe("participation counting period", () => {
  it("1. draft program, confirmed past closing, no started_on: counts immediately", () => {
    expect(sum(countedParticipationEntries(linderShaped, draftPeriod, TODAY))).toBe(530);
  });

  it("2. future-only closing opens logging; future entries still never count", () => {
    const elig = ownerHoursEligibility(
      { status: "draft" },
      [{ inclusionStatus: "included", closingConfirmed: true, closingDate: "2026-11-01" }],
      TODAY,
    );
    expect(elig).toEqual({ eligible: true, openedOn: "2026-11-01" });
    // A future-dated entry never counts, even in the closing year.
    expect(countsTowardParticipation("2026-11-02", { closingDates: ["2026-11-01"], startedOn: null }, TODAY)).toBe(false);
  });

  it("3. entry before a home's closing but in the same year counts", () => {
    expect(countsTowardParticipation("2026-02-01", draftPeriod, TODAY)).toBe(true);
    expect(countsTowardParticipation("2025-12-31", draftPeriod, TODAY)).toBe(false);
  });

  it("4. homes closing the same year share one total; each activity once", () => {
    const rows = [e("s", "2026-10-07", 100, null, ["home-a", "home-b"]), e("a", "2026-10-08", 50)];
    const period = { closingDates: ["2026-10-06", "2026-09-01"], startedOn: null };
    expect(sum(countedParticipationEntries(rows, period, TODAY))).toBe(150);
  });

  it("5. different closing years keep separate totals", () => {
    const rows = [e("a", "2026-10-07", 100), e("b", "2027-02-01", 40)];
    expect(participationYearTotals(rows, ["2026-10-06", "2027-01-15"], "2027-12-31")).toEqual([
      { year: "2026", minutes: 100 },
      { year: "2027", minutes: 40 },
    ]);
  });

  it("6. a corrected entry replaces the original", () => {
    const rows = [e("old", "2026-10-07", 100), e("new", "2026-10-07", 70, "old")];
    expect(sum(countedParticipationEntries(rows, draftPeriod, TODAY))).toBe(70);
  });

  it("7. General and home-tagged activity follow the same rule, once each", () => {
    const rows = [e("g", "2026-10-07", 45, null, []), e("p", "2026-10-07", 15)];
    expect(sum(countedParticipationEntries(rows, draftPeriod, TODAY))).toBe(60);
  });

  it("8. no confirmed closing: started_on fallback still works", () => {
    const period = { closingDates: [], startedOn: "2026-03-01", endsOn: null };
    expect(countsTowardParticipation("2026-05-01", period, TODAY)).toBe(true);
    expect(countsTowardParticipation("2025-05-01", period, TODAY)).toBe(false);
  });

  it("9. no closing and no started_on: no window invented", () => {
    const period = { closingDates: [null, undefined], startedOn: null, endsOn: null };
    expect(countedParticipationEntries(linderShaped, period, TODAY)).toEqual([]);
  });

  it("10. expected closing years count without waiting for confirmation", () => {
    const agg = {
      program: { id: "p", status: "draft", startedOn: null, endsOn: null },
      entries: linderShaped.map((r) => ({ ...r, review_status: "submitted" })),
      includedProperties: [
        { propertyId: "home-a", closingDate: "2026-10-06", closingConfirmed: true },
        { propertyId: "home-x", closingDate: "2025-01-01", closingConfirmed: false },
      ],
      reviews: [],
      badges: [],
    } as unknown as ProgramAggregate;
    const period = aggregateParticipationPeriod(agg);
    expect(period.closingDates).toEqual(["2026-10-06", "2025-01-01"]);
    expect(sum(countedParticipationEntries(agg.entries, period, TODAY))).toBe(530);
    expect(earnedBadges(agg).map((b) => b.code)).toContain("first_step");
  });
});
