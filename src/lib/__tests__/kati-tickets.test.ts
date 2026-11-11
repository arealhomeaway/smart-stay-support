import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  EVIDENCE_PROBLEM,
  bulkCompleteProblem,
  evidenceSatisfied,
  fileEvidenceNote,
} from "@/lib/onboarding-evidence";
import {
  breezewayConnection,
  isBreezewayWorkOrderStep,
  onboardingSendRequestKey,
  parseBreezewayRef,
  sendToBreezewayRefusal,
  showsBreezewayHomeLink,
} from "@/lib/onboarding-breezeway";
import { onboardingTaskAction } from "@/lib/onboarding-task-action";
import { viewTask, type WorkflowTask } from "@/lib/onboarding-workflow";
import { buildReleaseContext, releaseState } from "@/lib/onboarding-state";

const HOME = {
  id: "p1", name: "Test home", lifecycle_status: "onboarding", onboarding_stage: "phase1_inspection",
  access_notes: null, actual_access_on: null, planned_closing_on: "2026-11-20", handoff_accepted_at: null,
};
const canFinish = (t: WorkflowTask) =>
  releaseState(t, [t], buildReleaseContext({ property: HOME as never, project: { id: "pr1", status: "active", completed_at: null }, tasks: [t], handoff: null })).canComplete;

/** Kati's onboarding tickets 65, 66, 67 (Build 15, Emily Nov 10). */
const base: WorkflowTask = {
  id: "t1", property_id: "p1", stage: "Pre-Close", title: "Create the OwnerRez property", detail: null,
  assigned_to: null, assigned_seat: null, due_on: null, due_on_source: null, due_on_overridden: false,
  schedule_anchor: null, schedule_offset_days: null, depends_on: [], parent_task_id: null, blocker: null,
  blocks_handoff: true, evidence_required: true, evidence_note: null, requires_owner_approval: false,
  owner_approval_status: "not_required", owner_dependency: "none", exception_reason: null, carryover_of: null,
  carryover_reason: null, linked_ticket_id: null, status: "open", sort_order: 10, completed_at: null,
};

describe("ticket 65: evidence is a file or a note of at least 5 characters", () => {
  it("a note completes, a file completes, neither does not", () => {
    expect(evidenceSatisfied({ note: "Signed copy is in the SharePoint home folder" })).toBe(true);
    expect(evidenceSatisfied({ note: "", fileCount: 1 })).toBe(true);
    expect(evidenceSatisfied({ note: "", fileCount: 0 })).toBe(false);
    expect(evidenceSatisfied({ note: "done" })).toBe(false);
    expect(evidenceSatisfied({ note: "done." })).toBe(true);
  });
  it("the step can be completed with a file and no note, and not with neither", () => {
    expect(canFinish({ ...base, evidence_file_count: 1 })).toBe(true);
    expect(canFinish({ ...base, evidence_file_count: 0 })).toBe(false);
    expect(canFinish({ ...base, evidence_note: "In the home folder" })).toBe(true);
    expect(canFinish({ ...base, evidence_note: "done" })).toBe(false);
  });
  it("the guided card stops asking for proof once a file is on the step", () => {
    expect(onboardingTaskAction(viewTask(base, []))?.id).toBe("capture_evidence");
    expect(onboardingTaskAction(viewTask({ ...base, evidence_file_count: 1 }, []))?.id).toBe("complete_task");
  });
  it("a file alone is recorded by name", () => {
    expect(fileEvidenceNote("signed.pdf")).toBe("Proof is the attached file: signed.pdf");
  });
  it("bulk complete needs one note or one file, and a past or today Done before Resolve date", () => {
    const ok = { note: "Signed copy is in the SharePoint home folder", hasFile: false, doneBeforeResolve: false, doneOn: null, today: "2026-11-10", count: 5 };
    expect(bulkCompleteProblem(ok)).toBeNull();
    expect(bulkCompleteProblem({ ...ok, note: "ok" })).toBe(EVIDENCE_PROBLEM);
    expect(bulkCompleteProblem({ ...ok, note: "", hasFile: true })).toBeNull();
    expect(bulkCompleteProblem({ ...ok, doneBeforeResolve: true })).toBe("Pick the date the work was done.");
    expect(bulkCompleteProblem({ ...ok, doneBeforeResolve: true, doneOn: "2026-11-11" })).toContain("future");
    expect(bulkCompleteProblem({ ...ok, doneBeforeResolve: true, doneOn: "2026-11-02" })).toBeNull();
  });
  it("the save no longer refuses long plan instructions", () => {
    const fns = readFileSync("src/lib/onboarding.functions.ts", "utf8");
    expect(fns).toContain("detail: z.string().trim().max(20000)");
  });
});

describe("ticket 66: a step needing owner approval can always be sent", () => {
  const mood: WorkflowTask = {
    ...base, title: "Share the mood boards and floor plans with the owner", evidence_required: false,
    requires_owner_approval: true, owner_approval_status: "not_required", owner_dependency: "feedback",
  };
  it("offers Send it to the homeowner when the stored status is the older not_required", () => {
    expect(onboardingTaskAction(viewTask(mood, []))?.id).toBe("send_for_approval");
  });
  it("still offers it when waiting to be sent, and records the answer once sent", () => {
    expect(onboardingTaskAction(viewTask({ ...mood, owner_approval_status: "pending" }, []))?.id).toBe("send_for_approval");
    expect(onboardingTaskAction(viewTask({ ...mood, owner_approval_status: "awaiting_owner" }, []))?.id).toBe("record_owner_answer");
  });
  it("a new step needing approval is saved without sending to the homeowner", () => {
    const server = readFileSync("src/lib/onboarding.server.ts", "utf8");
    const create = server.slice(server.indexOf('action: "onboarding_task_created"'), server.indexOf("export async function ensureOwnerApprovalRequest"));
    expect(create).not.toContain("ensureOwnerApprovalRequest(");
  });
});

describe("ticket 67: Breezeway work orders on onboarding steps", () => {
  it("only Work order steps carry the section; the two setup steps show the home link", () => {
    expect(isBreezewayWorkOrderStep("Work order: Pick up keys from the post office")).toBe(true);
    expect(isBreezewayWorkOrderStep("Review and approve every Breezeway work order")).toBe(false);
    expect(showsBreezewayHomeLink("Set up the Breezeway property profile")).toBe(true);
    expect(showsBreezewayHomeLink("Set up the Breezeway and Yale integration")).toBe(true);
    expect(showsBreezewayHomeLink("Update the Breezeway property details")).toBe(false);
  });
  it("reads a pasted number or app.breezeway.io link, and refuses anything else", () => {
    expect(parseBreezewayRef("123456")).toEqual({ ok: true, taskId: 123456, url: null });
    expect(parseBreezewayRef("https://app.breezeway.io/task/98765")).toEqual({ ok: true, taskId: 98765, url: "https://app.breezeway.io/task/98765" });
    expect(parseBreezewayRef("https://example.com/task/1")?.ok).toBe(false);
    expect(parseBreezewayRef("")).toBeNull();
  });
  it("is Connected only once the linked task is in the Breezeway mirror", () => {
    expect(breezewayConnection({ breezewayTaskId: null, mirrored: false })).toBe("not_linked");
    expect(breezewayConnection({ breezewayTaskId: 5, mirrored: false })).toBe("waiting_for_sync");
    expect(breezewayConnection({ breezewayTaskId: 5, mirrored: true })).toBe("connected");
  });
  it("Send to Breezeway refuses while the switch is off, even for a ready verified home", () => {
    expect(sendToBreezewayRefusal({ switchOn: false, homeEligible: true, tentativeDate: "2026-11-12", alreadyLinked: false })).toContain("switched off");
    expect(sendToBreezewayRefusal({ switchOn: true, homeEligible: false, homeReason: "Not verified", tentativeDate: "2026-11-12", alreadyLinked: false })).toBe("Not verified");
    expect(sendToBreezewayRefusal({ switchOn: true, homeEligible: true, tentativeDate: null, alreadyLinked: false })).toBe("Pick a tentative date first.");
    expect(sendToBreezewayRefusal({ switchOn: true, homeEligible: true, tentativeDate: "2026-11-12", alreadyLinked: false })).toBeNull();
    expect(onboardingSendRequestKey("abc")).toBe(onboardingSendRequestKey("abc"));
  });
  // The send refusal itself is exercised against the real send path in breezeway-outbound.test.ts.
});
