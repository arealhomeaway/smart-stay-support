import { describe, expect, it } from "bun:test";
import { rankProperties, scoreProperty, type PropertySearchRow } from "@/lib/property-search";

const p = (over: Partial<PropertySearchRow> & { id: string }): PropertySearchRow => ({
  name: null,
  nickname: null,
  address_line1: null,
  city: null,
  market: null,
  neighborhood: null,
  ownerrez_property_id: null,
  ...over,
});

describe("candidate property ranking", () => {
  const rows = [
    p({ id: "a", name: "Magnolia House", city: "Houston" }),
    p({ id: "b", name: "Houston Loft", city: "Houston" }),
    p({ id: "c", name: "Hou", city: "Dallas" }),
    p({ id: "d", name: "Cedar Cottage", address_line1: "Houghton Ave", city: "Austin" }),
    p({ id: "e", name: "Elm Place", neighborhood: "Houndsfield" }),
    p({ id: "f", name: "Pine Flat", ownerrez_property_id: "494863" }),
  ];

  it("exact name beats starts-with, which beats contains", () => {
    const ranked = rankProperties("hou", rows).map((r) => r.id);
    expect(ranked[0]).toBe("c");
    expect(ranked.indexOf("b") < ranked.indexOf("a")).toBe(true);
  });

  it("address and city outrank a trailing word match", () => {
    expect(scoreProperty("hou", rows[3]!)).toBeGreaterThan(scoreProperty("hou", rows[0]!));
    expect(scoreProperty("houston", rows[1]!)).toBeGreaterThan(scoreProperty("houston", rows[4]!));
  });

  it("OwnerRez id matches exactly", () => {
    const ranked = rankProperties("494863", rows);
    expect(ranked.length).toBe(1);
    expect(ranked[0]!.id).toBe("f");
  });

  it("no query or no match returns nothing", () => {
    expect(rankProperties("", rows).length).toBe(0);
    expect(rankProperties("zzzz", rows).length).toBe(0);
  });
});
