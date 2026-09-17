import { expect, it } from "bun:test";
import {
  archiveOnboardingTask,
  recordTaskException,
  reopenOnboardingTask,
} from "../onboarding.server";

it("archive and exception cannot change requirements during or after handoff", async () => {
  for (const action of [archiveOnboardingTask, recordTaskException, reopenOnboardingTask]) {
    for (const property of [
      { lifecycle_status: "handoff_requested", handoff_accepted_at: null },
      { lifecycle_status: "active_operations", handoff_accepted_at: null },
      { lifecycle_status: "onboarding", handoff_accepted_at: "2026-09-01T00:00:00Z" },
    ]) {
      let writes = 0;
      const db = {
        rpc: async () => ({ data: true, error: null }),
        from: (table: string) => {
          if (!["onboarding_tasks", "properties"].includes(table))
            throw new Error("unexpected read after handoff guard");
          const query = {
            select: () => query,
            eq: () => query,
            single: async () => ({
              data:
                table === "properties"
                  ? property
                  : { property_id: "home", stage: "design", archived_at: null, status: "complete" },
              error: null,
            }),
            update: () => {
              writes++;
              return query;
            },
          };
          return query;
        },
      };
      const message = await action(db as never, "supervisor", {
        taskId: "task",
        reason: "QA reason",
      }).then(
        () => "unexpected success",
        (error: Error) => error.message,
      );
      expect(message).toContain("Return the handoff");
      expect(writes).toBe(0);
    }
  }
});

it("archive and exception cannot change reviewed-stage requirements", async () => {
  for (const action of [archiveOnboardingTask, recordTaskException, reopenOnboardingTask]) {
    for (const stageStatus of ["awaiting_review", "complete"]) {
      const db = {
        rpc: async () => ({ data: true, error: null }),
        from: (table: string) => {
          const row =
            table === "onboarding_tasks"
              ? { property_id: "home", stage: "design", archived_at: null, status: "complete" }
              : table === "properties"
                ? { lifecycle_status: "onboarding", handoff_accepted_at: null }
                : table === "onboarding_projects"
                  ? { id: "project" }
                  : [
                      {
                        id: "capture",
                        new_value: JSON.stringify({
                          stage: "design",
                          revision: 2,
                          status: stageStatus,
                        }),
                      },
                    ];
          const query = {
            select: () => query,
            eq: () => query,
            neq: () => query,
            like: () => query,
            order: () => query,
            single: async () => ({ data: row, error: null }),
            maybeSingle: async () => ({ data: row, error: null }),
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve({ data: row, error: null }).then(resolve),
            update: () => {
              throw new Error("unexpected write");
            },
          };
          return query;
        },
      };
      const message = await action(db as never, "supervisor", {
        taskId: "task",
        reason: "QA reason",
      }).then(
        () => "unexpected success",
        (error: Error) => error.message,
      );
      expect(message).toContain("Return or reopen the stage");
    }
  }
});

it("reopening preserves evidence and refuses a stale completion before writing history", async () => {
  let patch: unknown;
  const filters: unknown[] = [];
  let updating = false;
  const db = {
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      const row =
        table === "onboarding_tasks"
          ? {
              id: "task",
              property_id: "home",
              stage: "design",
              status: "complete",
              archived_at: null,
              completed_at: "2026-09-01T00:00:00Z",
            }
          : table === "properties"
            ? { lifecycle_status: "onboarding", handoff_accepted_at: null }
            : null;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          if (updating) filters.push([key, value]);
          return query;
        },
        neq: () => query,
        order: () => query,
        update: (value: unknown) => {
          patch = value;
          updating = true;
          return query;
        },
        single: async () => ({ data: row, error: null }),
        maybeSingle: async () => ({ data: updating ? null : row, error: null }),
      };
      return query;
    },
  };
  const message = await reopenOnboardingTask(db as never, "staff", {
    taskId: "task",
    reason: "Needs correction",
  }).then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
  expect(message).toContain("This step changed");
  expect(patch).toEqual({ status: "open" });
  expect(filters).toEqual([
    ["id", "task"],
    ["status", "complete"],
    ["completed_at", "2026-09-01T00:00:00Z"],
  ]);
});
