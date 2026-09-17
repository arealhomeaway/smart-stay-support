import { expect, it } from "bun:test";
import { readAllRows } from "../read-all-rows";
import { loadProgramAggregate } from "../owner-participation.server";

it("reads beyond 1000 rows even when the backend cap is lower than the requested page", async () => {
  const rows = Array.from({ length: 1205 }, (_, id) => ({ id }));
  const offsets: number[] = [];
  const result = await readAllRows(async (from, to) => {
    offsets.push(from);
    return {
      data: rows.slice(from, Math.min(to + 1, from + 200)),
      count: rows.length,
      error: null,
    };
  });
  expect(result.data).toEqual(rows);
  expect(offsets).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
});

it("rejects changed counts, missing pages and later-page errors instead of returning partial totals", async () => {
  for (const failure of [
    { data: [{ id: 2 }], count: 3, error: null },
    { data: [], count: 2, error: null },
    { data: null, count: null, error: new Error("later page denied") },
  ]) {
    let calls = 0;
    const message = await readAllRows(async () =>
      ++calls === 1 ? { data: [{ id: 1 }], count: 2, error: null } : failure,
    ).then(
      () => "unexpected success",
      (error: Error) => error.message,
    );
    expect(message === "unexpected success").toBe(false);
    expect(calls).toBe(2);
  }
});

it("includes late corrections and all program-scoped property links in aggregate totals", async () => {
  const rows = Array.from({ length: 1205 }, (_, index) => ({
    id: `entry-${index}`,
    minutes: 1,
    activity: "Reviewed work",
    phase: "onboarding",
    entry_date: "2026-01-02",
    review_status: "approved",
    amends_entry_id: index === 1204 ? "entry-0" : null,
  }));
  const sources: Record<string, unknown[]> = {
    owner_program_properties: [
      {
        id: "enrollment",
        property_id: "home",
        inclusion_status: "included",
        properties: { name: "QA Home" },
      },
    ],
    owner_reviews: [{ id: "review", status: "answered" }],
    owner_review_properties: [{ review_id: "review", property_id: "home" }],
    owner_time_entries: rows,
    owner_time_entry_properties: rows.map((entry) => ({ entry_id: entry.id, property_id: "home" })),
    owner_badges: [],
  };
  const db = {
    from: (table: string) => {
      let fields = "";
      const filters: [string, unknown][] = [];
      const order: string[] = [];
      const query = {
        select: (value: string) => {
          fields = value;
          return query;
        },
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        order: (key: string) => {
          order.push(key);
          return query;
        },
        single: async () => ({
          data: { id: "program", status: "active", started_on: "2026-01-01" },
          error: null,
        }),
        range: async (from: number, to: number) => {
          const parent =
            table === "owner_review_properties"
              ? "owner_reviews"
              : table === "owner_time_entry_properties"
                ? "owner_time_entries"
                : null;
          expect(filters).toEqual([[parent ? `${parent}.program_id` : "program_id", "program"]]);
          if (parent) expect(fields).toContain(`${parent}!inner(program_id)`);
          expect(order.length).toBe(2);
          const all = sources[table]!;
          return {
            data: all.slice(from, Math.min(to + 1, from + 200)),
            count: all.length,
            error: null,
          };
        },
      };
      return query;
    },
  };
  const aggregate = await loadProgramAggregate(db as never, "program");
  expect(aggregate.entries.length).toBe(1205);
  expect(aggregate.reportedMinutes).toBe(1204);
  expect(aggregate.properties[0]?.directMinutes).toBe(1204);
  expect(aggregate.entries[1204]?.propertyIds).toEqual(["home"]);
  expect(aggregate.reviews[0]?.propertyIds).toEqual(["home"]);
  expect(aggregate.entries[0]?.superseded).toBe(true);
});
