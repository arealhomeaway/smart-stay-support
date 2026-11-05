import { describe, expect, it } from "bun:test";
import {
  isThirtyDayFirm, nextOption, rankAvailability,
  type AvailabilityResult, type ReservationConflict,
} from "../availability-finder";
import { unknownFacts } from "../property-facts";

const CHECK_IN = "2026-12-01";
const CHECK_OUT = "2026-12-31";

function home(id: string, name: string, distanceMiles: number, strConflicts: ReservationConflict[] = [], nonMovableConflicts: ReservationConflict[] = []): AvailabilityResult {
  return {
    id, name, address: `${id} street`, lat: 32.7, lng: -96.8,
    bedrooms: 3, bathrooms: 2, maxGuests: 8, imageUrl: null, bookingUrl: null,
    distanceMiles,
    status: nonMovableConflicts.length ? "unavailable" : strConflicts.length ? "conditional" : "available",
    strConflicts, nonMovableConflicts,
    facts: unknownFacts(), factsUnavailable: null,
    quote: null, sourceQuote: null, quoteUnavailable: null,
  };
}

const str = (arrival: string, departure: string): ReservationConflict => ({ arrival, departure, kind: "str" });
const long = (arrival: string, departure: string): ReservationConflict => ({ arrival, departure, kind: "non_movable" });

describe("30D FIRM detection", () => {
  it("matches the listing-name marker case-insensitively", () => {
    expect(isThirtyDayFirm("Oak Villa (30D FIRM)")).toBe(true);
    expect(isThirtyDayFirm("Oak Villa (30d firm)")).toBe(true);
    expect(isThirtyDayFirm("Oak Villa")).toBe(false);
    expect(isThirtyDayFirm("30D Firmwood Lane")).toBe(false);
  });
});

describe("availability ranking", () => {
  it("puts open 30D FIRM homes first, then other open homes, closest first inside each tier", () => {
    const ranked = rankAvailability([
      home("open-far", "Maple House", 9),
      home("firm-far", "Cedar Lodge (30D FIRM)", 12),
      home("open-near", "Birch House", 2),
      home("firm-near", "Aspen Place (30D FIRM)", 5),
    ], CHECK_IN, CHECK_OUT);
    expect(ranked.map((option) => option.result.id)).toEqual(["firm-near", "firm-far", "open-near", "open-far"]);
    expect(ranked[0]!.label).toBe("30D Firm, open the whole stay");
    expect(ranked[2]!.label).toBe("Open, no short stays");
  });

  it("never offers a home with a long stay or block overlapping the dates", () => {
    const ranked = rankAvailability([
      home("long-stay", "Pine House", 1, [], [long("2026-11-01", "2027-02-01")]),
      home("open", "Elm House", 8),
    ], CHECK_IN, CHECK_OUT);
    expect(ranked.map((option) => option.result.id)).toEqual(["open"]);
  });

  it("uses tier 3 only when no home is fully open, fewest short stays first, then fewest nights affected, then closest", () => {
    const ranked = rankAvailability([
      home("two-stays", "A", 3, [str("2026-12-05", "2026-12-08"), str("2026-12-15", "2026-12-18")]),
      home("one-stay-more-nights", "B", 1, [str("2026-12-02", "2026-12-12")]),
      home("one-stay-fewer-nights", "C", 6, [str("2026-12-02", "2026-12-05")]),
      home("blocked", "D", 0.5, [], [long("2026-12-01", "2027-01-15")]),
    ], CHECK_IN, CHECK_OUT);
    expect(ranked.map((option) => option.result.id)).toEqual(["one-stay-fewer-nights", "one-stay-more-nights", "two-stays"]);
    expect(ranked[0]!.tier).toBe("rebook");
    expect(ranked[0]!.label).toBe("Has 1 short stay to re-book");
    expect(ranked[2]!.label).toBe("Has 2 short stays to re-book");
  });

  it("keeps fully open homes ahead even when a rebook home is closer", () => {
    const ranked = rankAvailability([
      home("rebook-near", "A", 1, [str("2026-12-05", "2026-12-08")]),
      home("open-far", "B", 15),
    ], CHECK_IN, CHECK_OUT);
    expect(ranked.map((option) => option.result.id)).toEqual(["open-far"]);
  });
});

describe("next option session memory", () => {
  const ranked = rankAvailability([
    home("firm", "Cedar Lodge (30D FIRM)", 5),
    home("open", "Birch House", 2),
  ], CHECK_IN, CHECK_OUT);

  it("returns the first home not yet shown or declined", () => {
    expect(nextOption(ranked, [])?.result.id).toBe("firm");
    expect(nextOption(ranked, ["firm"])?.result.id).toBe("open");
  });

  it("never repeats a home and returns null when every option was seen", () => {
    expect(nextOption(ranked, ["firm", "open"])).toBeNull();
  });
});
