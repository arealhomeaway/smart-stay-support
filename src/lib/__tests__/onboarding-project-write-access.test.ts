import { expect, it } from "bun:test";
import { startOnboardingProject, updateProject } from "../onboarding-project.server";

function fixture(supervisor = false, stale = false) {
  const project = {
    id: "project",
    property_id: "home",
    project_manager: "lead",
    director: "director",
    status: "active",
    updated_at: "2026-09-15T00:00:00Z",
    modules: [],
    furnishing_scope: "full_furnishing",
    is_demo: false,
  };
  let writes = 0;
  const filters: Record<string, unknown> = {};
  const db = {
    rpc: async (name: string) => ({
      data: name === "is_supervisor" ? supervisor : true,
      error: null,
    }),
    from: (table: string) => {
      let writing = false;
      let patch = {};
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          if (writing) filters[key] = value;
          return query;
        },
        neq: () => query,
        single: async () => ({
          data: table === "properties" ? { id: "home", name: "Home" } : project,
          error: null,
        }),
        maybeSingle: async () => ({
          data: writing && stale ? null : { ...project, ...patch },
          error: null,
        }),
        update: (value: object) => {
          writes++;
          writing = true;
          patch = value;
          return query;
        },
        insert: async () => {
          writes++;
          return { data: null, error: null };
        },
      };
      return query;
    },
  };
  return { db, filters, writes: () => writes };
}

it("denies unrelated staff before changing project details or ownership", async () => {
  const f = fixture();
  let denied = false;
  try {
    await updateProject(f.db as never, "unrelated", {
      projectId: "project",
      projectManager: "unrelated",
      notes: "change",
    });
  } catch {
    denied = true;
  }
  expect(denied).toBe(true);
  expect(f.writes()).toBe(0);
});

it("denies retrying Start Onboarding on an unrelated existing project", async () => {
  const f = fixture();
  let denied = false;
  try {
    await startOnboardingProject(f.db as never, "unrelated", {
      propertyId: "home",
      branch: null,
      projectManager: "unrelated",
      director: null,
      plannedClosingOn: null,
      possessionOn: null,
      targetHandoffOn: null,
      furnishingScope: "full_furnishing",
      modules: [],
      notes: null,
      externalRefs: {},
    });
  } catch (error) {
    denied = (error as Error).message.includes("project's lead");
  }
  expect(denied).toBe(true);
  expect(f.writes()).toBe(0);
});

it("rejects changed projects without writing history for an unsaved update", async () => {
  const f = fixture(false, true);
  let message = "";
  try {
    await updateProject(f.db as never, "lead", { projectId: "project", notes: "change" });
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain("project changed");
  expect(f.filters).toEqual({
    id: "project",
    property_id: "home",
    updated_at: "2026-09-15T00:00:00Z",
    status: "active",
  });
  expect(f.writes()).toBe(1);
});

it("permits PM, director and supervisor updates with project history", async () => {
  for (const actor of ["lead", "director", "supervisor"]) {
    const f = fixture(actor === "supervisor");
    const result = await updateProject(f.db as never, actor, {
      projectId: "project",
      notes: "updated",
    });
    expect(result.notes).toBe("updated");
    expect(f.writes()).toBe(2);
  }
});

/**
 * A home that already carries Active Owner must be able to record its dates.
 * Re-running enrollment on every save made a date edit fail outright for a
 * home whose enrollment had deliberately been set aside.
 */
it("saves dates on an Active Owner home without touching enrollment", async () => {
  const project = {
    id: "project",
    property_id: "home",
    project_manager: "lead",
    director: "director",
    status: "active",
    updated_at: "2026-09-15T00:00:00Z",
    modules: ["active_owner"],
    furnishing_scope: "full_furnishing",
    is_demo: false,
  };
  const rpcCalls: string[] = [];
  const updates: { table: string; patch: Record<string, unknown> }[] = [];
  const db = {
    rpc: async (name: string) => {
      rpcCalls.push(name);
      if (name === "create_owner_program") throw new Error("enrollment must not be attempted");
      return { data: true, error: null };
    },
    from: (table: string) => {
      let patch: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        single: async () => ({
          data: table === "properties" ? { id: "home", name: "Home" } : project,
          error: null,
        }),
        maybeSingle: async () => ({ data: { ...project, ...patch }, error: null }),
        update: (value: Record<string, unknown>) => {
          patch = value;
          updates.push({ table, patch: value });
          return query;
        },
        insert: async () => ({ data: null, error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
      };
      return query;
    },
  };

  const result = await updateProject(db as never, "lead", {
    projectId: "project",
    modules: ["active_owner"],
    possessionOn: "2026-09-22",
    plannedClosingOn: "2026-09-24",
    reason: "Recording the confirmed dates.",
  });

  expect(result.possession_on).toBe("2026-09-22");
  expect(result.enrollmentWarning).toBe(null);
  expect(rpcCalls).not.toContain("create_owner_program");
  // The home itself carries the dates the rest of Resolve paces work from.
  const home = updates.find((u) => u.table === "properties");
  expect(home?.patch["actual_access_on"]).toBe("2026-09-22");
  expect(home?.patch["planned_closing_on"]).toBe("2026-09-24");
});
