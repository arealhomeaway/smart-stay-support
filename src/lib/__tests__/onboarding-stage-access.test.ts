import { expect, it } from "bun:test";
import { loadStageCapturesForActor, saveStageCapture } from "../onboarding-stage.server";
import type { StageCapture } from "../onboarding-stage";

const input = {
  propertyId: "home-a",
  stage: "phase1_inspection",
  expectedRevision: 0,
  action: "submit" as const,
  observation: "Inspection findings recorded",
  evidenceIds: [] as string[],
  reason: "",
};

const submitted: StageCapture = {
  stage: input.stage,
  revision: 1,
  status: "awaiting_review",
  observation: "Original inspection findings",
  evidenceIds: [],
  reason: "",
  actor: "lead",
  recordedAt: "2026-09-16T10:00:00Z",
};

function fixture(
  options: {
    staff?: boolean;
    supervisor?: boolean;
    capabilityError?: string;
    director?: string;
    capture?: StageCapture;
  } = {},
) {
  const reads: string[] = [];
  const writes: { name: string; args: Record<string, unknown> }[] = [];
  const project = {
    id: "project-a",
    property_id: "home-a",
    project_manager: "lead",
    director: options.director ?? "director",
    status: "active",
    modules: [],
    furnishing_scope: "full_furnishing",
  };
  const tables: Record<string, Record<string, unknown>[]> = {
    onboarding_projects: [
      project,
      { ...project, id: "project-b", property_id: "home-b", project_manager: "other-lead" },
    ],
    properties: [{ id: "home-a", lifecycle_status: "onboarding", handoff_accepted_at: null }],
    onboarding_tasks: [],
    property_fact_proposals: [],
    documents: [],
    onboarding_project_events: options.capture
      ? [
          {
            id: "capture",
            project_id: "project-a",
            kind: `stage_capture:${input.stage}`,
            new_value: JSON.stringify(options.capture),
          },
        ]
      : [],
  };
  const db = {
    rpc: async (name: string) => ({
      data: name === "is_supervisor" ? Boolean(options.supervisor) : options.staff !== false,
      error: options.capabilityError === name ? new Error("Capability unavailable") : null,
    }),
    from: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const query = {
        select: (columns: string) => {
          reads.push(`${table}:${columns}`);
          return query;
        },
        eq: (key: string, value: unknown) => {
          rows = rows.filter((row) => row[key] === value);
          return query;
        },
        neq: (key: string, value: unknown) => {
          rows = rows.filter((row) => row[key] !== value);
          return query;
        },
        is: (key: string, value: unknown) => {
          rows = rows.filter((row) => (row[key] ?? null) === value);
          return query;
        },
        in: () => query,
        like: () => query,
        order: () => query,
        single: async () => ({ data: rows[0] ?? null, error: null }),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    },
  };
  const writer = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      writes.push({ name, args });
      return { data: null, error: null };
    },
  };
  return { db, writer, reads, writes };
}

async function message(action: Promise<unknown>) {
  return action.then(
    () => "allowed",
    (error: Error) => error.message,
  );
}

it("rejects non-staff and unverifiable capabilities before stage context is read", async () => {
  for (const options of [
    { staff: false },
    { capabilityError: "is_onboarding_staff" },
    { supervisor: true, capabilityError: "is_supervisor" },
  ]) {
    const f = fixture(options);
    expect(
      await message(saveStageCapture(f.db as never, "actor", input, f.writer as never)),
    ).not.toBe("allowed");
    expect(await message(loadStageCapturesForActor(f.db as never, "actor", "home-a"))).not.toBe(
      "allowed",
    );
    expect(f.reads.length).toBe(0);
    expect(f.writes.length).toBe(0);
  }
});

it("denies unrelated staff, field workers and another property's PM before private stage reads or writes", async () => {
  for (const actor of ["unrelated", "field-worker", "other-lead"]) {
    for (const action of ["save", "submit"] as const) {
      const f = fixture();
      expect(
        await message(
          saveStageCapture(f.db as never, actor, { ...input, action }, f.writer as never),
        ),
      ).toContain("not assigned");
      expect(f.reads).toEqual(["onboarding_projects:project_manager, director"]);
      expect(f.writes.length).toBe(0);
    }
    const f = fixture({ capture: submitted });
    expect(await message(loadStageCapturesForActor(f.db as never, actor, "home-a"))).toContain(
      "not assigned",
    );
    expect(f.reads).toEqual(["onboarding_projects:project_manager, director"]);
  }
});

it("allows the property's PM, Director and supervisor to save and submit through the atomic writer", async () => {
  for (const actor of ["lead", "director", "supervisor"]) {
    for (const action of ["save", "submit"] as const) {
      const f = fixture({ supervisor: actor === "supervisor" });
      const capture = await saveStageCapture(
        f.db as never,
        actor,
        { ...input, action },
        f.writer as never,
      );
      expect(capture.status).toBe(action === "save" ? "draft" : "awaiting_review");
      expect(capture.actor).toBe(actor);
      expect(f.writes.length).toBe(1);
      expect(f.writes[0]?.name).toBe("record_onboarding_stage_capture");
      expect(f.writes[0]?.args["_project_id"]).toBe("project-a");
      expect(f.writes[0]?.args["_actor"]).toBe(actor);
      expect(f.writes[0]?.args["_capture"]).toEqual(capture);
    }
    const f = fixture({ supervisor: actor === "supervisor", capture: submitted });
    const captures = await loadStageCapturesForActor(f.db as never, actor, "home-a");
    expect(captures).toEqual([{ id: "capture", ...submitted }]);
  }
});

it("property execution responsibility alone cannot approve, return or reopen a stage", async () => {
  for (const action of ["approve", "return", "reopen"] as const) {
    const f = fixture({
      capture: { ...submitted, status: action === "reopen" ? "complete" : "awaiting_review" },
    });
    expect(
      await message(
        saveStageCapture(
          f.db as never,
          "lead",
          {
            ...input,
            action,
            expectedRevision: 1,
            reason: "Review requested",
          },
          f.writer as never,
        ),
      ),
    ).toContain("Director or supervisor");
    expect(f.writes.length).toBe(0);
  }
});

it("keeps the Director review action when the Director also serves as PM", async () => {
  for (const actor of ["director", "supervisor", "lead"]) {
    const f = fixture({
      supervisor: actor === "supervisor",
      director: actor === "lead" ? "lead" : "director",
      capture: submitted,
    });
    const capture = await saveStageCapture(
      f.db as never,
      actor,
      {
        ...input,
        action: "approve",
        expectedRevision: 1,
        observation: "Must not replace submitted findings",
      },
      f.writer as never,
    );
    expect(capture.status).toBe("complete");
    expect(capture.revision).toBe(2);
    expect(capture.observation).toBe(submitted.observation);
    expect(f.writes.length).toBe(1);
  }
});
