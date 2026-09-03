/**
 * Scope decides what a home is asked for. It removes work, never invents it,
 * and always explains why something does not apply.
 */
import { describe, expect, it } from "bun:test";
import {
  appliesToScope,
  defaultModules,
  outOfScopeReason,
  projectScope,
  repairApprovalGuidance,
  scopeSummary,
  splitByScope,
  suggestedModules,
} from "@/lib/onboarding-scope";

describe("project scope", () => {
  it("falls back to full furnishing before a project is initialized", () => {
    const scope = projectScope(null);
    expect(scope.furnishing).toBe("full_furnishing");
    expect(scope.modules).toEqual(defaultModules());
  });

  it("reads the persisted scope of a started project", () => {
    const scope = projectScope({ furnishing_scope: "no_furnishing", modules: ["pool"] });
    expect(scope.furnishing).toBe("no_furnishing");
    expect(scope.modules).toEqual(["pool"]);
  });

  it("pre-selects modules from what Resolve already knows", () => {
    expect(suggestedModules({ pool_spa: "Heated pool", hoa: null })).toContain("pool");
    expect(suggestedModules({ pool_spa: "none", hoa: null })).not.toContain("pool");
  });
});

describe("applicability", () => {
  const noFurnish = { furnishing: "no_furnishing" as const, modules: defaultModules() };

  it("drops furnishing work for an existing furnished home", () => {
    expect(appliesToScope("Mood board approval", noFurnish)).toBe(false);
    expect(outOfScopeReason("Mood board approval", noFurnish)).toContain("without ARHA furnishing");
  });

  it("keeps access, repair and safety work whatever the furnishing scope", () => {
    expect(appliesToScope("Confirm lock code handover", noFurnish)).toBe(true);
    expect(appliesToScope("Make-ready repair walkthrough", noFurnish)).toBe(true);
  });

  it("switches off a module the home does not have", () => {
    const scope = { furnishing: "full_furnishing" as const, modules: defaultModules() };
    expect(appliesToScope("Pool service vendor setup", scope)).toBe(false);
    expect(outOfScopeReason("Pool service vendor setup", scope)).toContain("Pool");
  });

  it("applies unknown work by default — scope never invents requirements", () => {
    const scope = { furnishing: "full_furnishing" as const, modules: [] };
    expect(appliesToScope("Something nobody wrote a rule for", scope)).toBe(true);
  });
});

describe("split and summary", () => {
  it("separates skipped work with a reason instead of hiding it", () => {
    const scope = { furnishing: "full_furnishing" as const, modules: defaultModules() };
    const { inScope, outOfScope } = splitByScope(
      [{ title: "Utility transfer" }, { title: "HOA registration" }],
      scope,
    );
    expect(inScope.length).toBe(1);
    expect(outOfScope[0]?.reason).toContain("HOA");
  });

  it("summarises scope in plain language", () => {
    expect(scopeSummary({ furnishing: "no_furnishing", modules: ["pool"] })).toBe(
      "No furnishings / existing home · Pool / hot tub",
    );
  });
});

describe("repair authority", () => {
  it("quotes the single maintenance threshold on repair work only", () => {
    expect(repairApprovalGuidance("Make-ready repair list")).toContain("$350");
    expect(repairApprovalGuidance("Install curtains")).toBeNull();
  });
});
