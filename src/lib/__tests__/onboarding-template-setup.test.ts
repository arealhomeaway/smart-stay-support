import { describe, expect, it } from "bun:test";
import { MASTER_ONBOARDING_TEMPLATE, templateCounts } from "../onboarding-template";
import { applyOnboardingTemplate, previewOnboardingTemplate } from "../onboarding-template.server";
import { ensureOwnerApprovalRequest } from "../onboarding.server";
import type { AuditEntry } from "../audit.server";

type Task = {
  id: string;
  property_id: string;
  title: string;
  stage: string;
  parent_task_id: string | null;
  detail: string;
  due_on: string | null;
  requires_owner_approval: boolean;
  owner_approval_status: string;
  archived_at: string | null;
  is_demo: boolean;
};

function fixture(partiallySaved = false, allowOwnerContactRead = false) {
  const property = {
    id: "qa-home",
    name: "Synthetic QA home",
    is_demo: true,
    owner_record_id: "canonical-owner",
    archived_at: null,
    planned_closing_on: "2026-09-17",
    actual_closing_on: null,
    actual_access_on: "2026-09-17",
  };
  const tasks: Task[] = partiallySaved
    ? MASTER_ONBOARDING_TEMPLATE.map((task, index) => ({
        id: `saved-${index}`,
        property_id: property.id,
        title: task.title,
        stage: task.stage,
        parent_task_id: null,
        detail: task.detail ?? "",
        due_on: null,
        requires_owner_approval: Boolean(task.requiresOwnerApproval),
        owner_approval_status: task.requiresOwnerApproval ? "pending" : "not_required",
        archived_at: null,
        is_demo: true,
      }))
    : [];
  const approvals = new Map<string, string>();
  const prepared: string[] = [];
  const reads: string[] = [];
  const audit: AuditEntry[] = [];
  const saveAudit = async (entry: AuditEntry) => {
    audit.push(entry);
  };
  if (partiallySaved) {
    const first = tasks.find((task) => task.requires_owner_approval)!;
    first.owner_approval_status = "awaiting_owner";
    approvals.set(first.id, "original-pending-approval");
  }
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "is_onboarding_staff") return { data: true, error: null };
      if (name !== "prepare_onboarding_task_approval") throw new Error(`Unexpected RPC: ${name}`);
      const task = tasks.find((task) => task.id === args["_task_id"])!;
      if (
        !task.requires_owner_approval ||
        ["approved", "waived"].includes(task.owner_approval_status)
      )
        throw new Error("A recorded decision must not be prepared again");
      prepared.push(task.id);
      if (!approvals.has(task.id)) approvals.set(task.id, `approval-${task.id}`);
      task.owner_approval_status = "awaiting_owner";
      return { data: approvals.get(task.id), error: null };
    },
    from: (table: string) => {
      reads.push(table);
      if (
        !(allowOwnerContactRead && table === "property_owners") &&
        ![
          "properties",
          "onboarding_tasks",
          "functional_roles",
          "owner_program_properties",
          "approvals",
          // No team-authored template is marked default in this fixture, so the
          // built-in plan is the one that applies.
          "onboarding_templates",
          "onboarding_template_tasks",
        ].includes(table)
      )
        throw new Error(`Unexpected owner contact or other access: ${table}`);
      let inserted: Task[] | null = null;
      const matches: ((row: Task) => boolean)[] = [];
      const result = () => ({
        data:
          table === "onboarding_tasks"
            ? (inserted ?? tasks.filter((task) => matches.every((match) => match(task))))
            : [],
        error: null,
      });
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          matches.push((task) => task[key as keyof Task] === value);
          return query;
        },
        is: (key: string, value: unknown) => query.eq(key, value),
        order: () => query,
        in: () => query,
        range: async () => {
          const data =
            table === "properties"
              ? [property]
              : table === "property_owners"
                ? [
                    {
                      id: property.owner_record_id,
                      name: "Synthetic Owner",
                      email: "qa@example.invalid",
                      phone: null,
                      source: "manual",
                    },
                  ]
                : [];
          return { data, error: null, count: data.length };
        },
        single: async () => query.maybeSingle(),
        maybeSingle: async () => ({
          data:
            table === "onboarding_templates" || table === "onboarding_template_tasks"
              ? null
              : table === "properties"
              ? property
              : { id: "approval", title: "QA decision", detail: "", status: "pending" },
          error: null,
        }),
        insert: (rows: Record<string, unknown>[]) => {
          if (table !== "onboarding_tasks") throw new Error("Unexpected non-task write");
          inserted = rows.map(
            (row, index) =>
              ({
                parent_task_id: null,
                due_on: null,
                archived_at: null,
                ...row,
                id: `created-${tasks.length + index}`,
              }) as Task,
          );
          tasks.push(...inserted);
          return query;
        },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  };
  return { db, tasks, approvals, prepared, reads, audit, saveAudit };
}

describe("onboarding template setup", () => {
  it("prepares canonical approvals and all tasks on a demo property without routing a decision", async () => {
    const f = fixture();
    const result = await applyOnboardingTemplate(
      f.db as never,
      "staff",
      { propertyId: "qa-home" },
      f.saveAudit,
    );
    const counts = templateCounts();
    expect(result).toEqual({
      created: counts.tasks,
      refreshed: 0,
      subtasksCreated: counts.subtasks,
      skipped: 0,
    });
    expect(f.approvals.size).toBe(counts.ownerApprovals);
    expect(f.tasks.every((task) => task.is_demo && task.property_id === "qa-home")).toBe(true);
    expect(f.reads.includes("approvals")).toBe(false);
    expect(f.audit).toHaveLength(1);
  });

  it("repairs a saved plan without replacing tasks, repeating approvals or changing recorded decisions", async () => {
    const f = fixture(true);
    const counts = templateCounts();
    expect(f.tasks).toHaveLength(counts.tasks);
    const savedIds = f.tasks.map((task) => task.id);
    const approvalTasks = f.tasks.filter((task) => task.requires_owner_approval);
    const originalTaskId = approvalTasks[0]!.id;
    const approvedTask = f.tasks.find((task) => !task.requires_owner_approval)!;
    approvedTask.requires_owner_approval = true;
    approvedTask.owner_approval_status = "approved";
    const waivedTask = f.tasks.find((task) => !task.requires_owner_approval)!;
    waivedTask.requires_owner_approval = true;
    waivedTask.owner_approval_status = "waived";
    const preview = await previewOnboardingTemplate(f.db as never, "staff", {
      propertyId: "qa-home",
    });
    expect(preview.toCreate).toHaveLength(0);
    expect(preview.subtasksToCreate).toBe(counts.subtasks);

    const result = await applyOnboardingTemplate(
      f.db as never,
      "staff",
      { propertyId: "qa-home" },
      f.saveAudit,
    );
    expect(result).toEqual({
      created: 0,
      refreshed: 0,
      subtasksCreated: counts.subtasks,
      skipped: counts.tasks,
    });
    expect(f.tasks.filter((task) => !task.parent_task_id).map((task) => task.id)).toEqual(savedIds);
    expect(f.approvals.get(originalTaskId)).toBe("original-pending-approval");
    expect(f.approvals.size).toBe(counts.ownerApprovals);
    expect(f.approvals.has(approvalTasks[1]!.id)).toBe(true);
    expect(approvedTask.owner_approval_status).toBe("approved");
    expect(waivedTask.owner_approval_status).toBe("waived");

    const savedApprovals = [...f.approvals];
    const retried = await applyOnboardingTemplate(
      f.db as never,
      "staff",
      { propertyId: "qa-home" },
      f.saveAudit,
    );
    expect(retried).toEqual({ created: 0, refreshed: 0, subtasksCreated: 0, skipped: counts.tasks });
    expect([...f.approvals]).toEqual(savedApprovals);
    expect(f.tasks).toHaveLength(counts.tasks + counts.subtasks);
    const complete = await previewOnboardingTemplate(f.db as never, "staff", {
      propertyId: "qa-home",
    });
    expect(complete.subtasksToCreate).toBe(0);
    expect(f.reads.includes("approvals")).toBe(false);
  });

  it("keeps the real-property delivery boundary for explicit owner requests", async () => {
    const f = fixture(true, true);
    const task = f.tasks.find((task) => task.requires_owner_approval)!;
    const message = await ensureOwnerApprovalRequest(f.db as never, "staff", {
      taskId: task.id,
      propertyId: task.property_id,
      title: task.title,
      detail: task.detail,
      dueOn: null,
      isDemo: true,
    }).then(
      () => "unexpected delivery",
      (error: Error) => error.message,
    );
    expect(message).toContain("Only a current real property can route an owner decision");
    expect(f.approvals.get(task.id)).toBe("original-pending-approval");
  });

  it("refreshes steps already on the home when asked for new and existing", async () => {
    const f = fixture(true);
    const open = f.tasks.find((t) => !t.parent_task_id)!;
    open.detail = "stale wording";
    const result = await applyOnboardingTemplate(
      f.db as never,
      "staff",
      { propertyId: "qa-home", mode: "new_and_existing" },
      f.saveAudit,
    );
    expect(result.created).toBe(0);
    expect(result.refreshed).toBeGreaterThan(0);
    expect(open.detail).not.toBe("stale wording");
  });
});
