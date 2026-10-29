import { describe, expect, it } from "bun:test";
import { formatPropertyLabel, matchesPropertySearch } from "../property-label";
import { rankProperties } from "../property-search";

const home = { id: "fern", name: "Fernstone House (3400)", nickname: "Ramsey", address_line1: "3400 N Fern Ave", unit: null, city: "Broken Arrow", state: "OK", postal_code: "74012", ownerrez_property_id: "499899", market: null, neighborhood: null };
describe("shared home address labels", () => {
  it("uses the street as primary and city/state as secondary", () => {
    expect(formatPropertyLabel(home)).toEqual({ primary: "3400 N Fern Ave", secondary: "Broken Arrow, OK", full: "3400 N Fern Ave, Broken Arrow, OK 74012" });
  });
  it("appends a unit once", () => {
    expect(formatPropertyLabel({ ...home, address_line1: "1012 Main St", unit: " B " }).primary).toBe("1012 Main St, Unit B");
    expect(formatPropertyLabel({ ...home, unit: "Unit B" }).primary).toBe("3400 N Fern Ave, Unit B");
  });
  it("preserves interior spacing, punctuation and capitalization", () => {
    expect(formatPropertyLabel({ ...home, address_line1: "  10  O'Neil St., NE  " }).primary).toBe("10  O'Neil St., NE");
  });
  it("marks missing street and never returns a blank label", () => {
    expect(formatPropertyLabel({ name: " Fernstone ", address_line1: " " }).primary).toBe("Fernstone (address missing)");
    expect(formatPropertyLabel(null).primary).toBe("Home (address missing)");
  });
  for (const term of ["3400 N Fern", "fern", "3400", "Broken Arrow", "499899", "74012", "Fernstone", "Ramsey", "3400, N  Fern!"]) {
    it(`finds the home by ${term}`, () => {
      expect(matchesPropertySearch(home, term)).toBe(true);
      expect(rankProperties(term, [home]).map(h => h.id)).toEqual(["fern"]);
    });
  }
  it("matches a unit and rejects a nonmatching home", () => {
    expect(matchesPropertySearch({ ...home, unit: "B" }, "Unit B")).toBe(true);
    expect(matchesPropertySearch({ ...home, unit: "B" }, "B")).toBe(true);
    expect(matchesPropertySearch(home, "Tulsa 99999")).toBe(false);
  });
});