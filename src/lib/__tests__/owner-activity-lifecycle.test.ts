import { expect, it } from "bun:test";
import { loadProgramAggregate } from "../owner-participation.server";
import { loadPrograms } from "../owner-program.server";

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