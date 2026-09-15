import { expect, it } from "bun:test";
import { loadOnboardingWorkspace } from "../onboarding.server";
import { restoreAssignedRelease } from "../onboarding-assigned-context";
import { viewTask, type WorkflowTask } from "../onboarding-workflow";

it("returns assigned work with redacted prerequisite context, excluding unrelated records", async () => {
  const task = (id: string, property: string, assignee: string, depends: string[] = []) => ({
    id,
    property_id: property,
    assigned_to: assignee,
    title: id,
    stage: "intake",
    status: "open",
    depends_on: depends,
    parent_task_id: null,
    detail: `private-${id}`,
    evidence_note: `evidence-${id}`,
    sort_order: 0,
    owner_approval_status: "not_required",
    created_at: "2026-01-01",
    blocker: null,
  });
  const own = task("mine", "home", "field", ["dependency"]);
  const sources: Record<string, unknown[]> = {
    properties: [
      {
        id: "home",
        name: "Assigned home",
        lifecycle_status: "onboarding",
        access_notes: "private access",
        wifi_notes: "private wifi",
      },
      { id: "other", name: "Unrelated home" },
    ],
    onboarding_tasks: [
      own,
      task("dependency", "home", "other-user"),
      task("unrelated-task", "home", "other-user"),
      task("other-home-task", "other", "other-user"),
    ],
    onboarding_projects: [
      {
        id: "project",
        property_id: "home",
        status: "active",
        project_manager: "pm",
        director: "director",
        internal_notes: "private project",
      },
    ],
    profiles: [
      { id: "field", email: "field@example.invalid" },
      { id: "other-user", email: "private@example.invalid" },
    ],
    onboarding_notes: [{ property_id: "home", body: "private note" }],
    documents: [{ entity_id: "home", external_url: "private document" }],
    approvals: [
      { id: "own-approval", entity_type: "onboarding_task", entity_id: "mine" },
      { id: "other-approval", entity_type: "onboarding_task", entity_id: "dependency" },
    ],
  };
  const db = {
    rpc: async (name: string) => ({ data: name === "is_onboarding_staff", error: null }),
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        not: () => query,
        is: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        range: async (from: number, to: number) => ({
          data: (sources[table] ?? []).slice(from, Math.min(to + 1, from + 2)),
          count: (sources[table] ?? []).length,
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: sources[table] ?? [], error: null }).then(resolve),
      };
      return query;
    },
  };
  const result = await loadOnboardingWorkspace(db as never, "field");
  expect(result.workspaceMode).toBe("assigned");
  expect(result.tasks.map((item) => item.id)).toEqual(["mine"]);
  expect(result.properties.map((item) => item.id)).toEqual(["home"]);
  expect(result.people.map((item) => item.id)).toEqual(["field"]);
  expect(result.ownerApprovals.map((item) => item.id)).toEqual(["own-approval"]);
  expect(result.projects).toEqual([]);
  expect(result.notes).toEqual([]);
  expect(result.documents).toEqual([]);
  expect(result.properties[0]?.access_notes).toBe(null);
  const context = result.assignedWorkContexts[0]!;
  expect(context.tasks.map((item) => item.id)).toEqual(["mine", "dependency"]);
  expect(context.tasks[1]?.detail).toBe(null);
  expect(context.tasks[1]?.evidence_note).toBe(null);
  expect(context.tasks[1]?.assigned_to).toBe(null);
  expect(JSON.stringify(result).includes("private project")).toBe(false);
  const view = viewTask(
    own as unknown as WorkflowTask,
    context.tasks,
    restoreAssignedRelease(context),
  );
  expect(view.canComplete).toBe(false);
  expect(view.waitingOn).toEqual(["dependency"]);
});
