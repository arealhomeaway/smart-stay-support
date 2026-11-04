import { describe, expect, it } from "bun:test";
import { insuranceOptionShown } from "@/lib/work-entry";
import { historyCategoryKey, sameCategoryHistory } from "@/lib/property-history";

describe("insurance option", () => {
  it("shows for leak, roof and structural", () => {
    for (const c of ["water_intrusion", "roof", "structural"]) expect(insuranceOptionShown(c, "")).toBe(true);
  });
  it("hides for other categories", () => {
    for (const c of ["plumbing", "hvac", "appliance", "other", ""]) expect(insuranceOptionShown(c, "")).toBe(false);
  });
  it("keeps an existing insurance answer visible after a category change", () => {
    expect(insuranceOptionShown("hvac", "yes")).toBe(true);
    expect(insuranceOptionShown("hvac", "unsure")).toBe(true);
  });
});

describe("property history default", () => {
  const rows = [
    { id: "a", maintenance_category: "roof", category: "maintenance" },
    { id: "b", maintenance_category: "plumbing", category: "maintenance" },
    { id: "c", maintenance_category: null, category: null },
  ];
  it("shows only the same maintenance category, never uncategorized", () => {
    const key = historyCategoryKey({ maintenance_category: "roof", category: "maintenance" });
    expect(sameCategoryHistory(rows, key).map((r) => r.id)).toEqual(["a"]);
  });
  it("uses the general category when there is no maintenance category", () => {
    const key = historyCategoryKey({ maintenance_category: null, category: "maintenance" });
    expect(sameCategoryHistory(rows, key).map((r) => r.id)).toEqual(["a", "b"]);
  });
});
