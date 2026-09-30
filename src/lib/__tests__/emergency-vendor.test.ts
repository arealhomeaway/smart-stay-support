import { describe, expect, it } from "bun:test";
import { allowedEmergencyBases, canRevealEmergency, emergencyVisibleByDefault } from "@/lib/emergency-vendor";
import { coverageMatrix } from "@/lib/vendor-gold";

describe("Emergency Only vendors", () => {
  it("P1 visible, P2 only when no routine vendor, P3 hidden", () => {
    expect(emergencyVisibleByDefault("p1", 3)).toBe(true);
    expect(emergencyVisibleByDefault("p2", 2)).toBe(false);
    expect(emergencyVisibleByDefault("p2", 0)).toBe(true);
    expect(emergencyVisibleByDefault("p3", 0)).toBe(false);
  });
  it("P3 needs a Supervisor; P2 approval basis only for Supervisors", () => {
    expect(canRevealEmergency("p3", false)).toBe(false);
    expect(canRevealEmergency("p3", true)).toBe(true);
    expect(allowedEmergencyBases("p1", false)).toEqual([]);
    expect(allowedEmergencyBases("p2", false)).toEqual(["no_routine_vendor", "after_hours"]);
    expect(allowedEmergencyBases("p2", true)).toContain("supervisor_approval");
    expect(allowedEmergencyBases("p3", false)).toEqual([]);
    expect(allowedEmergencyBases("p3", true)).toEqual(["supervisor_override"]);
  });
  it("never counts toward coverage when excluded as inactive-for-coverage", () => {
    const cells = coverageMatrix(["OKC"], [{ label: "HVAC", tier: "critical" }], [
      { orgId: "e", orgName: "E", market: "OKC", category: "HVAC", preference: "primary", status: "pilot", isActive: false },
    ] as never);
    expect(cells[0]!.status).toBe("missing_both");
  });
});
