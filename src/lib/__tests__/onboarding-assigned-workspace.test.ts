import { expect, it } from "bun:test";
import { loadOnboardingWorkspace } from "../onboarding.server";
import { restoreAssignedRelease } from "../onboarding-assigned-context";
import { viewTask, type WorkflowTask } from "../onboarding-workflow";

function fixture(projectLead = false) {
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
  if (projectLead) {
    sources["properties"]!.push({
      id: "managed",
      name: "Managed home",
      lifecycle_status: "onboarding",
      access_notes: "managed access",
    });
    sources["onboarding_tasks"]!.push(task("managed-task", "managed", "other-user"));
    sources["onboarding_projects"]!.push(
      {
        id: "managed-project",
        property_id: "managed",
        status: "active",
        project_manager: "field",
        director: null,
      },
      {
        id: "cancelled",
        property_id: "other",
        status: "cancelled",
        project_manager: "field",
        director: null,
      },
    );
    sources["onboarding_notes"]!.push({ property_id: "managed", body: "managed note" });
    sources["documents"]!.push({ entity_id: "managed", external_url: "managed document" });
    sources["approvals"]!.push({ id: "managed-approval", property_id: "managed" });
    sources["property_handoffs"] = [
      { id: "handoff", property_id: "managed", status: "requested" },
      { id: "private-handoff", property_id: "home" },
    ];
    sources["handoff_reviews"] = [
      { id: "review", property_id: "managed", handoff_id: "handoff" },
      { id: "invalid-link", property_id: "managed", handoff_id: "private-handoff" },
    ];
    sources["external_records"] = [
      { property_id: "managed", database_key: "managed-db" },
      { property_id: "home", database_key: "private-db" },
    ];
    sources["external_databases"] = [{ key: "managed-db" }, { key: "private-db" }];
  }
  const db = {
    rpc: async (name: string) => ({
      data:
        name === "read_onboarding_review_capabilities"
          ? [
              {
                is_admin: false,
                can_review_stages: false,
                kati_review: false,
                micah_review: false,
                operations_acceptance: false,
                live_confirmation: false,
              },
            ]
          : name === "is_onboarding_staff",
      error: null,
    }),
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
  return { db, own };
}

it("returns assigned work with redacted prerequisite context, excluding unrelated records", async () => {
  const { db, own } = fixture();
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

it("projects scope preserves outside assignments without exposing their project records", async () => {
  const { db, own } = fixture(true);
  const result = await loadOnboardingWorkspace(db as never, "field");
  expect(result.workspaceMode).toBe("projects");
  expect(result.projects.map((project) => project.id)).toEqual(["managed-project"]);
  expect(result.pipeline).toEqual(["managed"]);
  expect(result.properties.map((property) => property.id)).toEqual(["home", "managed"]);
  expect(result.tasks.map((task) => task.id)).toEqual(["managed-task", "mine"]);
  expect(result.properties.find((property) => property.id === "home")?.access_notes).toBe(null);
  expect(result.properties.find((property) => property.id === "managed")?.access_notes).toBe(
    "managed access",
  );
  expect(result.notes.map((note) => note.body)).toEqual(["managed note"]);
  expect(result.documents.map((document) => document.external_url)).toEqual(["managed document"]);
  expect(result.ownerApprovals.map((approval) => approval.id)).toEqual([
    "own-approval",
    "managed-approval",
  ]);
  expect(result.handoffs.map((handoff) => handoff.id)).toEqual(["handoff"]);
  expect(result.reviews.map((review) => review.id)).toEqual(["review"]);
  expect(result.externalDatabases.map((database) => database.key)).toEqual(["managed-db"]);
  expect(result.externalRecords.map((record) => record.database_key)).toEqual(["managed-db"]);
  const context = result.assignedWorkContexts[0]!;
  expect(context.propertyId).toBe("home");
  expect(context.tasks.map((task) => task.id)).toEqual(["mine", "dependency"]);
  expect(
    viewTask(own as unknown as WorkflowTask, context.tasks, restoreAssignedRelease(context))
      .canComplete,
  ).toBe(false);
  expect(JSON.stringify(result).includes("private project")).toBe(false);
});
