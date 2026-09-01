import { describe, expect, it } from "bun:test";
import {
  buildPropertyDetailGroups,
  filterPropertyDetailGroups,
  matchesCredentialSearch,
} from "@/lib/property-details";

const row = {
  operating_notes: "Do not park on the grass.",
  utilities: { wifi_ssid: "ARHA-Guest", router_location: "Hall closet", electric_provider: "OG&E" },
  waste: { trash_day: "Tuesday", recycling_day: "Every other Friday", notes: "" },
  systems: {
    water_shutoff_indoor: "Under kitchen sink",
    breaker_panel_location: "Garage",
    smoke: { last_replaced: "2024-06-30", last_replaced_precision: "month", last_replaced_source_text: "June 2024" },
  },
  hvac: { filter_size: "20x25x1" },
  pool_spa: { type: "Pool & Hot Tub" },
  hoa: { has_hoa: true },
  fireplace: {},
};

describe("property detail grouping", () => {
  const groups = buildPropertyDetailGroups(row);
  const byId = (id: string) => groups.find((g) => g.id === id);

  it("drops empty groups and empty values", () => {
    expect(byId("fireplace") === undefined).toBe(true);
    expect(byId("waste")!.fields.map((f) => f.label)).not.toContain("Notes");
  });

  it("places unclaimed keys in their owning group", () => {
    expect(byId("utilities_shutoffs")!.fields.some((f) => f.value === "OG&E")).toBe(true);
  });

  it("routes explicit picks to the right section", () => {
    expect(byId("wifi_tech")!.fields.some((f) => f.value === "ARHA-Guest")).toBe(true);
    expect(byId("utilities_shutoffs")!.fields.some((f) => f.value === "Garage")).toBe(true);
  });

  it("formats booleans and preserves imported date precision", () => {
    expect(byId("hoa")!.fields[0]!.value).toBe("Yes");
    const smoke = byId("safety")!.fields.find((f) => f.key.includes("last_replaced"))!;
    expect(smoke.value).toBe("June 2024 (recorded to the month)");
    expect(byId("safety")!.fields.some((f) => f.key.endsWith("_source_text"))).toBe(false);
  });

  it("finds a field by everyday wording", () => {
    expect(filterPropertyDetailGroups(groups, "trash").some((g) => g.id === "waste")).toBe(true);
    expect(filterPropertyDetailGroups(groups, "water shutoff").length).toBeGreaterThan(0);
    expect(filterPropertyDetailGroups(groups, "unicorn").length).toBe(0);
  });

  it("points credential searches at the vault without holding secrets", () => {
    expect(matchesCredentialSearch("gate code")).toBe(true);
    expect(matchesCredentialSearch("wifi password")).toBe(true);
    expect(matchesCredentialSearch("trash")).toBe(false);
    const serialised = JSON.stringify(groups).toLowerCase();
    expect(serialised).not.toContain("password");
  });
});
