import { describe, expect, it } from "bun:test";
import { runNightlyExportStep, withRetry, type SharePointIo } from "@/lib/nightly-export.server";
import { EXPORT_PART_ROWS } from "@/lib/nightly-export";

/**
 * The nightly export step against a stand-in database and a stand-in SharePoint. Nothing here
 * reaches the real database, SharePoint or anyone's mailbox.
 */
type Row = Record<string, any>;

function fakeDb(tables: Record<string, Row[]>, files: { bucket: string; name: string; size: number; etag: string; body: string }[]) {
  const data: Record<string, Row[]> = {
    backup_runs: [],
    backup_file_copies: [],
    app_settings: [],
    ...Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v])),
  };
  const rpcCalls: { fn: string; args: Row }[] = [];
  let seq = 0;
  class Q {
    private filters: ((r: Row) => boolean)[] = [];
    private op: "select" | "insert" | "update" | "upsert" = "select";
    private payload: Row | Row[] | null = null;
    private one: "single" | "maybe" | null = null;
    private returning = false;
    private lim: number | null = null;
    private from_: number | null = null;
    private to_: number | null = null;
    private orderBy: { c: string; asc: boolean } | null = null;
    constructor(private t: string) {}
    select() {
      if (this.op !== "select") this.returning = true;
      return this;
    }
    insert(p: Row) {
      this.op = "insert";
      this.payload = p;
      return this;
    }
    update(p: Row) {
      this.op = "update";
      this.payload = p;
      return this;
    }
    upsert(p: Row) {
      this.op = "upsert";
      this.payload = p;
      return this;
    }
    eq(c: string, v: unknown) {
      this.filters.push((r) => r[c] === v);
      return this;
    }
    not(c: string, _op: string, _v: null) {
      this.filters.push((r) => r[c] !== null && r[c] !== undefined);
      return this;
    }
    is(c: string, _v: null) {
      this.filters.push((r) => r[c] === null || r[c] === undefined);
      return this;
    }
    or(expr: string) {
      const at = expr.split("lease_until.lt.")[1]!;
      this.filters.push((r) => !r["lease_until"] || r["lease_until"] < at);
      return this;
    }
    order(c: string, o: { ascending: boolean }) {
      this.orderBy = { c, asc: o.ascending };
      return this;
    }
    limit(n: number) {
      this.lim = n;
      return this;
    }
    range(a: number, b: number) {
      this.from_ = a;
      this.to_ = b;
      return this;
    }
    single() {
      this.one = "single";
      return this;
    }
    maybeSingle() {
      this.one = "maybe";
      return this;
    }
    then(resolve: (v: { data: any; error: any }) => void) {
      resolve(this.run());
    }
    private run() {
      const rows = (data[this.t] ??= []);
      if (this.op === "insert") {
        const r: Row = { id: `run-${++seq}`, started_at: new Date().toISOString(), lease_until: null, folder_item_id: null, pruned_at: null, ...(this.payload as Row) };
        if (this.t === "backup_runs" && rows.some((x) => x["kind"] === r["kind"] && x["folder_name"] === r["folder_name"] && x["phase"]))
          return { data: null, error: { message: "duplicate" } };
        rows.push(r);
        return { data: this.one ? r : [r], error: null };
      }
      if (this.op === "upsert") {
        const p = this.payload as Row;
        const i = rows.findIndex((x) => x["bucket"] === p["bucket"] && x["name"] === p["name"]);
        if (i >= 0) rows[i] = p;
        else rows.push(p);
        return { data: null, error: null };
      }
      let hit = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") {
        for (const r of hit) Object.assign(r, structuredClone(this.payload));
        return { data: this.returning ? hit.map((r) => ({ id: r["id"] })) : null, error: null };
      }
      if (this.orderBy) {
        const { c, asc } = this.orderBy;
        hit = [...hit].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
      }
      if (this.from_ !== null) hit = hit.slice(this.from_, (this.to_ ?? hit.length) + 1);
      if (this.lim !== null) hit = hit.slice(0, this.lim);
      hit = structuredClone(hit);
      if (this.one) return { data: hit[0] ?? null, error: null };
      return { data: hit, error: null };
    }
  }
  const sourceTables = () => Object.keys(tables);
  const rpcResult = async (fn: string, args: Row = {}): Promise<{ data: any; error: any }> => {
    rpcCalls.push({ fn, args });
    if (fn === "backup_list_tables")
      return { data: sourceTables().map((t) => ({ table_name: t, row_count: data[t]!.length, withheld_columns: [] })), error: null };
    if (fn === "backup_read_table") {
      const rows = data[args["_table"] as string] ?? [];
      return { data: rows.slice(args["_offset"] as number, (args["_offset"] as number) + (args["_limit"] as number)), error: null };
    }
    if (fn === "backup_list_files")
      return {
        data: files.map((f) => ({ bucket: f.bucket, name: f.name, size: f.size, etag: f.etag, mimetype: "text/plain", updated_at: null, owner_type: "folder", owner_id: null, owner_label: "x" })),
        error: null,
      };
    if (fn === "nightly_export_alert") return { data: 2, error: null };
    return { data: null, error: { message: `unknown ${fn}` } };
  };
  // Like the data service: a read returns at most 1,000 rows, and a range read returns that slice.
  const LIMIT = 1000;
  const rpc = (fn: string, args: Row = {}) => {
    const p = rpcResult(fn, args);
    const cap = (r: { data: any; error: any }, a = 0, b = LIMIT - 1) =>
      Array.isArray(r.data) ? { ...r, data: r.data.slice(a, Math.min(b + 1, a + LIMIT)) } : r;
    return {
      then: (res: (v: { data: any; error: any }) => void, rej?: (e: unknown) => void) => p.then((r) => res(cap(r)), rej),
      range: (a: number, b: number) => p.then((r) => cap(r, a, b)),
    };
  };
  const db = {
    from: (t: string) => new Q(t),
    rpc,
    storage: {
      from: (bucket: string) => ({
        download: async (name: string) => {
          const f = files.find((x) => x.bucket === bucket && x.name === name);
          return f ? { data: new Blob([f.body]), error: null } : { data: null, error: { message: "missing" } };
        },
        createSignedUrl: async () => ({ data: null, error: { message: "not used" } }),
      }),
    },
  };
  return { db, data, rpcCalls };
}

function fakeSharePoint(opts: { failManifest?: boolean; tamperManifest?: boolean } = {}) {
  const store = new Map<string, Uint8Array>();
  const removed: string[] = [];
  const io: SharePointIo = {
    root: async () => ({ driveId: "d", rootId: "root" }),
    ensureFolder: async (_d, parent, name) => `${parent}/${name}`,
    put: async (_d, folder, rel, bytes) => {
      if (opts.failManifest && rel === "manifest.json") throw new Error("SharePoint PUT failed [503]: busy");
      store.set(`${folder}/${rel}`, bytes);
      return bytes.byteLength;
    },
    putLarge: async () => {
      throw new Error("not used");
    },
    readText: async (_d, folder, rel) => {
      const b = store.get(`${folder}/${rel}`);
      if (!b) return null;
      const t = new TextDecoder().decode(b);
      return opts.tamperManifest ? t.replace('"folder"', '"folder" ') : t;
    },
    listSizes: async (_d, folder) => {
      const out: Record<string, number> = {};
      for (const [k, v] of store) {
        if (!k.startsWith(`${folder}/`)) continue;
        const rest = k.slice(folder.length + 1);
        if (!rest.includes("/")) out[rest] = v.byteLength;
      }
      return out;
    },
    remove: async (_d, id) => {
      removed.push(id);
    },
  };
  return { io, store, removed };
}

const rows = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${String(i).padStart(6, "0")}` }));
const NIGHT = new Date("2026-11-11T08:05:00Z"); // Wednesday 2:05 AM Central
const BACKUP_SOURCES = ["tickets", "ticket_activity", "work_orders", "claims", "guest_recovery", "guest_recovery_ledger", "expenses", "onboarding_tasks"];

function setup() {
  const tables: Record<string, Row[]> = { big_events: rows(EXPORT_PART_ROWS * 2 + 10, "e"), notes: rows(3, "n") };
  for (const t of BACKUP_SOURCES) tables[t] = t === "guest_recovery_ledger" ? [{ recovery_id: "r1" }] : rows(2, t);
  const files = [
    { bucket: "resolve-attachments", name: "ticket/1/a.jpg", size: 5, etag: "e1", body: "aaaaa" },
    { bucket: "resolve-attachments", name: "ticket/1/b.jpg", size: 3, etag: "e1", body: "bbb" },
    { bucket: "backups", name: "2026-11-09/manifest.json", size: 2, etag: "x", body: "{}" },
  ];
  return { ...fakeDb(tables, files), files };
}

async function runUntilDone(db: any, io: SharePointIo, opts: Parameters<typeof runNightlyExportStep>[1] = {}) {
  let last: Awaited<ReturnType<typeof runNightlyExportStep>> | null = null;
  for (let i = 0; i < 10; i++) {
    last = await runNightlyExportStep(db, { now: NIGHT, ...opts }, io);
    if ("skipped" in last || !last.ok || last.phase === "done") break;
  }
  return last!;
}

describe("SharePoint busy answers", () => {
  it("tries a busy answer again and stops at the first real answer", async () => {
    const answers = [503, 429, 200];
    const waits: number[] = [];
    const res = await withRetry(async () => new Response(null, { status: answers.shift()! }), async (ms) => void waits.push(ms));
    expect(res.status).toBe(200);
    expect(waits).toEqual([2000, 4000]);
  });

  it("never repeats a refusal such as not found, and gives up after four busy answers", async () => {
    let calls = 0;
    expect((await withRetry(async () => (calls++, new Response(null, { status: 404 })), async () => {})).status).toBe(404);
    expect(calls).toBe(1);
    calls = 0;
    expect((await withRetry(async () => (calls++, new Response(null, { status: 503 })), async () => {})).status).toBe(503);
    expect(calls).toBe(4);
  });
});

describe("nightly export run (stand-ins only)", () => {
  it("exports every table, the spreadsheets, the inventory and new files, then passes its check", async () => {
    const { db, data, rpcCalls } = setup();
    const sp = fakeSharePoint();
    const r = await runUntilDone(db, sp.io);
    expect(r.ok).toBe(true);
    const run = data["backup_runs"]![0]!;
    expect(run["phase"]).toBe("done");
    expect(run["verify_status"]).toBe("passed");
    expect(run["status"]).toBe("succeeded");
    expect(run["table_count"]).toBe(10);
    expect(run["total_rows"]).toBe(EXPORT_PART_ROWS * 2 + 10 + 3 + 7 * 2 + 1);
    // The large table is in three parts; every table is in the tables folder.
    const keys = [...sp.store.keys()];
    expect(keys.filter((k) => k.includes("big_events.part-")).length).toBe(3);
    expect(keys.some((k) => k.endsWith("/tables/notes.json"))).toBe(true);
    for (const f of ["tickets.csv", "files-inventory.csv", "manifest.json"]) expect(keys.some((k) => k.endsWith(`/2026-11-11/${f}`))).toBe(true);
    // Stored files: the two attachments copied, the backups store listed but not copied.
    expect(run["files_inventoried"]).toBe(3);
    expect(run["files_copied"]).toBe(2);
    expect(keys.some((k) => k.endsWith("/files/resolve-attachments/ticket/1/a.jpg"))).toBe(true);
    expect(keys.some((k) => k.includes("/files/backups/"))).toBe(false);
    expect(data["backup_file_copies"]).toHaveLength(2);
    expect(rpcCalls.some((c) => c.fn === "nightly_export_alert")).toBe(false);
    // A second call the same night does nothing.
    const again = await runNightlyExportStep(db as never, { now: NIGHT }, sp.io);
    expect("skipped" in again && again.skipped).toContain("already done");
  });

  it("lists and copies every stored file when there are more than 1,000", async () => {
    const { db, data, files } = setup();
    for (let i = 0; i < 1203; i++) files.push({ bucket: "resolve-attachments", name: `property/p/${i}.jpg`, size: 1, etag: "e", body: "x" });
    const sp = fakeSharePoint();
    await runUntilDone(db, sp.io, { kind: "test", forceWeekly: true, folderName: "TEST export many files" });
    const run = data["backup_runs"]![0]!;
    expect(run["files_inventoried"]).toBe(1206);
    expect(run["files_copied"]).toBe(1205);
    expect(run["verify_status"]).toBe("passed");
  });

  it("copies only new or changed stored files on the next night", async () => {
    const { db, data, files } = setup();
    const sp = fakeSharePoint();
    await runUntilDone(db, sp.io);
    files[1]!.etag = "e2";
    const next = new Date("2026-11-12T08:05:00Z");
    const sp2 = fakeSharePoint();
    for (let i = 0; i < 10; i++) {
      const r = await runNightlyExportStep(db as never, { now: next }, sp2.io);
      if ("skipped" in r || !r.ok || r.phase === "done") break;
    }
    const run2 = data["backup_runs"]!.find((r) => r["folder_name"] === "2026-11-12")!;
    expect(run2["files_copied"]).toBe(1);
    expect([...sp2.store.keys()].some((k) => k.endsWith("ticket/1/b.jpg"))).toBe(true);
    expect([...sp2.store.keys()].some((k) => k.endsWith("ticket/1/a.jpg"))).toBe(false);
  });

  it("alerts the Admin and the Director of Operations when the check fails", async () => {
    const { db, data, rpcCalls } = setup();
    const r = await runUntilDone(db, fakeSharePoint({ tamperManifest: true }).io);
    expect(r.ok).toBe(true);
    const run = data["backup_runs"]![0]!;
    expect(run["verify_status"]).toBe("failed");
    expect(run["status"]).toBe("failed");
    const alerts = rpcCalls.filter((c) => c.fn === "nightly_export_alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.args["_folder"]).toBe("2026-11-11");
    expect(alerts[0]!.args["_reason"]).toBe("failed");
  });

  it("gives up after three failed calls in a row, records Failed and alerts once", async () => {
    const { db, data, rpcCalls } = setup();
    const io = fakeSharePoint({ failManifest: true }).io;
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await runNightlyExportStep(db as never, { now: NIGHT }, io));
    expect(results.filter((r) => !r.ok)).toHaveLength(3);
    const run = data["backup_runs"]![0]!;
    expect(run["status"]).toBe("failed");
    expect(run["verify_status"]).toBe("failed");
    expect(rpcCalls.filter((c) => c.fn === "nightly_export_alert")).toHaveLength(1);
  });

  it("a test run uses its own folder, never alerts, never prunes and never marks files as copied", async () => {
    const { db, data, rpcCalls } = setup();
    const sp = fakeSharePoint({ tamperManifest: true });
    await runUntilDone(db, sp.io, { kind: "test", forceWeekly: true, folderName: "TEST export 2026-11-11_0805Z" });
    const run = data["backup_runs"]![0]!;
    expect(run["kind"]).toBe("test");
    expect(String(run["sharepoint_path"])).toContain("TEST export");
    expect(data["backup_file_copies"]).toHaveLength(0);
    expect(rpcCalls.some((c) => c.fn === "nightly_export_alert")).toBe(false);
    expect(sp.removed).toHaveLength(0);
  });

  it("the forced failure check alerts from a test run when asked to", async () => {
    const { db, rpcCalls } = setup();
    await runUntilDone(db, fakeSharePoint({ tamperManifest: true }).io, { kind: "test", alertOnFailure: true, folderName: "TEST export forced" });
    expect(rpcCalls.filter((c) => c.fn === "nightly_export_alert").map((c) => c.args["_reason"])).toEqual(["failed"]);
  });

  it("removes nightly folders beyond 30, never the one it just wrote", async () => {
    const { db, data } = setup();
    for (let i = 0; i < 35; i++) {
      const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
      data["backup_runs"]!.push({ id: `old-${i}`, kind: "nightly", folder_name: d, folder_item_id: `item-${d}`, pruned_at: null, weekly: false, phase: null, status: "succeeded", started_at: `${d}T08:00:00Z` });
    }
    const sp = fakeSharePoint();
    await runUntilDone(db, sp.io);
    // 35 old folders plus tonight's: the 6 oldest go.
    expect(sp.removed).toHaveLength(6);
    expect(sp.removed[0]).toBe("item-2026-10-01");
    expect(sp.removed.some((id) => id.includes("2026-11-11"))).toBe(false);
  });
});
