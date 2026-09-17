import { expect, it } from "bun:test";
import { canManageOnboardingProperty } from "../onboarding-workspace-view";
import { taskPayload } from "../../components/onboarding/TaskDrawer";
import type { WorkflowTask } from "../onboarding-workflow";

it("management controls follow the selected task property rather than any lead assignment", () => {
  const projects = [
    { property_id: "managed", project_manager: "lead", director: "director", status: "active" },
  ];
  expect(canManageOnboardingProperty("lead", false, "managed", projects)).toBe(true);
  expect(canManageOnboardingProperty("director", false, "managed", projects)).toBe(true);
  expect(canManageOnboardingProperty("lead", false, "other", projects)).toBe(false);
  expect(canManageOnboardingProperty("field", false, "managed", projects)).toBe(false);
  expect(canManageOnboardingProperty(null, true, "managed", projects)).toBe(false);
  expect(canManageOnboardingProperty("supervisor", true, "other", projects)).toBe(true);
});

it("saving task evidence preserves nonzero order and existing requirement/link context", () => {
  const task = {
    id: "task",
    property_id: "home",
    title: "Review",
    sort_order: 47,
    status: "open",
    evidence_note: "old",
    evidence_required: true,
    requires_owner_approval: true,
    owner_approval_status: "approved",
    depends_on: ["dependency"],
    linked_ticket_id: "ticket",
  } as WorkflowTask;
  const payload = taskPayload(task, { evidenceNote: "New evidence" });
  expect(payload.sortOrder).toBe(47);
  expect(payload.evidenceNote).toBe("New evidence");
  expect(payload.evidenceRequired).toBe(true);
  expect(payload.ownerApprovalStatus).toBe("approved");
  expect(payload.dependsOn).toEqual(["dependency"]);
  expect(payload.linkedTicketId).toBe("ticket");
});
