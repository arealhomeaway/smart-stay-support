import { describe, expect, it } from "bun:test";
import {
  acceptOfferLeadPatch,
  buildLeadInsertForOffer,
  buildOfferInsert,
  finderSearchFromLead,
  followUpDue,
  lastOffer,
  leadOutcome,
  offeredPropertyIds,
  offerOutcome,
  validateLeadLost,
  validateOfferDecision,
  waitingOffer,
  type LeadOffer,
} from "../lead-offers";
import { nextOption, rankAvailability, type AvailabilityResult } from "../availability-finder";
import { unknownFacts } from "../property-facts";
import type { LeadRow } from "../lead-types";

const SEARCH = {
  location: "Dallas, TX",
  checkIn: "2026-12-01",
  checkOut: "2026-12-31",
  guests: 4,
  dogs: 1,
  cats: 0,
  minBedrooms: 3,
};

function offer(id: string, propertyId: string, overrides: Partial<LeadOffer> = {}): LeadOffer {
  return {
    id, lead_id: "l1", property_id: propertyId, note: null,
    presented_at: "2026-11-05T12:00:00Z", added_by: "u1", created_at: "2026-11-05T12:00:00Z",
    quote_total: null, quote_currency: null, outcome: null,
    outcome_reason: null, outcome_at: null, outcome_by: null,
    ...overrides,
  };
}

describe("lead created from the first offer", () => {
  it("saves with no who-details at all, carrying the search", () => {
    const insert = buildLeadInsertForOffer(SEARCH, {}, "user-1");
    expect(insert.contact_name).toBeNull();
    expect(insert.company).toBeNull();
    expect(insert.phone).toBeNull();
    expect(insert.email).toBeNull();
    expect(insert.search_region).toBe("Dallas, TX");
    expect(insert.desired_move_in).toBe("2026-12-01");
    expect(insert.desired_check_out).toBe("2026-12-31");
    expect(insert.guests).toBe(4);
    expect(insert.dogs).toBe(1);
    expect(insert.pets).toBe(true);
    expect(insert.bedrooms).toBe(3);
    expect(insert.length_of_stay_days).toBe(30);
    expect(insert.stage).toBe("new");
    expect(insert.created_by).toBe("user-1");
  });

  it("keeps whatever who-details were typed", () => {
    const insert = buildLeadInsertForOffer(SEARCH, { organization: "ALE", contactName: "Sam", phone: "555", email: "s@x.com" }, "user-1");
    expect(insert.company).toBe("ALE");
    expect(insert.contact_name).toBe("Sam");
  });
});

describe("offer rows", () => {
  it("stores the quote total snapshot exactly as shown", () => {
    const insert = buildOfferInsert("l1", "p1", { total: 4320, currency: "USD" }, "user-1", new Date("2026-11-05T18:00:00Z"));
    expect(insert.quote_total).toBe(4320);
    expect(insert.quote_currency).toBe("USD");
    expect(insert.outcome).toBe("waiting");
    expect(insert.presented_at).toBe("2026-11-05T18:00:00.000Z");
  });

  it("an offer with no quote still records who offered it and when", () => {
    const insert = buildOfferInsert("l1", "p1", { total: null, currency: null }, "user-1");
    expect(insert.quote_total).toBeNull();
    expect(insert.added_by).toBe("user-1");
  });

  it("rows from before the offer columns read as waiting", () => {
    expect(offerOutcome(offer("o1", "p1"))).toBe("waiting");
  });
});

describe("offer decisions", () => {
  it("declined requires a reason", () => {
    expect(validateOfferDecision("declined", "")).toContain("reason");
    expect(validateOfferDecision("declined", "Too far from work")).toBeNull();
  });

  it("accepting an offer sets the lead Booked on that home", () => {
    const patch = acceptOfferLeadPatch(offer("o1", "home-9"), "user-2", new Date("2026-11-05T19:00:00Z"));
    expect(patch.stage).toBe("converted");
    expect(patch.converted_property_id).toBe("home-9");
    expect(patch.converted_by).toBe("user-2");
    expect(leadOutcome({ stage: "converted" } as LeadRow)).toBe("booked");
  });

  it("the waiting offer is the latest one without an answer", () => {
    const offers = [
      offer("o1", "p1", { outcome: "declined", presented_at: "2026-11-01T12:00:00Z" }),
      offer("o2", "p2", { presented_at: "2026-11-04T12:00:00Z" }),
    ];
    expect(waitingOffer(offers)?.id).toBe("o2");
    expect(lastOffer(offers)?.id).toBe("o2");
  });
});

describe("lost", () => {
  it("requires a reason, and a note when the reason is Other", () => {
    expect(validateLeadLost("", undefined)).toContain("reason");
    expect(validateLeadLost("other", "")).toContain("note");
    expect(validateLeadLost("other", "Chose a hotel")).toBeNull();
    expect(validateLeadLost("budget_too_low", undefined)).toBeNull();
  });
});

describe("choose another property skips every home already offered", () => {
  function home(id: string, distanceMiles: number): AvailabilityResult {
    return {
      id, name: `Home ${id}`, address: "", lat: 32.7, lng: -96.8,
      bedrooms: 3, bathrooms: 2, maxGuests: 8, imageUrl: null, bookingUrl: null,
      distanceMiles, status: "available", strConflicts: [], nonMovableConflicts: [],
      facts: unknownFacts(), factsUnavailable: null, quote: null, sourceQuote: null, quoteUnavailable: null,
    };
  }

  it("skips offered homes whatever their outcome, including declined ones", () => {
    const offers = [
      offer("o1", "p1", { outcome: "declined" }),
      offer("o2", "p2", { outcome: "accepted" }),
      offer("o3", "p3"),
    ];
    const skip = offeredPropertyIds(offers);
    expect(skip).toEqual(["p1", "p2", "p3"]);
    const ranked = rankAvailability([home("p1", 1), home("p2", 2), home("p3", 3), home("p4", 4)], SEARCH.checkIn, SEARCH.checkOut);
    expect(nextOption(ranked, skip)?.result.id).toBe("p4");
    expect(nextOption(ranked, [...skip, "p4"])).toBeNull();
  });

  it("the finder search replays from the lead with the lead attached", () => {
    const lead = {
      id: "lead-7",
      market: "Dallas, TX",
      desired_move_in: "2026-12-01",
      bedrooms: 3,
      stage: "new",
    } as unknown as LeadRow;
    const search = finderSearchFromLead(lead);
    expect(search.leadId).toBe("lead-7");
    expect(search.location).toBe("Dallas, TX");
    expect(search.checkIn).toBe("2026-12-01");
    expect(search.minBedrooms).toBe(3);
  });
});

describe("follow-up due", () => {
  it("is due when the set date is today or past, not before", () => {
    const now = new Date("2026-11-05T12:00:00");
    const lead = { next_follow_up_on: "2026-11-05" } as unknown as LeadRow;
    expect(followUpDue(lead, now)).toBe(true);
    expect(followUpDue({ next_follow_up_on: "2026-11-06" } as unknown as LeadRow, now)).toBe(false);
    expect(followUpDue({ next_follow_up_on: null } as unknown as LeadRow, now)).toBe(false);
  });
});
