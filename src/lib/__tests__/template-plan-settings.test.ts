import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { moveStep, stepGroups } from "@/lib/template-step-order";
import { planTemplateBulkEdit } from "@/lib/template-bulk-edit";

const steps = [
  { id: "a", stage: "Intake", sort_order: 10 },
  { id: "b", stage: "Intake", sort_order: 20 },
  { id: "c", stage: "Setup", sort_order: 30 },
  { id: "x", stage: "Old import", sort_order: 40 },
];
const groups = stepGroups(["Intake", "Setup", "Empty"], steps);

describe("Plan settings step order", () => {
  it("shows every stage with steps, including names only on steps", () => {
    expect(groups.map(([n]) => n)).toEqual(["Intake", "Setup", "Empty", "Old import"]);
  });
  it("reorders within a stage", () => {
    expect(moveStep(groups, "b", "Intake", "a")).toEqual([
      { stepId: "b", stage: "Intake" }, { stepId: "a", stage: "Intake" },
      { stepId: "c", stage: "Setup" }, { stepId: "x", stage: "Old import" },
    ]);
  });
  it("moves a step to the end of another stage", () => {
    expect(moveStep(groups, "a", "Setup", null).map((e) => `${e.stepId}:${e.stage}`)).toEqual(["b:Intake", "c:Setup", "a:Setup", "x:Old import"]);
  });
  it("moves a step into an empty stage in stage order", () => {
    expect(moveStep(groups, "a", "Empty", null).map((e) => `${e.stepId}:${e.stage}`)).toEqual(["b:Intake", "c:Setup", "a:Empty", "x:Old import"]);
  });
  it("always sends the whole plan once", () => {
    expect(moveStep(groups, "c", "Intake", "a")).toHaveLength(4);
  });
});

describe("Bulk edit preview", () => {
  const bulkSteps = [
    { id: "1", title: "One", stage: "Intake", sort_order: 1, functional_role: null, is_required: false, blocks_handoff: false, offset_days: null, schedule_anchor: null, offset_unit: "calendar", requires_owner_approval: false, tags: [] },
    { id: "2", title: "Two", stage: "Intake", sort_order: 2, functional_role: null, is_required: true, blocks_handoff: false, offset_days: null, schedule_anchor: null, offset_unit: "calendar", requires_owner_approval: false, tags: [] },
  ];
  it("counts only steps that actually change", () => {
    const plan = planTemplateBulkEdit(bulkSteps, ["1", "2"], { isRequired: true }, { stages: ["Intake"] });
    expect(plan.ok && plan.changes.length).toBe(1);
  });
});

const read = (p: string) => readFileSync(p, "utf8");
describe("One template editor", () => {
  const settings = read("src/components/onboarding/TemplateV2Settings.tsx");
  const bulk = read("src/components/onboarding/TemplateBulkEditDialog.tsx");
  const route = read("src/routes/_authenticated/onboarding.templates.tsx");
  it("hides the older editor and keeps CSV in Plan settings", () => {
    expect(route).not.toMatch(/<TemplateEditor/);
    expect(settings).toMatch(/<PlanCsvButton templateId=\{templateId\}/);
  });
  it("hides Video link and Module but saves stored values back", () => {
    expect(settings).not.toMatch(/>Video link</);
    expect(settings).not.toMatch(/Module \(optional\)/);
    expect(settings).toMatch(/const module = step\.module \?\? ""/);
    expect(settings).toMatch(/const videoUrl = step\.video_url \?\? ""/);
  });
  it("saves order through the existing arrange path, never publishing", () => {
    expect(settings).toMatch(/arrangeTemplateStepsFn/);
    expect(settings.match(/publishM\.mutate\(/g)).toHaveLength(1);
  });
  it("bulk edit has help text and no Breezeway or stage field", () => {
    for (const t of [
      "The plan is not complete until this step is done or skipped with a reason.",
      "Operations cannot accept the home until this step is done.",
      "Turn off to hide this step from new homes without deleting it.",
    ]) expect(bulk).toContain(t);
    expect(bulk).not.toMatch(/<Label>Stage<\/Label>/);
    expect(bulk).not.toMatch(/breezewayTemplateId/);
    expect(bulk).toMatch(/Preview/);
  });
});
