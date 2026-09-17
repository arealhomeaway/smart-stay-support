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
