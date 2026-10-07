import { describe, expect, it } from "bun:test";
import { PLAN_HEADER, planRow, toCsv } from "../plan-csv";
import { parseDueRule, parseTemplateCsv } from "../plan-csv-import";

const base = { plan: "Willow", detail: "=do it", person: "Kati", status: "complete", dueOn: "2026-10-01", required: true, blocksHandoff: false, evidence: true, ownerApproval: false, ownerDependency: "feedback", module: "Pool", breezeway: null, opportunity: null };
const csv = toCsv(PLAN_HEADER, [
  planRow({ ...base, stageNo: 2, stage: "Setup", taskNo: 1, title: "Wifi", role: "utilities", anchor: "planned_closing", offset: 3 }),
  planRow({ ...base, stageNo: 1, stage: "Intake", taskNo: 2, title: "B", role: "Cleaner lead", anchor: "actual_closing", offset: -2 }),
  planRow({ ...base, stageNo: 1, stage: "Intake", taskNo: 1, title: "A", role: null, anchor: null, offset: null, opportunity: { title: "Pick paint", what: "w" } }),
]);

describe("template CSV import", () => {
  it("round-trips an export into ordered stages without home state", () => {
    const p = parseTemplateCsv(csv);
    expect(p.errors).toEqual([]);
    expect(p.stages.map((s) => s.name)).toEqual(["Intake", "Setup"]);
    expect(p.stages[0]!.tasks.map((t) => t.title)).toEqual(["A", "B"]);
    const b = p.stages[0]!.tasks[1]!;
    expect([b.role, b.functionalRole, b.scheduleAnchor, b.offsetDays]).toEqual(["Cleaner lead", null, "actual_closing", -2]);
    expect(p.stages[1]!.tasks[0]!.functionalRole).toBe("utilities");
    expect(p.stages[0]!.tasks[0]!.opportunity?.title).toBe("Pick paint");
    expect(p.stages[0]!.tasks[0]!.detail).toBe("=do it");
    expect(p.ignoredColumns).toEqual(["Plan", "Assigned person", "Status", "Due date"]);
    expect(JSON.stringify(p)).not.toContain("complete");
    expect(JSON.stringify(p)).not.toContain("Kati");
  });
  it("reports row-specific errors", () => {
    const bad = "Stage,Task,Required,Due rule\nIntake,,Yes,\nIntake,X,maybe,soon\nIntake,X,Yes,\n";
    const p = parseTemplateCsv(bad);
    expect(p.errors.map((e) => e.row)).toEqual([2, 3, 3, 4]);
  });
  it("refuses unknown columns", () => {
    expect(parseTemplateCsv("Stage,Task,Colour\nA,B,red\n").errors[0]!.message).toContain("Colour");
  });
  it("parses due rules", () => {
    expect(parseDueRule("3 day(s) after planned closing")).toEqual({ anchor: "planned_closing", offset: 3 });
    expect(parseDueRule("tomorrow")).toBe("invalid");
  });
});
