import { describe, expect, it } from "bun:test";
import { ownerSectionRelevant, insuranceFlagged, workTypeFitsKind } from "@/lib/work-entry";

describe("work entry owner relevance", () => {
  it("never shows owner on Ops Tickets or legacy tickets", () => {
    expect(ownerSectionRelevant({ entry_kind: "ops", estimated_cost: 900, insurance_risk: "yes" }).relevant).toBe(false);
    expect(ownerSectionRelevant({ entry_kind: null, estimated_cost: 900 }).relevant).toBe(false);
  });
  it("maintenance under threshold, insurance no: hidden", () => {
    expect(ownerSectionRelevant({ entry_kind: "maintenance", estimated_cost: 120, insurance_risk: "no" }).relevant).toBe(false);
    expect(ownerSectionRelevant({ entry_kind: "maintenance", estimated_cost: 350, insurance_risk: "no" }).relevant).toBe(false);
  });
  it("over threshold by estimate or Work Order cost: shown", () => {
    expect(ownerSectionRelevant({ entry_kind: "maintenance", estimated_cost: 351 }).relevant).toBe(true);
    expect(ownerSectionRelevant({ entry_kind: "maintenance" }, [500]).relevant).toBe(true);
  });
  it("insurance yes or unsure: shown", () => {
    expect(ownerSectionRelevant({ entry_kind: "maintenance", insurance_risk: "yes" }).relevant).toBe(true);
    expect(ownerSectionRelevant({ entry_kind: "maintenance", insurance_risk: "unsure" }).relevant).toBe(true);
    expect(insuranceFlagged("unsure")).toBe(true);
    expect(insuranceFlagged("no")).toBe(false);
  });
  it("splits the work-type catalog by path", () => {
    expect(workTypeFitsKind("maintenance", "maintenance")).toBe(true);
    expect(workTypeFitsKind("guest", "maintenance")).toBe(false);
    expect(workTypeFitsKind("guest", "ops")).toBe(true);
  });
});

import { insuranceRiskLabel } from "@/lib/work-entry";
describe("insurance labels", () => {
  it("never presents Unsure as confirmed", () => {
    expect(insuranceRiskLabel("yes")).toBe("Potential Insurance Event");
    expect(insuranceRiskLabel("unsure")).toBe("Insurance Review Needed");
    expect(insuranceRiskLabel("no")).toBe("");
  });
});
