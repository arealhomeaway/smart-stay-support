import { describe, expect, it } from "bun:test";
import { canTakeWork, inTransitionalReview, transitionalDaysLeft } from "@/components/vendors/useVendorWorkspace";
import { isTransitionalEligible, mapNotionCategory, mapNotionPreference } from "@/lib/vendor-gold";

const g = (clear: boolean) => new Map([["v", { blockingClear: clear }]]);
const c = (state: string) => new Map([["v", { state }]]);
const v = (status: string, is_active = true, transitional_deadline: string | null = null) => ({
  id: "v",
  status,
  is_active,
  critical_failure: false,
  transitional_review: transitional_deadline !== null,
  transitional_deadline,
});
const TODAY = "2026-10-01";

describe("canTakeWork", () => {
  it("allows qualified active vendors before expiry", () => {
    expect(canTakeWork(v("approved"), g(true), c("expires_7"), TODAY)).toBe(true);
    expect(canTakeWork(v("pilot"), g(false), c("current"), TODAY)).toBe(true);
  });
  it("blocks inactive, unqualified, held or expired vendors", () => {
    expect(canTakeWork(v("approved", false), g(true), c("current"), TODAY)).toBe(false);
    expect(canTakeWork(v("candidate"), g(true), c("current"), TODAY)).toBe(false);
    expect(canTakeWork(v("suspended"), g(true), c("current"), TODAY)).toBe(false);
    expect(canTakeWork(v("gold"), g(false), c("current"), TODAY)).toBe(false);
    expect(canTakeWork(v("pilot"), g(true), c("expired"), TODAY)).toBe(false);
  });
});

describe("Transitional Review", () => {
  it("lets a migrated Candidate take work during the window", () => {
    expect(canTakeWork(v("candidate", true, "2026-11-30"), g(false), c("current"), TODAY)).toBe(true);
    expect(inTransitionalReview(v("candidate", true, "2026-11-30"), TODAY)).toBe(true);
  });
  it("stops after the deadline, for suspended/inactive vendors, and on expired compliance", () => {
    expect(canTakeWork(v("candidate", true, "2026-09-30"), g(false), c("current"), TODAY)).toBe(false);
    expect(canTakeWork(v("suspended", true, "2026-11-30"), g(false), c("current"), TODAY)).toBe(false);
    expect(canTakeWork(v("candidate", false, "2026-11-30"), g(false), c("current"), TODAY)).toBe(false);
    expect(canTakeWork(v("candidate", true, "2026-11-30"), g(false), c("expired"), TODAY)).toBe(false);
  });
  it("counts days left", () => {
    expect(transitionalDaysLeft({ transitional_deadline: "2026-10-11" }, new Date("2026-10-01T15:00:00Z"))).toBe(10);
  });
  it("is only for Notion Active / Last Resort vendors", () => {
    expect(isTransitionalEligible("Active")).toBe(true);
    expect(isTransitionalEligible("Last Resort")).toBe(true);
    expect(isTransitionalEligible("Pending Contactor Setup")).toBe(false);
    expect(isTransitionalEligible(null)).toBe(false);
  });
  it("maps Notion specialties and preferences", () => {
    const known = new Map([["handyman", "Handyman"], ["hvac", "HVAC"], ["turnover cleaning", "Turnover Cleaning"]]);
    expect(mapNotionCategory("General Handyman", known)).toBe("Handyman");
    expect(mapNotionCategory("HVAC", known)).toBe("HVAC");
    expect(mapNotionCategory("Housekeeping", known)).toBe("Turnover Cleaning");
    expect(mapNotionCategory("Photography", known)).toBeNull();
    expect(mapNotionPreference("Option 1")).toBe("primary");
    expect(mapNotionPreference("Back Up Option")).toBe("backup");
    expect(mapNotionPreference("EMERGENCY ONLY")).toBe("other");
  });
});
