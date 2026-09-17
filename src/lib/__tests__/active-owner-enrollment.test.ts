import { expect, it } from "bun:test";
import { activeOwnerFor } from "../active-owner.server";

function fixture(
  changes: Record<string, unknown> = {},
  programChanges: Record<string, unknown> = {},
  homeChanges: Record<string, unknown> = {},
  duplicate = false,
) {
  const enrollment = {
    property_id: "home",
    program_id: "program",
    inclusion_status: "included",
    archived_at: null,
    is_demo: false,
    owner_programs: {
      id: "program",
      owner_record_id: "canonical",
      owner_user_id: "account",
      owner_name: "WRONG LEGACY NAME",
      status: "active",
      archived_at: null,
      is_demo: false,
      ...programChanges,
    },
    ...changes,
  };
  const sources: Record<string, unknown[]> = {
    owner_program_properties: duplicate
      ? [enrollment, { ...enrollment, program_id: "duplicate" }]
      : [enrollment],
    properties: [
      {
        id: "home",
        owner_record_id: "canonical",
        archived_at: null,
        is_demo: false,
        ...homeChanges,
      },
    ],
    property_owners: [{ id: "canonical", name: "Canonical Owner" }],
  };
  return {
    from(table: string) {
      if (table === "owner_programs")
        throw new Error("No legacy single-Property membership fallback");
      const q = {
        select: () => q,
        in: () => q,
        eq: () => q,
        order: () => q,
        range: async () => ({
          data: sources[table],
          count: sources[table]?.length ?? 0,
          error: null,
        }),
      };
      return q;
    },
  };
}
it("derives staff participation context from explicit canonical enrollment and Owner name", async () => {
  expect(await activeOwnerFor(fixture() as never, "home")).toEqual({
    propertyId: "home",
    programId: "program",
    ownerUserId: "account",
    ownerName: "Canonical Owner",
    programStatus: "active",
  });
});
it("rejects removed, archived, transferred and mixed-demo relationships without fallback", async () => {
  for (const db of [
    fixture({ inclusion_status: "removed" }),
    fixture({ archived_at: "2026-01-01" }),
    fixture({}, { archived_at: "2026-01-01" }),
    fixture({}, { status: "completed" }),
    fixture({}, { owner_record_id: "previous-owner" }),
    fixture({}, {}, { archived_at: "2026-01-01" }),
    fixture({}, {}, { is_demo: true }),
    fixture({ is_demo: true }),
  ]) {
    expect(await activeOwnerFor(db as never, "home")).toBe(null);
  }
});
it("requires reconciliation instead of choosing among duplicate canonical enrollments", async () => {
  await expect(activeOwnerFor(fixture({}, {}, {}, true) as never, "home")).rejects.toThrow(
    "conflicting canonical",
  );
});
