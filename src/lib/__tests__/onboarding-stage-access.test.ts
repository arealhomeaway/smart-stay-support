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
    reviewer?: boolean;
    admin?: boolean;
    ops?: boolean;
    capabilityError?: string;
    director?: string;
    capture?: StageCapture;
    evidence?: Record<string, unknown>;
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
    is_demo: false,
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
    documents: options.evidence ? [options.evidence] : [],
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
      data:
        name === "read_onboarding_review_capabilities"
          ? options.staff === false
            ? []
            : [
                {
                  is_admin: Boolean(options.admin),
                  can_review_stages: Boolean(options.reviewer || options.admin),
                  kati_review: Boolean(options.reviewer || options.admin),
                  micah_review: Boolean(options.ops || options.admin),
                  operations_acceptance: Boolean(options.admin),
                  live_confirmation: Boolean(options.admin),
                },
              ]
          : name === "is_supervisor"
            ? Boolean(options.supervisor)
            : options.staff !== false,
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
    { capabilityError: "read_onboarding_review_capabilities" },
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
  for (const actor of ["unrelated", "field-worker", "other-lead", "director", "supervisor"]) {
    for (const action of ["save", "submit"] as const) {
      const f = fixture();
      expect(
        await message(
          saveStageCapture(f.db as never, actor, { ...input, action }, f.writer as never),
        ),
      ).toContain("not assigned");
      expect(f.reads).toEqual(["onboarding_projects:id, project_manager, status"]);
      expect(f.writes.length).toBe(0);
    }
    const f = fixture({ capture: submitted });
    expect(await message(loadStageCapturesForActor(f.db as never, actor, "home-a"))).toContain(
      "not assigned",
    );
    expect(f.reads).toEqual(["onboarding_projects:id, project_manager, status"]);
  }
});

it("allows the current PM and administrator recovery to save and submit through the atomic writer", async () => {
  for (const actor of ["lead", "admin"]) {
    for (const action of ["save", "submit"] as const) {
      const f = fixture({ admin: actor === "admin" });
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
    const f = fixture({ admin: actor === "admin", capture: submitted });
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
    ).toContain("Director of Onboarding");
    expect(f.writes.length).toBe(0);
  }
});

it("keeps the Director review action when the Director also serves as PM", async () => {
  for (const actor of ["director", "admin", "lead"]) {
    const f = fixture({
      admin: actor === "admin",
      reviewer: actor !== "admin",
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

it("gives the protected Operations reviewer read access without PM stage execution or Director review", async () => {
  const f = fixture({ ops: true, capture: submitted });
  expect((await loadStageCapturesForActor(f.db as never, "ops", "home-a")).length).toBe(1);
  expect(await message(saveStageCapture(f.db as never, "ops", input, f.writer as never))).toContain(
    "not assigned",
  );
  expect(
    await message(
      saveStageCapture(
        f.db as never,
        "ops",
        { ...input, action: "approve", expectedRevision: 1 },
        f.writer as never,
      ),
    ),
  ).toContain("Director of Onboarding");
  expect(f.writes.length).toBe(0);
});

it("accepts only usable evidence in the project mode and preserves correction access to old receipts", async () => {
  const stored = {
    id: "evidence",
    entity_type: "property",
    entity_id: "home-a",
    archived_at: null,
    deleted_at: null,
    is_demo: false,
    upload_status: "stored",
    storage_path: "property/evidence.pdf",
    external_url: null,
  };
  for (const patch of [
    { deleted_at: "2026-09-16" },
    { upload_status: "pending" },
    { upload_status: "failed" },
    { is_demo: true },
    { storage_path: null },
  ]) {
    const f = fixture({ evidence: { ...stored, ...patch } });
    expect(
      await message(
        saveStageCapture(
          f.db as never,
          "lead",
          { ...input, evidenceIds: ["evidence"] },
          f.writer as never,
        ),
      ),
    ).toContain("Evidence must be stored");
    expect(f.writes.length).toBe(0);
  }
  for (const evidence of [
    stored,
    { ...stored, storage_path: null, external_url: "https://example.test/evidence" },
  ]) {
    const f = fixture({ evidence });
    expect(
      await message(
        saveStageCapture(
          f.db as never,
          "lead",
          { ...input, evidenceIds: ["evidence"] },
          f.writer as never,
        ),
      ),
    ).toBe("allowed");
    expect(f.writes.length).toBe(1);
  }
  const old = fixture({
    reviewer: true,
    capture: { ...submitted, evidenceIds: ["evidence"] },
    evidence: { ...stored, deleted_at: "2026-09-16" },
  });
  const result = await saveStageCapture(
    old.db as never,
    "reviewer",
    {
      ...input,
      action: "return",
      expectedRevision: 1,
      reason: "Replace missing evidence",
      evidenceIds: ["evidence"],
    },
    old.writer as never,
  );
  expect(result.evidenceIds).toEqual(["evidence"]);
  expect(result.status).toBe("correction_required");
});
