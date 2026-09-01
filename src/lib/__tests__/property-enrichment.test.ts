import { describe, expect, it } from "bun:test";
import { planEnrichment } from "@/lib/property-enrichment.server";

const now = new Date("2026-09-01T12:00:00.000Z");

const listing = {
  id: 494863,
  name: "1399 Foxtail Ln.",
  owner_id: 150923240,
  bedrooms: 4,
  bathrooms: 2,
  max_guests: 8,
  living_area: 1786,
  property_type: "house",
  check_in: "16:00",
  check_out: "10:00",
  time_zone: "America/New_York",
  public_url: "https://arealhomeaway.hosted.ownerrez.com/foxtail",
  thumbnail_url: "https://uc.orez.io/i/abc-Thumb",
  thumbnail_url_medium: "https://uc.orez.io/i/abc-Medium",
  thumbnail_url_large: "https://uc.orez.io/f/abc",
  latitude: 39.5,
  longitude: -86.1,
};

const owner = {
  id: 150923240,
  name: "Matt Linder",
  email_address: "owner@example.com",
  phone: { number: "+1 419-203-8789" },
  active: true,
};

function prop(over: Partial<{ id: string; name: string; ownerrez_property_id: string | null }> = {}) {
  return {
    id: "p1",
    name: "Foxtail",
    ownerrez_property_id: "494863",
    latitude: null,
    longitude: null,
    ...over,
  };
}

describe("planEnrichment", () => {
  it("fills facts, photo and owner link for a matched listing", () => {
    const plan = planEnrichment([prop()], [listing], [owner], now);
    const patch = plan.patches[0]!;
    expect(patch.values["bedrooms"]).toBe(4);
    expect(patch.values["max_guests"]).toBe(8);
    expect(patch.values["primary_photo_url"]).toBe("https://uc.orez.io/f/abc");
    expect(patch.values["primary_photo_source"]).toBe("ownerrez_listing");
    expect(patch.ownerSourceId).toBe("150923240");
    expect(plan.counts.matched).toBe(1);
    expect(plan.counts.photos).toBe(1);
    expect(plan.counts.ownersLinked).toBe(1);
  });

  it("never writes identity fields", () => {
    const plan = planEnrichment([prop()], [listing], [owner], now);
    const keys = Object.keys(plan.patches[0]!.values);
    for (const forbidden of ["name", "address_line1", "city", "state", "postal_code"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("records provenance for every written field", () => {
    const plan = planEnrichment([prop()], [listing], [owner], now);
    const patch = plan.patches[0]!;
    expect(patch.provenance.length).toBeGreaterThan(5);
    expect(patch.provenance.every((p) => p.value_source.startsWith("ownerrez"))).toBe(true);
    expect(patch.provenance.every((p) => p.as_of === now.toISOString())).toBe(true);
  });

  it("never matches on property name", () => {
    const plan = planEnrichment([prop({ ownerrez_property_id: null })], [listing], [owner], now);
    expect(plan.patches.length).toBe(0);
    expect(plan.counts.unmatched).toBe(1);
    expect(plan.conflicts[0]!.field).toBe("ownerrez_property_id");
  });

  it("reuses one owner record across several homes", () => {
    const second = { ...listing, id: 494864 };
    const plan = planEnrichment(
      [prop(), prop({ id: "p2", ownerrez_property_id: "494864" })],
      [listing, second],
      [owner],
      now,
    );
    expect(plan.owners.length).toBe(1);
    expect(plan.counts.ownersLinked).toBe(2);
  });

  it("reports a conflict instead of guessing when owner ids collide", () => {
    const plan = planEnrichment([prop()], [listing], [owner, { ...owner, name: "Other" }], now);
    expect(plan.counts.ownersLinked).toBe(0);
    expect(plan.conflicts.some((c) => c.field === "owner_record_id")).toBe(true);
    expect(plan.patches[0]!.ownerSourceId).toBeNull();
  });

  it("does not fabricate a photo when the listing has none", () => {
    const bare = { ...listing, thumbnail_url: null, thumbnail_url_medium: null, thumbnail_url_large: null };
    const plan = planEnrichment([prop()], [bare], [owner], now);
    expect(plan.patches[0]!.values["primary_photo_url"] === undefined).toBe(true);
    expect(plan.counts.photosMissing).toBe(1);
  });

  it("leaves duplicate listing ids untouched", () => {
    const plan = planEnrichment([prop()], [listing, { ...listing }], [owner], now);
    expect(plan.patches.length).toBe(0);
    expect(plan.conflicts[0]!.detail).toContain("More than one OwnerRez listing");
  });

  it("keeps existing Resolve geocoding", () => {
    const plan = planEnrichment(
      [{ ...prop(), latitude: 1, longitude: 2 }],
      [listing],
      [owner],
      now,
    );
    expect(plan.patches[0]!.values["latitude"] === undefined).toBe(true);
  });
});
