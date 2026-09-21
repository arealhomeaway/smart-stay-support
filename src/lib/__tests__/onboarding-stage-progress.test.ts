import { describe, expect, it } from "bun:test";
import { masterStageForLegacyTask } from "@/lib/onboarding-stage-map";
import { STAGED_FULL_FURNISHING_TEMPLATE } from "@/lib/onboarding-template";
import { MASTER_STAGES } from "@/lib/onboarding-master-sequence";
import {
  planSummary,
  stageOf,
  stageProgress,
  type StageTask,
} from "@/lib/onboarding-stage-progress";

const task = (over: Partial<StageTask> = {}): StageTask => ({
  id: crypto.randomUUID(),
  title: "Some step",
  stage: "fieldwork_setup_review",
  status: "open",
  ...over,
});

describe("stage mapping", () => {
  it("files every detailed task under one of the eight stages", () => {
    const stages = new Set(MASTER_STAGES.map((s) => s.value));
    for (const t of STAGED_FULL_FURNISHING_TEMPLATE) expect(stages.has(t.stage as never)).toBe(true);
  });

  it("keeps the task itself untouched", () => {
    const t = STAGED_FULL_FURNISHING_TEMPLATE[0];
    expect(t.title.length).toBeGreaterThan(0);
    expect(t.legacyStage).toBeTruthy();
  });

  it("sends utilities, design, listing and money work where it belongs", () => {
    expect(masterStageForLegacyTask("phase1_inspection", "Transfer trash service")).toBe(
      "scope_utilities_compliance",
    );
    expect(masterStageForLegacyTask("phase3_work_orders", "Send Mood Boards to Owner")).toBe(
      "design_approvals_procurement",
    );
    expect(masterStageForLegacyTask("phase6_handoff", "Review invoices")).toBe(
      "closeout_stabilization",
    );
    expect(masterStageForLegacyTask("phase6_handoff", "Schedule the Handoff Meeting")).toBe(
      "handoff_acceptance",
    );
  });

  it("leaves unknown headings alone", () => {
    expect(masterStageForLegacyTask("intake_identity", "Anything")).toBeNull();
  });
});

describe("stage progress", () => {
  it("reads a legacy task under its new stage", () => {
    expect(stageOf(task({ stage: "phase4_purchasing", title: "Purchase essentials" }))).toBe(
      "design_approvals_procurement",
    );
  });

  it("counts finished, held up and late work", () => {
    const rows = [
      task({ status: "complete" }),
      task({ status: "blocked", blocker: "Waiting on the vendor" }),
      task({ dueOn: "2026-01-01" }),
      task({ dueOn: "2026-12-31" }),
      task({ parentTaskId: "p", status: "complete" }),
    ];
    const progress = stageProgress(rows, "2026-06-01");
    const field = progress.find((s) => s.stage === "fieldwork_setup_review")!;
    expect(field.total).toBe(4);
    expect(field.complete).toBe(1);
    expect(field.blocked).toBe(1);
    expect(field.overdue).toBe(1);
    expect(field.state).toBe("blocked");
    expect(field.percent).toBe(25);
  });

  it("summarises the whole plan", () => {
    const s = planSummary(stageProgress([task({ status: "complete" }), task()], "2026-06-01"));
    expect(s.total).toBe(2);
    expect(s.complete).toBe(1);
    expect(s.percent).toBe(50);
    expect(s.currentStage).toBe("Stage 5 — Fieldwork, Setup & Mid-Project Review");
  });

  it("shows nothing started when there are no tasks", () => {
    expect(planSummary(stageProgress([], "2026-06-01")).currentStage).toBe("Not started");
  });
});
