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
    expect(/<TemplateEditor/.test(route)).toBe(false);
    expect(/<PlanCsvButton templateId=\{templateId\}/.test(settings)).toBe(true);
  });
  it("hides Video link and Module but saves stored values back", () => {
    expect(/>Video link</.test(settings)).toBe(false);
    expect(/Module \(optional\)/.test(settings)).toBe(false);
    expect(/const module = step\.module \?\? ""/.test(settings)).toBe(true);
    expect(/const videoUrl = step\.video_url \?\? ""/.test(settings)).toBe(true);
  });
  it("saves order through the existing arrange path, never publishing", () => {
    expect(/arrangeTemplateStepsFn/.test(settings)).toBe(true);
    expect(settings.match(/publishM\.mutate\(/g)).toHaveLength(1);
  });
  it("bulk edit has help text and no Breezeway or stage field", () => {
    for (const t of [
      "The plan is not complete until this step is done or skipped with a reason.",
      "Operations cannot accept the home until this step is done.",
      "Turn off to hide this step from new homes without deleting it.",
    ]) expect(bulk).toContain(t);
    expect(/<Label>Stage<\/Label>/.test(bulk)).toBe(false);
    expect(/breezewayTemplateId/.test(bulk)).toBe(false);
    expect(/Preview/.test(bulk)).toBe(true);
  });
});

import { planExtraBulkEdit } from "@/lib/template-bulk-edit";
describe("Plan settings follow-up", () => {
  const s = readFileSync("src/components/onboarding/TemplateV2Settings.tsx", "utf8");
  const bulk = readFileSync("src/components/onboarding/TemplateBulkEditDialog.tsx", "utf8");
  it("Add step and Remove step use the older editor's server functions", () => {
    expect(s.includes("useServerFn(saveTemplateStepFn)")).toBe(true);
    expect(s.includes("useServerFn(deleteTemplateStepFn)")).toBe(true);
    expect(s.includes(">Add step<")).toBe(true);
    expect(s.includes("setConfirmRemove(true)")).toBe(true);
  });
  it("the three new bulk fields show only when the database function exists", () => {
    expect(bulk.includes("{extraReady ? (")).toBe(true);
    expect(bulk.includes('if (error) return { ready: false }') || readFileSync("src/lib/v2-workflow.functions.ts", "utf8").includes("if (error) return { ready: false }")).toBe(true);
  });
  const steps = [
    { id: "1", title: "A", condition: null, owner_dependency: null, is_active: true, blocks_handoff: false },
    { id: "2", title: "B", condition: null, owner_dependency: null, is_active: true, blocks_handoff: true },
  ];
  it("previews the count and skips handoff-blocking steps for Business Decision", () => {
    expect(planExtraBulkEdit(steps, ["1", "2"], { ownerDependency: "business_decision" })).toEqual({ ok: true, changes: 1, skipped: ["2"] });
  });
  it("counts inactive changes and condition changes", () => {
    expect(planExtraBulkEdit(steps, ["1", "2"], { isActive: false })).toEqual({ ok: true, changes: 2, skipped: [] });
    expect(planExtraBulkEdit(steps, ["1"], { condition: { all: [{ field: "module", value: "pool" }] } })).toEqual({ ok: true, changes: 1, skipped: [] });
    expect(planExtraBulkEdit(steps, ["1"], { condition: null }).ok).toBe(false);
  });
});
