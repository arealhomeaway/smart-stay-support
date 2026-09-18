import { describe, expect, it } from "bun:test";
import { loadJobMap } from "@/lib/geo.server";

type Row = Record<string, unknown>;

function fixtureDb(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = tables[table] ?? [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
        is: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
        not: (key: string, operator: string, value: unknown) => {
          if (operator === "is") rows = rows.filter((row) => row[key] !== value);
          return query;
        },
        in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return query; },
        then: (resolve: (value: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null }),
      };
      return query;
    },
  };
}

describe("read-only map population", () => {
  it("excludes demo, archived, inactive, invalid-coordinate and closed work", async () => {
    const property = (id: string, extra: Row = {}) => ({
      id, name: id, formatted_address: "123 Main", address_line1: "123 Main", city: "Dallas",
      state: "TX", market: "Dallas", postal_code: "75201", latitude: 32.7, longitude: -96.8,
      active: true, is_demo: false, archived_at: null, ...extra,
    });
    const ticket = (id: string, extra: Row = {}) => ({
      id, ref: 1, title: id, priority: "p3", status: "open", due_at: null,
      property_id: "live", vendor_name: null, vendor_status: null,
      is_demo: false, archived_at: null, ...extra,
    });
    const db = fixtureDb({
      properties: [property("live"), property("missing", { longitude: null }),
        property("invalid", { latitude: 95 }), property("demo", { is_demo: true }),
        property("archived", { archived_at: "2026-09-18" }), property("inactive", { active: false })],
      tickets: [ticket("active"), ticket("closed", { status: "closed" }),
        ticket("demo", { is_demo: true }), ticket("archived", { archived_at: "2026-09-18" })],
    });
    const result = await loadJobMap(db as never);
    expect(result.pins.map((pin) => pin.propertyId)).toEqual(["live"]);
    expect(result.pins[0]?.openJobs.map((job) => job.id)).toEqual(["active"]);
    expect(result.unpinned).toBe(2);
    expect(result.exceptions.map((row) => [row.propertyId, row.reason])).toEqual([
      ["missing", "Missing coordinates"], ["invalid", "Invalid coordinates"],
    ]);
  });
});
