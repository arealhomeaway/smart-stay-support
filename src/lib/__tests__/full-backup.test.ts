import { describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  buildManifest,
  compareBackup,
  fullBackupFolder,
  recentVerifiedBackup,
  sha256Hex,
  tableFileText,
} from "../full-backup";

/** Back up everything (Emily, Nov 7, 2026; register N8). */
const read = (p: string) => readFileSync(p, "utf8");
const SQL = read("docs/pending/full-backup/01_full_backups.sql");
const UNDO = read("docs/pending/full-backup/01_undo_full_backups.sql");

async function db() {
  const d = new PGlite();
  await d.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text);
    CREATE TABLE public.user_roles (user_id uuid, role text);
    CREATE FUNCTION public.has_role(_u uuid, _r text) RETURNS boolean LANGUAGE sql AS
      'SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role = _r)';
    CREATE TABLE public.property_credentials (id int PRIMARY KEY, label text, username text, secret_ciphertext text, secret_nonce text);
    CREATE TABLE public.integration_tokens (provider text PRIMARY KEY, access_token_enc text, refresh_token_enc text, last_error text);
    CREATE TABLE public.app_user_connections (id int PRIMARY KEY, connection_key_ciphertext text, connected_identity text);
    CREATE TABLE public.no_key (a int, b text);
    CREATE TABLE public.composite (x int, y int, v text, PRIMARY KEY (y, x));
    INSERT INTO public.property_credentials SELECT g, 'Door ' || g, 'guest', 'cipher' || g, 'nonce' || g FROM generate_series(1, 2500) g;
    INSERT INTO public.integration_tokens VALUES ('breezeway', 'enc-a', 'enc-r', NULL);
    INSERT INTO public.app_user_connections VALUES (1, 'enc-key', 'resolve.integration');
    INSERT INTO public.no_key VALUES (2, 'b'), (1, 'z'), (1, 'a');
    INSERT INTO public.composite VALUES (2, 1, 'c'), (1, 2, 'b'), (1, 1, 'a');
  `);
  await d.exec(SQL);
  return d;
}
const page = async (d: PGlite, t: string, off = 0, lim = 1000) =>
  (await d.query<{ j: unknown[] }>("SELECT public.backup_read_table($1, $2, $3) j", [t, off, lim])).rows[0]!.j;

describe("the backup reads every table, with secrets left out", () => {
  it("lists every public table with its exact row count, including the new record table", async () => {
    const d = await db();
    const r = await d.query<{ table_name: string; row_count: number; withheld_columns: string[] }>("SELECT * FROM public.backup_list_tables()");
    const by = Object.fromEntries(r.rows.map((x) => [x.table_name, x]));
    expect(Object.keys(by).sort()).toEqual(
      ["app_user_connections", "composite", "full_backups", "integration_tokens", "no_key", "profiles", "property_credentials", "user_roles"],
    );
    expect(Number(by.property_credentials!.row_count)).toBe(2500);
    expect(by.property_credentials!.withheld_columns).toEqual(["secret_ciphertext", "secret_nonce"]);
    expect(by.integration_tokens!.withheld_columns).toEqual(["access_token_enc", "refresh_token_enc"]);
    expect(by.app_user_connections!.withheld_columns).toEqual(["connection_key_ciphertext"]);
    expect(by.no_key!.withheld_columns).toEqual([]);
  });

  it("never returns a secret value, and keeps every other column", async () => {
    const d = await db();
    const creds = (await page(d, "property_credentials", 0, 2)) as Record<string, unknown>[];
    expect(creds).toEqual([{ id: 1, label: "Door 1", username: "guest" }, { id: 2, label: "Door 2", username: "guest" }]);
    expect(JSON.stringify(await page(d, "integration_tokens"))).not.toContain("enc-");
    expect(JSON.stringify(await page(d, "app_user_connections"))).not.toContain("enc-key");
  });

  it("pages in a stable order: the primary key, else the whole row", async () => {
    const d = await db();
    const all: { id: number }[] = [];
    for (let off = 0; ; off += 1000) {
      const p = (await page(d, "property_credentials", off)) as { id: number }[];
      all.push(...p);
      if (p.length < 1000) break;
    }
    expect(all.length).toBe(2500);
    expect(new Set(all.map((r) => r.id)).size).toBe(2500);
    expect(all[0]!.id).toBe(1);
    expect(all[2499]!.id).toBe(2500);
    expect(await page(d, "composite")).toEqual([{ x: 1, y: 1, v: "a" }, { x: 2, y: 1, v: "c" }, { x: 1, y: 2, v: "b" }]);
    expect(await page(d, "no_key")).toEqual([{ a: 1, b: "a" }, { a: 1, b: "z" }, { a: 2, b: "b" }]);
  });

  it("refuses anything that is not a public table, and bad pages", async () => {
    const d = await db();
    await expect(page(d, "pg_class")).rejects.toThrow("Not a table in the public schema");
    await expect(page(d, "no_key; DROP TABLE public.no_key")).rejects.toThrow("Not a table");
    await expect(page(d, "no_key", 0, 9999)).rejects.toThrow("Bad page");
  });

  it("only the server's service role may call the readers; Admins can read the records", () => {
    for (const f of ["backup_secret_column(text)", "backup_list_tables()", "backup_read_table(text, integer, integer)"]) {
      expect(SQL).toContain(`REVOKE ALL ON FUNCTION public.${f} FROM PUBLIC, anon, authenticated;`);
      expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION public.${f} TO service_role;`);
    }
    expect(SQL).toContain("USING (public.has_role(auth.uid(), 'admin'))");
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*TO authenticated/);
  });

  it("undo removes everything it added", async () => {
    const d = await db();
    await d.exec(UNDO);
    const left = await d.query("SELECT 1 FROM pg_proc WHERE proname LIKE 'backup_%' UNION ALL SELECT 1 FROM pg_class WHERE relname = 'full_backups'");
    expect(left.rows.length).toBe(0);
  });
});

describe("files, manifest and Verify", () => {
  it("one dated folder per backup, in UTC", () => {
    expect(fullBackupFolder(new Date("2026-11-08T21:40:05Z"))).toBe("2026-11-08_214005Z");
  });

  it("the manifest lists every table with its rows and fingerprint, and the totals", async () => {
    const text = tableFileText("a", "2026-11-08T21:40:05Z", [{ id: 1 }], []);
    const m = buildManifest("f", "2026-11-08T21:40:05Z", "u", [
      { table: "b", rows: 2, sha256: "x", bytes: 1, withheld_columns: [] },
      { table: "a", rows: 1, sha256: await sha256Hex(text), bytes: text.length, withheld_columns: [] },
    ]);
    expect(m.tables.map((t) => t.table)).toEqual(["a", "b"]);
    expect([m.table_count, m.total_rows]).toEqual([2, 3]);
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  const m = buildManifest("f", "t", "u", [
    { table: "a", rows: 2, sha256: "s-a", bytes: 1, withheld_columns: [] },
    { table: "b", rows: 5, sha256: "s-b", bytes: 1, withheld_columns: [] },
  ]);
  it("files that match are fine, even when the live table has grown since", () => {
    const r = compareBackup(m, { a: { rows: 2, sha256: "s-a" }, b: { rows: 5, sha256: "s-b" } }, { a: 2, b: 7, c: 1 });
    expect(r.ok).toBe(true);
    expect(r.lines.map((l) => l.state)).toEqual(["ok", "changed"]);
    expect(r.newTables).toEqual(["c"]);
  });
  it("a missing file, a wrong count or a changed fingerprint fails the check", () => {
    expect(compareBackup(m, { a: null, b: { rows: 5, sha256: "s-b" } }, { a: 2, b: 5 }).broken).toBe(1);
    expect(compareBackup(m, { a: { rows: 1, sha256: "s-a" }, b: { rows: 5, sha256: "s-b" } }, { a: 2, b: 5 }).ok).toBe(false);
    expect(compareBackup(m, { a: { rows: 2, sha256: "zz" }, b: { rows: 5, sha256: "s-b" } }, { a: 2, b: 5 }).ok).toBe(false);
  });

  it("the clean slate needs a finished, verified backup from the last 2 hours", () => {
    const now = new Date("2026-11-08T22:00:00Z");
    const ok = { status: "succeeded" as const, finished_at: "2026-11-08T20:00:00Z", verify_ok: true };
    expect(recentVerifiedBackup([ok], now)).toBe(true);
    expect(recentVerifiedBackup([{ ...ok, finished_at: "2026-11-08T19:59:59Z" }], now)).toBe(false);
    expect(recentVerifiedBackup([{ ...ok, verify_ok: null }], now)).toBe(false);
    expect(recentVerifiedBackup([{ ...ok, status: "failed" }], now)).toBe(false);
  });
});

describe("Back up everything is Admin only", () => {
  const fns = read("src/lib/full-backup.functions.ts");
  it("every server step checks Admin before anything else", () => {
    const handlers = fns.split(".handler(async").slice(1);
    expect(handlers.length).toBe(3);
    for (const h of handlers) expect(h.indexOf("await requireAdmin(")).toBeLessThan(h.indexOf("supabaseAdmin") === -1 ? Infinity : h.indexOf("supabaseAdmin"));
    expect(fns).toContain('_role: "admin"');
  });
  it("the panel shows only for Admins, on the Admin tools page", () => {
    expect(read("src/components/FullBackupPanel.tsx")).toContain("if (!isAdmin) return null;");
    expect(read("src/routes/_authenticated/integrations.tsx")).toContain("<FullBackupPanel />");
  });
});
