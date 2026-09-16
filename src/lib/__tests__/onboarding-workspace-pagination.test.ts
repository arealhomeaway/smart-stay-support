import { expect, it } from "bun:test";
import { loadOnboardingWorkspace } from "../onboarding.server";

function database(failedTable?: string) {
  const pageStarts: Record<string, number[]> = {};
  const rows = Array.from({ length: 1205 }, (_, index) => ({
    id: `row-${index}`,
    property_id: `row-${index}`,
    owner_record_id: `row-${index}`,
    archived_at: null,
    is_demo: false,
    project_id: `row-${index}`,
    program_id: `program-${index}`,
    name: "Same name",
    title: "Same title",
    status: "active",
    lifecycle_status: "onboarding",
    sort_order: 0,
    inclusion_status: "included",
    owner_programs: {
      id: `program-${index}`,
      status: "active",
      owner_user_id: "owner",
      owner_name: "Owner",
      owner_record_id: `row-${index}`,
      archived_at: null,
      is_demo: false,
    },
    new_value: JSON.stringify({ stage: "intake", revision: 1, status: "draft" }),
  }));
  const db = {
    rpc: async (name: string) => ({
      data:
        name === "read_onboarding_independent_readiness"
          ? []
          : name === "read_onboarding_review_capabilities"
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
            : true,
      error: null,
    }),
    from: (table: string) => {
      const orders: string[] = [];
      let filtered = rows;
      const query = {
        select: (_fields: string, options: { count?: string }) => {
          expect(options?.count).toBe("exact");
          return query;
        },
        eq: () => query,
        is: () => query,
        not: () => query,
        in: (field: string, values: string[]) => {
          if (field === "property_id" || field === "id")
            filtered = filtered.filter((row) => values.includes(row[field]));
          return query;
        },
        order: (field: string) => {
          orders.push(field);
          return query;
        },
        range: async (from: number, to: number) => {
          (pageStarts[table] ??= []).push(from);
          const key =
            table === "onboarding_stage_captures"
              ? ["project_id", "new_value"]
              : table === "owner_program_properties"
                ? ["program_id", "property_id"]
                : ["id"];
          expect(orders.slice(-key.length)).toEqual(key);
          return {
            data: filtered.slice(from, Math.min(to + 1, from + 200)),
            count: filtered.length,
            error: table === failedTable && from >= 200 ? new Error("Later page failed") : null,
          };
        },
      };
      return query;
    },
  };
  return { db, pageStarts };
}

it("loads complete workspace collections under a 200-row backend cap", async () => {
  const { db, pageStarts } = database();
  const workspace = await loadOnboardingWorkspace(db as never, "supervisor");
  for (const rows of [
    workspace.properties,
    workspace.tasks,
    workspace.projects,
    workspace.handoffs,
    workspace.people,
    workspace.notes,
    workspace.reviews,
    workspace.externalDatabases,
    workspace.externalRecords,
    workspace.documents,
    workspace.ownerApprovals,
    workspace.stageCaptures,
    workspace.activeOwnerProperties,
  ]) {
    expect(rows.length).toBe(1205);
  }
  for (const [table, starts] of Object.entries(pageStarts)) {
    if (table === "owner_program_properties" || table === "property_owners") {
      // Canonical membership and Owner checks are batched to 100 IDs.
      expect(starts).toEqual(Array(13).fill(0));
    } else if (table === "properties") {
      expect(starts).toEqual([0, 200, 400, 600, 800, 1000, 1200, ...Array(13).fill(0)]);
    } else {
      expect(starts).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
    }
  }
});

it("fails the workspace when a later supporting-record page fails", async () => {
  const { db } = database("onboarding_notes");
  const message = await loadOnboardingWorkspace(db as never, "supervisor").then(
    () => "allowed",
    (error: Error) => error.message,
  );
  expect(message).toBe("Later page failed");
});
