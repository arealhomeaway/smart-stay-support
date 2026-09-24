import { describe, expect, it } from "bun:test";
import { buildTrail, departmentFor, parentOf } from "../shell-nav";

describe("shared shell navigation", () => {
  it("property tab trail links back to the same property", () => {
    const t = buildTrail({ pathname: "/onboarding/abc", search: { tab: "handoff" }, propertyName: "3915 W 104th" });
    expect(t.map((c) => c.label)).toEqual(["Onboarding", "3915 W 104th", "Handoff"]);
    expect(parentOf(t)?.to).toBe("/onboarding/abc");
  });
  it("department sub-pages get Onboarding > Team", () => {
    const t = buildTrail({ pathname: "/onboarding/team", search: {} });
    expect(t.map((c) => c.label)).toEqual(["Onboarding", "Team"]);
  });
  it("page label extends the trail", () => {
    const t = buildTrail({ pathname: "/onboarding/templates", search: {}, pageLabel: "ARHA Onboarding V2" });
    expect(t.map((c) => c.label)).toEqual(["Onboarding", "Workflow Templates", "ARHA Onboarding V2"]);
  });
  it("Active Owner pages share one department menu", () => {
    expect(departmentFor("/homeowners")?.key).toBe("active-owner");
    expect(departmentFor("/owner-oversight")?.key).toBe("active-owner");
  });
});
