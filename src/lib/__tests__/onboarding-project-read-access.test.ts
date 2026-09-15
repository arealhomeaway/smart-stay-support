import { expect, it } from "bun:test";
import { loadProjectsForActor, loadPropertyProjectForActor } from "../onboarding-project.server";

function fixture(staff = true, supervisor = false, failedCapability = false) {
  const reads: string[] = [];
  const projects = [
    {
      id: "p1",
      property_id: "home-a",
      project_manager: "lead",
      director: "director",
      status: "active",
    },
    {
      id: "p2",
      property_id: "home-b",
      project_manager: "other",
      director: "other-director",
      status: "active",
    },
  ];
  const db = {
    rpc: async (name: string) => ({
      data: name === "is_supervisor" ? supervisor : staff,
      error: failedCapability ? new Error("unavailable") : null,
    }),
    from: (table: string) => {
      let rows: Record<string, unknown>[] =
        table === "onboarding_projects"
          ? [...projects]
          : [{ id: "event", property_id: "home-a", detail: "private history" }];
      const query = {
        select: (columns: string) => {
          reads.push(`${table}:${columns}`);
          return query;
        },
        eq: (key: string, value: unknown) => {
          rows = rows.filter((r) => r[key] === value);
          return query;
        },
        neq: (key: string, value: unknown) => {
          rows = rows.filter((r) => r[key] !== value);
          return query;
        },
        or: (filter: string) => {
          rows = rows.filter((row) =>
            filter.split(",").some((term) => {
              const [key, , value] = term.split(".");
              return key !== undefined && row[key] === value;
            }),
          );
          return query;
        },
        order: () => query,
        range: async (from: number, to: number) => ({
          data: rows.slice(from, to + 1),
          count: rows.length,
          error: null,
        }),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        limit: async () => ({ data: rows, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    },
  };
  return { db, reads };
}

it("denies non-staff and failed capability checks before project reads", async () => {
  for (const f of [fixture(false), fixture(true, true, true)]) {
    for (const load of [
      () => loadProjectsForActor(f.db as never, "owner"),
      () => loadPropertyProjectForActor(f.db as never, "owner", "home-a"),
    ]) {
      let denied = false;
      try {
        await load();
      } catch {
        denied = true;
      }
      expect(denied).toBe(true);
    }
    expect(f.reads.length).toBe(0);
  }
});

it("prevents assigned-only or unrelated staff from reading unrestricted project/history", async () => {
  const f = fixture();
  let denied = false;
  try {
    await loadPropertyProjectForActor(f.db as never, "field-worker", "home-a");
  } catch {
    denied = true;
  }
  expect(denied).toBe(true);
  expect(f.reads).toEqual(["onboarding_projects:project_manager, director"]);
});

it("scopes project lists to PM/director responsibility while retaining supervisor portfolio access", async () => {
  for (const actor of ["lead", "director"]) {
    const rows = await loadProjectsForActor(fixture().db as never, actor);
    expect(rows.map((r) => r.id)).toEqual(["p1"]);
  }
  expect((await loadProjectsForActor(fixture().db as never, "field-worker")).length).toBe(0);
  expect((await loadProjectsForActor(fixture(true, true).db as never, "supervisor")).length).toBe(
    2,
  );
});

it("allows a responsible lead to read the selected property and its history", async () => {
  const result = await loadPropertyProjectForActor(fixture().db as never, "lead", "home-a");
  expect(result.project?.id).toBe("p1");
  expect(result.events.map((event) => event.id)).toEqual(["event"]);
});
