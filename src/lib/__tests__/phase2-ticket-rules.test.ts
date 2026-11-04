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

import { insuranceOptionShown as shown2, MAINTENANCE_CATEGORIES as MC } from "@/lib/work-entry";
import { DAMAGE_CATEGORIES as DC, damageLabel } from "@/lib/departure-review";
describe("approved follow-ups", () => {
  it("Fire or smoke exists and asks about insurance", () => {
    expect(MC.some((c) => c.value === "fire_smoke" && c.label === "Fire or smoke")).toBe(true);
    expect(shown2("fire_smoke", "")).toBe(true);
  });
  it("damage checklist matches the Fillout list and old answers still read", () => {
    const labels = DC.map((d) => d.label);
    for (const l of ["Carpet stains", "Extra cleaning", "Minor cat damage", "Major cat damage", "Minor dog damage", "Major dog damage", "Excessive pet hair", "Linens and towels", "Smoking pot", "Smoking cigarettes", "Furniture damage", "Rug damage"]) expect(labels).toContain(l);
    expect(damageLabel("pet_damage")).toBe("Pet damage");
  });
});
