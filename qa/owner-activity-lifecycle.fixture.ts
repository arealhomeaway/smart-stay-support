import { expect, it } from "bun:test";
import { loadProgramAggregate } from "../src/lib/owner-participation.server";
import { loadPrograms } from "../src/lib/owner-program.server";
import { unretiredOwnerWork } from "../src/lib/owner-activity-queries";

function client() {
  const sources: Record<string, Record<string, unknown>[]> = {
    owner_programs: [{ id: "p", status: "active", is_demo: false, archived_at: null, canonical_owner: { name: "Owner" } }],
    owner_reviews: [
      { id: "live", program_id: "p", status: "awaiting_owner", archived_at: null },
      { id: "withdrawn", program_id: "p", status: "awaiting_owner", archived_at: "2026-10-29" },
    ],
  };
  return { from: (table: string) => {
    let rows = sources[table] ?? [];
    const q = {
      select: () => q, order: () => q, limit: () => q,
      eq: (key: string, value: unknown) => { rows = rows.filter(r => r[key] === value); return q; },
      is: (key: string, value: unknown) => { rows = rows.filter(r => (r[key] ?? null) === value); return q; },
      single: async () => ({ data: rows[0], error: null }),
      range: async (start: number, end: number) => ({ data: rows.slice(start, end + 1), count: rows.length, error: null }),
      then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return q;
  } };
}

it("staff program activities exclude the withdrawn October 29 review", async () => {
  const agg = await loadProgramAggregate(client() as never, "p");
  expect(agg.reviews.map(r => r.id)).toEqual(["live"]);
});
it("program queue does not count archived reviews as waiting homeowner work", async () => {
  const result = await loadPrograms(client() as never);
  expect(result.rows[0]?.openTasks).toBe(1);
});

it("retired work items never appear in current staff or homeowner activity lists", () => {
  const rows = [{ id: "live", retired_at: null }, { id: "retired", retired_at: "2026-10-27" }];
  const actual = unretiredOwnerWork({ is: (column, value) => rows.filter(row => row[column as "retired_at"] === value) });
  expect(actual.map(row => row.id)).toEqual(["live"]);
});