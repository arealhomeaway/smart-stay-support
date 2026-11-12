// @ts-nocheck: a fake database client; shapes are checked by assertions.
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { runNightlyPidSync } from "@/lib/pid-sync/run.server";

/**
 * The nightly runner end to end with a fake database and a fake Notion (nothing real is called):
 * off means nothing happens; each home goes to the database in its own call; a home that fails
 * leaves the others copied and shows on the run; Notion unreachable writes nothing.
 */
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";
const NIGHT = new Date("2026-11-13T08:05:00Z"); // 2:05 AM Central

const rt = (s: string) => ({ type: "rich_text", rich_text: s ? [{ plain_text: s }] : [] });
const pidPage = (id: string, or: string, nick: string, gate = "") => ({
  id, last_edited_time: "2026-11-12T10:00:00.000Z",
  properties: { Property: { type: "title", title: [{ plain_text: `Home ${or}` }] }, "OwnerRez Internal ID": rt(`ORP${or}`), "Property Nickname": rt(nick), "Gate Code": rt(gate), "Base Price": { type: "number", number: 189 } },
});

function fakeDb(tables: Record<string, any[]>, rpc: (name: string, args: any) => { data?: any; error?: any }) {
  const calls = { rpc: [] as any[], inserts: [] as any[], updates: [] as any[] };
  const builder = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let op: "select" | "insert" | "update" = "select";
    let payload: any;
    const b: any = {
      select: () => b, order: () => b, not: () => b, range: (a: number, z: number) => { rows = rows.slice(a, z + 1); return b; },
      eq: (k: string, v: any) => { if (op === "select") rows = rows.filter((r) => r[k] === undefined || r[k] === v); return b; },
      limit: (n: number) => { rows = rows.slice(0, n); return b; },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: op === "insert" ? { id: "run-1" } : rows[0], error: null }),
      insert: (p: any) => { op = "insert"; payload = p; calls.inserts.push({ table, p }); if (table === "integration_events") tables[table].unshift({ id: "run-1", ...p, created_at: NIGHT.toISOString() }); return b; },
      update: (p: any) => { op = "update"; payload = p; calls.updates.push({ table, p }); return b; },
      then: (res: any, rej: any) => Promise.resolve({ data: op === "select" ? rows : null, error: null }).then(res, rej),
    };
    return b;
  };
  return {
    calls,
    from: builder,
    rpc: (name: string, args: any) => {
      if (name === "pid_sync_apply_home") { calls.rpc.push(args); return Promise.resolve(rpc(name, args)); }
      const res = { data: [], error: null };
      const p: any = Promise.resolve(res);
      p.range = () => Promise.resolve(res);
      return p;
    },
  };
}

const baseTables = () => ({
  feature_flags: [{ key: "pid_nightly_sync", enabled: true }],
  integration_events: [] as any[],
  properties: [
    { id: A, name: "Home A", ownerrez_property_id: "500001", is_demo: false, nickname: "Old A" },
    { id: B, name: "Home B", ownerrez_property_id: "500002", is_demo: false, nickname: "Old B" },
  ],
  property_field_provenance: [
    { property_id: A, field_key: "nickname", value_source: "notion_pid", as_of: "2026-09-01T12:00:00+00:00", updated_at: "2026-09-01T12:00:00+00:00" },
    { property_id: B, field_key: "nickname", value_source: "notion_pid", as_of: "2026-09-01T12:00:00+00:00", updated_at: "2026-09-01T12:00:00+00:00" },
  ],
  property_profile_edits: [], property_fact_proposals: [], property_external_links: [], property_pid_extra_fields: [], property_credentials: [],
});

let realFetch: typeof fetch;
let notionUp = true;
beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env["LOVABLE_API_KEY"] = "test"; process.env["NOTION_API_KEY"] = "test";
  process.env["CREDENTIAL_ENCRYPTION_KEY"] = "test-key-for-isolated-run";
  notionUp = true;
  globalThis.fetch = (async (url: string) => {
    if (!notionUp) return new Response("bad gateway", { status: 400 });
    if (String(url).endsWith("/query")) return Response.json({ results: [pidPage("p1", "500001", "New A", "#4821"), pidPage("p2", "500002", "New B")], has_more: false, next_cursor: null });
    return Response.json({ properties: {} });
  }) as never;
});
afterEach(() => { globalThis.fetch = realFetch; });

describe("nightly PID runner", () => {
  it("does nothing while the switch is off", async () => {
    const t = baseTables(); t.feature_flags[0].enabled = false;
    const db = fakeDb(t, () => ({ data: {} }));
    expect(await runNightlyPidSync(db, NIGHT)).toEqual({ skipped: "off" });
    expect(db.calls.rpc).toHaveLength(0);
    expect(db.calls.inserts).toHaveLength(0);
  });

  it("does nothing outside the 2 AM Central hour", async () => {
    const db = fakeDb(baseTables(), () => ({ data: {} }));
    expect(await runNightlyPidSync(db, new Date("2026-11-13T15:00:00Z"))).toEqual({ skipped: true });
    expect(db.calls.rpc).toHaveLength(0);
  });

  it("sends each home in its own call with the values it expects; a failing home leaves the others copied", async () => {
    const db = fakeDb(baseTables(), (_n, args) => args._property_id === A
      ? { error: { message: "PID copy: nickname changed since the run read it" } }
      : { data: { written: 1, links: 0, extras: 1, codes: 0, intake: 0, review: 0 } });
    const r = await runNightlyPidSync(db, NIGHT);
    expect(db.calls.rpc.map((c) => c._property_id)).toEqual([A, B]);
    const a = db.calls.rpc[0];
    expect(a._writes).toEqual([{ path: ["nickname"], expected: "Old A", value: "New A", prov: { value_source: "notion_pid", updated_at: "2026-09-01T12:00:00+00:00" }, kind: "update" }]);
    // The gate code goes only to the vault, encrypted, never in values or the review list.
    expect(a._credentials).toHaveLength(1);
    expect(a._credentials[0]).toMatchObject({ op: "insert", pid_field: "Gate Code", label: "Gate / community code" });
    expect(JSON.stringify({ w: a._writes, e: a._extras, r: a._review })).not.toContain("4821");
    expect(a._credentials[0].ciphertext).not.toContain("4821");
    expect(a._extras).toContainEqual({ field_name: "Base Price", field_type: "number", value: { type: "text", text: "189" }, as_of: "2026-11-12T10:00:00.000Z" });
    expect(a._extras.some((x) => x.field_name === "Gate Code")).toBe(false);
    expect(r).toMatchObject({ completed: true, counts: { errors: 1, updates: 1, homes_touched: 1 } });
    const errRow = db.calls.inserts.find((i) => i.table === "pid_sync_review_items");
    expect(errRow.p).toMatchObject({ property_id: A, kind: "error" });
    const final = db.calls.updates.at(-1).p;
    expect(final.status).toBe("completed");
    expect(final.error_message).toBe("1 home could not be copied; see the review list.");
  });

  it("writes nothing when Notion cannot be reached and records the error", async () => {
    notionUp = false;
    const db = fakeDb(baseTables(), () => ({ data: {} }));
    const r = await runNightlyPidSync(db, NIGHT);
    expect(db.calls.rpc).toHaveLength(0);
    expect(r.failed).toContain("Notion could not be reached; nothing was copied.");
    expect(db.calls.updates.at(-1).p).toMatchObject({ status: "failed" });
  });
});
