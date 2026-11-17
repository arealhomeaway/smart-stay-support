import { describe, expect, it } from "bun:test";
import { FUNCTIONAL_ROLES, roleLabel } from "../v2-workflow.functions";
import { parseTemplateCsv } from "../plan-csv-import";
import { canonicalRoleCode, homeDesigner } from "../designer-role";

// Rules from the Nov 17 onboarding team cleanup: one Designer role, no Staging Team role.
describe("one Designer role", () => {
  it("offers Designer exactly once and no retired role", () => {
    const codes = FUNCTIONAL_ROLES.map((r) => r.code as string);
    expect(codes.filter((c) => c === "designer")).toHaveLength(1);
    expect(codes).not.toContain("lead_designer");
    expect(codes).not.toContain("design_staging");
    expect(codes).not.toContain("staging_team");
    expect(FUNCTIONAL_ROLES.map((r) => r.label as string)).not.toContain("Lead Designer");
  });
  it("shows the older Designer codes as Designer", () => {
    expect(roleLabel("lead_designer")).toBe("Designer");
    expect(roleLabel("design_staging")).toBe("Designer");
    expect(canonicalRoleCode("lead_designer")).toBe("designer");
    expect(canonicalRoleCode("utilities")).toBe("utilities");
  });
  it("CSV import maps Lead Designer, Design and Design & Staging to designer", () => {
    for (const label of ["Lead Designer", "Design", "Design & Staging", "Designer"]) {
      const p = parseTemplateCsv(`Stage,Task,Assigned role\nIntake,Pick paint,"${label}"\n`);
      expect(p.errors).toEqual([]);
      expect(p.stages[0]!.tasks[0]!.functionalRole).toBe("designer");
    }
  });
  it("reads the home's Designer from the designer key first", () => {
    expect(homeDesigner({ designer: "a", lead_designer: "b" })).toBe("a");
    expect(homeDesigner({ lead_designer: "b" })).toBe("b");
    expect(homeDesigner({})).toBeNull();
  });
});
