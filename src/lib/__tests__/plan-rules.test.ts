import { describe, expect, it } from "bun:test";
import { addBusinessDays, conditionFromCsv, conditionToCsv, dueFromRule, stepApplies } from "../plan-rules";
import { parseTemplateCsv } from "../plan-csv-import";
import { PLAN_HEADER, planRow, toCsv } from "../plan-csv";

const poolFurniture = { all: [{ field: "furnishing_scope", value: "full_furnishing" }, { field: "module", value: "pool" }] } as const;

describe("plan step conditions", () => {
  it("includes pool furniture only with Furnishing Package AND Pool", () => {
    const c = { all: [...poolFurniture.all] };
    expect(stepApplies(c, { furnishing_scope: "full_furnishing", modules: ["pool"] })).toBe(true);
    expect(stepApplies(c, { furnishing_scope: "full_furnishing", modules: [] })).toBe(false);
    expect(stepApplies(c, { furnishing_scope: "no_furnishing", modules: ["pool"] })).toBe(false);
  });
  it("a step with no conditions applies to every home", () => {
    expect(stepApplies(null, { furnishing_scope: null, modules: null })).toBe(true);
  });
  it("refuses free-form condition text", () => {
    expect(conditionFromCsv("module=swimming").error).not.toBeNull();
    expect(conditionToCsv(conditionFromCsv("furnishing_scope=full_furnishing; module=pool").condition)).toBe(
      "furnishing_scope=full_furnishing; module=pool",
    );
  });
});

describe("relative due dates", () => {
  it("counts business days Monday–Friday, both directions", () => {
    expect(addBusinessDays("2026-10-09", 1)).toBe("2026-10-12"); // Fri → Mon
    expect(addBusinessDays("2026-10-12", -1)).toBe("2026-10-09"); // Mon → Fri
    expect(addBusinessDays("2026-10-08", 0)).toBe("2026-10-08");
    expect(addBusinessDays("2026-10-20", -7)).toBe("2026-10-09");
  });
  it("leaves a missing anchor unresolved instead of using today", () => {
    expect(dueFromRule(null, 3, "business")).toBeNull();
  });
});

describe("CSV round-trip of the new step fields", () => {
  it("keeps description, done when, video, business-day rule, role and conditions", () => {
    const row = planRow({
      plan: "T", stageNo: 1, stage: "Phase 1", taskNo: 1, title: "Purchase pool furniture", detail: "Order set",
      role: "lead_designer", person: "", status: "", dueOn: "", anchor: "planned_closing", offset: -5,
      required: true, blocksHandoff: false, evidence: false, ownerApproval: false, ownerDependency: null,
      module: "", breezeway: "", opportunity: null, unit: "business", description: "Why", doneWhen: "Delivered",
      videoUrl: "https://example.com/v", conditions: "furnishing_scope=full_furnishing; module=pool",
    });
    const t = parseTemplateCsv(toCsv(PLAN_HEADER, [row])).stages[0]!.tasks[0]!;
    expect(t.description).toBe("Why");
    expect(t.doneWhen).toBe("Delivered");
    expect(t.videoUrl).toBe("https://example.com/v");
    expect(t.offsetUnit).toBe("business");
    expect(t.offsetDays).toBe(-5);
    expect(t.functionalRole).toBe("lead_designer");
    expect(t.condition?.all.length).toBe(2);
  });
  it("refuses an unknown role instead of dropping it", () => {
    const csv = "Stage,Task,Assigned role\r\nP1,Do it,Chief Wizard\r\n";
    expect(parseTemplateCsv(csv).errors.some((e) => e.message.includes("Chief Wizard"))).toBe(true);
  });
});
