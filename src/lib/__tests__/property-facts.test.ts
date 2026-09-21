import { describe, expect, it } from "bun:test";
import { applyRequirements, needsStrRebook, rebookStepSummary, type AvailabilityResult } from "@/lib/availability-finder";
import { confirmedAmenities, factsFromOwnerRez, matchesRequirements, petSummary, unknownFacts } from "@/lib/property-facts";

const listing = {
  amenity_call_outs: [{ text: "Fast wifi" }],
  amenity_categories: [
    { type: "PopularAmenityFeatures", amenities: [{ text: "Internet" }, { text: "Air conditioning" }] },
    { type: "PoolSpaFeatures", amenities: [{ text: "No pool" }] },
  ],
};

function result(overrides: Partial<AvailabilityResult>): AvailabilityResult {
  return {
    id: "p1", name: "Willow", address: "1 Main", lat: 1, lng: 1,
    bedrooms: 2, bathrooms: 1, maxGuests: 4, imageUrl: null, bookingUrl: null,
    distanceMiles: 1, status: "available", strConflicts: [], nonMovableConflicts: [],
    facts: unknownFacts(), factsUnavailable: null,
    ...overrides,
  } as AvailabilityResult;
}

describe("property facts from OwnerRez", () => {
  it("reads pets from max_pets", () => {
    expect(factsFromOwnerRez(2, listing).petsAllowed).toBe(true);
    expect(factsFromOwnerRez(2, listing).maxPets).toBe(2);
    expect(factsFromOwnerRez(0, listing).petsAllowed).toBe(false);
    expect(factsFromOwnerRez(null, null).petsAllowed).toBeNull();
  });

  it("confirms published amenities and denies explicit negatives", () => {
    const facts = factsFromOwnerRez(2, listing);
    expect(facts.amenities.wifi).toBe(true);
    expect(facts.amenities.air_conditioning).toBe(true);
    expect(facts.amenities.pool).toBe(false);
    expect(confirmedAmenities(facts)).toContain("wifi");
  });

  it("leaves unpublished amenities unknown rather than no", () => {
    const facts = factsFromOwnerRez(2, null);
    expect(facts.amenities.hot_tub).toBeNull();
    expect(facts.amenitiesUnpublished).toBe(true);
  });

  it("never matches a requirement the source does not confirm", () => {
    const facts = factsFromOwnerRez(2, null);
    expect(matchesRequirements(facts, { amenities: ["hot_tub"] }).ok).toBe(false);
    expect(matchesRequirements(facts, { dogs: 1 }).ok).toBe(true);
    expect(matchesRequirements(facts, { dogs: 2, cats: 1 }).ok).toBe(false);
  });

  it("reads dogs and cats separately when the listing says so", () => {
    const dogsOnly = factsFromOwnerRez(2, {
      amenity_categories: [{ type: "HouseRules", amenities: [{ text: "Dogs only" }] }],
    });
    expect(dogsOnly.dogsAllowed).toBe(true);
    expect(dogsOnly.catsAllowed).toBe(false);
    expect(matchesRequirements(dogsOnly, { dogs: 1 }).ok).toBe(true);
    expect(matchesRequirements(dogsOnly, { cats: 1 }).ok).toBe(false);
    const noPets = factsFromOwnerRez(0, null);
    expect(noPets.dogsAllowed).toBe(false);
    expect(noPets.catsAllowed).toBe(false);
  });

  it("holds back homes smaller than the bedrooms asked for", () => {
    const facts = factsFromOwnerRez(2, listing);
    expect(matchesRequirements(facts, { minBedrooms: 3 }, { bedrooms: 2 }).ok).toBe(false);
    expect(matchesRequirements(facts, { minBedrooms: 2 }, { bedrooms: 3 }).ok).toBe(true);
    expect(matchesRequirements(facts, { minBedrooms: 2 }, { bedrooms: null }).reasons[0]).toContain(
      "not on file",
    );
  });

  it("summarises pets in plain words", () => {
    expect(petSummary(factsFromOwnerRez(0, listing)).toLowerCase()).toContain("no pets");
    expect(petSummary(unknownFacts()).toLowerCase()).toContain("not published");
  });
});

describe("availability filtering", () => {
  it("hides homes without a confirmed answer from a filtered search", () => {
    const withPets = result({ id: "a", facts: factsFromOwnerRez(2, listing) });
    const unknown = result({ id: "b", facts: unknownFacts() });
    const split = applyRequirements([withPets, unknown], { dogs: 1, amenities: ["wifi"] });
    expect(split.matched.map((row) => row.id)).toEqual(["a"]);
    expect(split.heldBack[0]?.result.id).toBe("b");
  });

  it("returns everything when nothing was required", () => {
    const rows = [result({ id: "a" }), result({ id: "b" })];
    expect(applyRequirements(rows, {}).matched).toHaveLength(2);
  });

  it("flags the short-stay re-book second step", () => {
    const conditional = result({
      status: "conditional",
      strConflicts: [{ arrival: "2026-05-01", departure: "2026-05-04" } as never],
    });
    expect(needsStrRebook(conditional)).toBe(true);
    expect(rebookStepSummary(conditional)).toContain("1 short stay");
    expect(needsStrRebook(result({}))).toBe(false);
  });
});
