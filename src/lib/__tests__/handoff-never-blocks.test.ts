/**
 * A handoff never blocks (Emily, Nov 7, 2026; register O4, punch list H4).
 * Open handoff tasks are carry over items, never blockers, and the Task screen no longer says
 * "Blocks handoff to Operations while it is open".
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { validateHandoff } from "@/lib/onboarding";
import { handoffReadiness, type StateProperty } from "@/lib/onboarding-state";
import { viewTask, whyThisTaskExists, type WorkflowTask } from "@/lib/onboarding-workflow";
import { carryItems, homeRequirements } from "@/lib/handoff-standard";
import { kindLabel } from "@/lib/notification-feed";
import { categoryForKind } from "@/lib/notification-preferences";

const HOME = {
  address_line1: "1 Main St", city: "Indianapolis", state: "IN", postal_code: "46201",
  latitude: 39.7, longitude: -86.1, access_notes: "Front lockbox", quarterly_review_due_on: "2027-01-01",
};

function task(over: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: "t1", property_id: "p1", stage: "Handoff", title: "Final walkthrough", detail: null,
    assigned_to: null, assigned_seat: null, due_on: "2026-11-20", due_on_source: null, due_on_overridden: false,
    schedule_anchor: null, schedule_offset_days: null, depends_on: null, parent_task_id: null, blocker: null,
    blocks_handoff: true, evidence_required: false, evidence_note: null, requires_owner_approval: false,
    owner_approval_status: "not_required", exception_reason: null, carryover_of: null, carryover_reason: null,
    linked_ticket_id: null, status: "open", sort_order: 1, completed_at: null, created_at: "2026-11-01T00:00:00.000Z",
    ...over,
  };
}

const PROPERTY: StateProperty = {
  id: "p1", name: "1 Main St", lifecycle_status: "onboarding", onboarding_stage: "Handoff",
  access_notes: "Front lockbox", actual_access_on: "2026-10-01", planned_closing_on: "2026-09-30", handoff_accepted_at: null,
};

describe("readiness check", () => {
  it("an open handoff task is a carry over item, not a blocker", () => {
    const { checks, ready, openBlocking } = validateHandoff(HOME, [task(), task({ id: "t2" })]);
    const c = checks.find((x) => x.key === "tasks")!;
    expect(c.blocking).toBe(false);
    expect(c.label).toBe("Open handoff tasks carry over");
    expect(c.detail).toBe("2 open handoff tasks will carry over to Operations.");
    expect(openBlocking).toEqual(["t1", "t2"]);
    expect(ready).toBe(true);
  });

  it("one open handoff task reads in the singular; none reads plainly", () => {
    expect(validateHandoff(HOME, [task()]).checks.find((x) => x.key === "tasks")!.detail).toBe(
      "1 open handoff task will carry over to Operations.",
    );
    expect(validateHandoff(HOME, []).checks.find((x) => x.key === "tasks")!.detail).toBe("No handoff tasks are open.");
  });

  it("handoff readiness has no hard reason from open handoff tasks", () => {
    const t = task();
    const r = handoffReadiness(
      { property: PROPERTY, project: { id: "pr1", status: "active", completed_at: null }, tasks: [t], handoff: null },
      validateHandoff(HOME, [t]).checks,
    );
    expect(r.hardReasons.map((x) => x.key)).not.toContain("tasks");
    expect(r.blocked).toBe(false);
  });

  it("the other readiness checks still block exactly as before", () => {
    const { checks, ready } = validateHandoff({ ...HOME, access_notes: null }, [task()]);
    expect(checks.find((x) => x.key === "access")!.blocking).toBe(true);
    expect(ready).toBe(false);
  });
});

describe("Task screen wording", () => {
  it("no longer says the Task blocks handoff", () => {
    const t = task();
    const lines = whyThisTaskExists(viewTask(t, [t]), [t]);
    expect(lines.join(" ")).not.toContain("Blocks handoff");
    expect(readFileSync("src/lib/onboarding-workflow.ts", "utf8")).not.toContain("Blocks handoff to Operations while it is open");
  });
});

describe("acceptance", () => {
  it("open handoff tasks with the marks cleared still become carry over items", () => {
    const tasks = [
      { id: "a", title: "Final walkthrough", status: "open", template_task_id: "s1", due_on: null, assigned_seat: null, blocks_handoff: false, is_required: false },
      { id: "b", title: "Photos", status: "complete", template_task_id: "s2", due_on: null, assigned_seat: null, blocks_handoff: false, is_required: false },
    ];
    const items = carryItems(homeRequirements([], tasks, []), tasks, "2026-11-08");
    expect(items.map((i) => i.taskIds)).toEqual([["a"]]);
    expect(items[0]!.ownerRole).toBe("ops_supervisor");
  });
});

describe("handoff reminder alert", () => {
  it("has a plain label and follows the Handoffs preference", () => {
    expect(kindLabel("handoff_reminder")).toBe("Handoff reminder");
    expect(categoryForKind("handoff_reminder")).toBe("handoffs");
  });
});
