// @ts-nocheck: in-memory fixture, row shapes are checked by assertions.
// The OwnerRez owner sync end to end against an in-memory database and fake OwnerRez answers.
import { describe, expect, it, mock } from "bun:test";

let listings: unknown[] = [];
let owners: unknown[] = [];
const real = await import("@/lib/property-enrichment.server");
mock.module("@/lib/property-enrichment.server", () => ({ ...real, listDetailedListings: async () => listings }));
mock.module("@/lib/owner-directory.server", () => ({ listOwnerRezOwners: async () => owners }));
const { runPropertyEnrichment } = await import("@/lib/property-enrichment-run.server");

type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>) {
  let n = 0;
  const get = (row: Row, col: string) => col.split(".").reduce<unknown>((v, k) => (v as Row | undefined)?.[k], row);
  function q(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" | "update" | "insert" | "upsert"; payload?: unknown; onConflict?: string } = { kind: "select" };
    const rows = () => (tables[table] ??= []);
    const join = (r: Row) => (table === "owner_program_properties" ? { ...r, owner_programs: tables.owner_programs!.find((p) => p.id === r.program_id) } : r);
    const run = () => {
      if (op.kind === "insert") { for (const p of [op.payload].flat() as Row[]) rows().push({ id: `new${++n}`, status: "open", ...p }); return { data: null, error: null }; }
      if (op.kind === "upsert") {
        const keys = op.onConflict!.split(",");
        for (const p of op.payload as Row[]) {
          const hit = rows().find((r) => keys.every((k) => r[k] === p[k]));
          if (hit) Object.assign(hit, p); else rows().push({ id: `new${++n}`, ...p });
        }
        return { data: null, error: null };
      }
      const hits = rows().filter((r) => filters.every((f) => f(join(r))));
      if (op.kind === "update") { for (const h of hits) Object.assign(h, op.payload); return { data: null, error: null }; }
      return { data: hits.map(join), error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (c: string, v: unknown) => (filters.push((r) => get(r, c) === v), b),
      is: (c: string, v: unknown) => (filters.push((r) => (get(r, c) ?? null) === v), b),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(get(r, c))), b),
      update: (p: unknown) => ((op = { kind: "update", payload: p }), b),
      insert: (p: unknown) => ((op = { kind: "insert", payload: p }), b),
      upsert: (p: unknown, o: { onConflict: string }) => ((op = { kind: "upsert", payload: p, onConflict: o.onConflict }), b),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  }
  return { from: q, tables };
}

const listing = (id: number, owner_id: number) => ({ id, name: `L${id}`, owner_id, bedrooms: 3, thumbnail_url_large: "https://x/p.jpg" });
const owner = (id: number, name: string) => ({ id, name, email_address: `${id}@example.com`, active: true });

function seed() {
  return fakeDb({
    properties: [
      { id: "fern", name: "3400 N Fern Avenue", ownerrez_property_id: "1", latitude: 1, longitude: 1, is_demo: false, archived_at: null, owner_record_id: "keep" },
      { id: "other", name: "A home with no program", ownerrez_property_id: "2", latitude: 1, longitude: 1, is_demo: false, archived_at: null, owner_record_id: null },
    ],
    property_owners: [{ id: "keep", source: "ownerrez", source_owner_id: "ownerrez:150924525", name: "Rachel Ramsey" }],
    owner_programs: [{ id: "prog", owner_record_id: "keep", archived_at: null, is_demo: false }],
    owner_program_properties: [{ property_id: "fern", program_id: "prog", inclusion_status: "included", archived_at: null, is_demo: false }],
    property_field_provenance: [],
    field_conflicts: [],
  });
}

describe("OwnerRez owner sync", () => {
  it("matches an older ownerrez: record instead of making a second one, and writes the bare id", async () => {
    const db = seed();
    listings = [listing(1, 150924525), listing(2, 150924525)];
    owners = [owner(150924525, "Mike & Rachel Ramsey")];
    const r = await runPropertyEnrichment(db as never);
    expect(r.ok).toBe(true);
    expect(db.tables.property_owners).toHaveLength(1);
    expect(db.tables.property_owners![0]).toMatchObject({ id: "keep", source_owner_id: "150924525" });
    expect(db.tables.properties!.map((p) => p.owner_record_id)).toEqual(["keep", "keep"]);
  });

  it("keeps a program home on its owner record when OwnerRez names someone else, and flags it once", async () => {
    const db = seed();
    listings = [listing(1, 150999999), listing(2, 150999999)];
    owners = [owner(150999999, "New Buyer")];
    await runPropertyEnrichment(db as never);
    const fern = db.tables.properties!.find((p) => p.id === "fern")!;
    expect(fern.owner_record_id).toBe("keep");
    expect(fern.ownerrez_owner_id).toBeUndefined();
    expect(db.tables.properties!.find((p) => p.id === "other")!.owner_record_id).not.toBe("keep");
    expect(db.tables.field_conflicts).toHaveLength(1);
    expect(db.tables.field_conflicts![0]).toMatchObject({ entity_id: "fern", system: "ownerrez", field_key: "owner_record_id", resolve_value: "Rachel Ramsey", status: "open" });
    expect(db.tables.property_field_provenance!.some((p) => p.property_id === "fern" && p.field_key === "owner_record_id")).toBe(false);
    await runPropertyEnrichment(db as never);
    expect(db.tables.field_conflicts).toHaveLength(1);
  });

  it("links nothing while two records share one OwnerRez owner", async () => {
    const db = seed();
    db.tables.property_owners!.push({ id: "dup", source: "ownerrez", source_owner_id: "150924525" });
    db.tables.properties![1]!.owner_record_id = null;
    listings = [listing(1, 150924525), listing(2, 150924525)];
    owners = [owner(150924525, "Mike & Rachel Ramsey")];
    const r = await runPropertyEnrichment(db as never);
    expect(db.tables.property_owners).toHaveLength(2);
    expect(db.tables.properties![1]!.owner_record_id).toBeNull();
    expect(r.conflicts?.some((c) => c.detail.includes("Two owner records"))).toBe(true);
  });
});
