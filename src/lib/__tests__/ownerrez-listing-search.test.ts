import { describe, expect, it } from "bun:test";
import { filterListings, LISTING_MATCH_LIMIT } from "../property-intake";

type L = { id: string; name: string; publicName: string | null; street: string; city: string; zip: string };
const filler: L[] = Array.from({ length: 120 }, (_, i) => ({
  id: String(100000 + i), name: `${1000 + i} Oak St`, publicName: null, street: `${1000 + i} Oak St`, city: "Tulsa", zip: "74103",
}));
const fern: L = { id: "499899", name: "3400 N Fern Avenue", publicName: "Fernstone House (3400)", street: "3400 N Fern Ave", city: "Broken Arrow", zip: "74012" };
const all = [...filler.slice(0, 89), fern, ...filler.slice(89)];
const f = (l: L) => [l.name, l.publicName, l.street, l.city, l.zip, l.id];

describe("OwnerRez listing search", () => {
  it("finds a listing past position 60", () => {
    expect(all.indexOf(fern)).toBeGreaterThan(60);
    expect(filterListings(all, f, "3400 N Fern").items.map((l) => l.id)).toEqual(["499899"]);
  });
  for (const term of ["3400 N Fern", "fern", "3400", "Broken Arrow", "499899", "  3400   n. FERN ", "Fernstone"]) {
    it(`"${term}" finds 499899`, () => {
      expect(filterListings(all, f, term).items.map((l) => l.id)).toContain("499899");
    });
  }
  it("no match returns nothing", () => {
    expect(filterListings(all, f, "zzz nowhere").total).toBe(0);
  });
  it("empty query returns nothing so the screen shows the hint", () => {
    expect(filterListings(all, f, "   ").items).toEqual([]);
  });
  it("limit applies only after filtering and is flagged", () => {
    const r = filterListings(all, f, "oak");
    expect(r.total).toBe(120);
    expect(r.items).toHaveLength(LISTING_MATCH_LIMIT);
    expect(r.truncated).toBe(true);
  });
});
