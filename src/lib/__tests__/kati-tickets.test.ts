import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { markDoneProblem } from "@/lib/plan-catch-up";
import { completionBlock } from "@/lib/onboarding-task-kinds";
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

describe("Nov 22: O7 and O8 changed, no onboarding Task asks for proof", () => {
  it("a Task marked as needing proof can be finished with no note and no file", () => {
    expect(canFinish({ ...base, evidence_file_count: 0 })).toBe(true);
    expect(canFinish({ ...base, evidence_note: "" })).toBe(true);
  });
  it("the guided card goes straight to complete, never to a proof step", () => {
    expect(onboardingTaskAction(viewTask(base, []))?.id).toBe("complete_task");
  });
  it("Mark done for many Tasks needs no note; the Done before Resolve date rules stay", () => {
    const ok = { note: "", when: "today" as const, doneOn: null, today: "2026-11-22", count: 5 };
    expect(markDoneProblem(ok)).toBeNull();
    expect(markDoneProblem({ ...ok, when: "earlier" })).toBe("Pick the date it was done.");
    expect(markDoneProblem({ ...ok, when: "earlier", doneOn: "2026-11-23" })).toBe("Pick a date that is not in the future.");
    expect(markDoneProblem({ ...ok, when: "earlier", doneOn: "2026-11-02" })).toBeNull();
  });
  it("no kind of Task waits on proof in the task window", () => {
    expect(completionBlock("do_it", {})).toBeNull();
    expect(completionBlock("vendor_request", {})).toBeNull();
    expect(completionBlock("work_order", { workOrderSent: true })).toBeNull();
    expect(completionBlock("outside_resolve", { where: "docusign" })).toBeNull();
    expect(completionBlock("outside_resolve", {})).toBe("Choose where it went.");
  });
  it("the task window and the save have no proof field or proof check", () => {
    const drawer = readFileSync("src/components/onboarding/TaskDrawer.tsx", "utf8");
    expect(drawer).not.toContain("Proof it&apos;s done");
    expect(drawer).not.toContain("Where is the proof?");
    expect(readFileSync("src/lib/onboarding.server.ts", "utf8")).not.toContain("EVIDENCE_PROBLEM");
    expect(readFileSync("src/components/onboarding/BulkCompleteDialog.tsx", "utf8")).not.toContain('>Proof<');
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
