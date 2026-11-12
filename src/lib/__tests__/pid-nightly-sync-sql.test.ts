// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * The nightly PID copy writes one home in one transaction (docs/pending/pid-nightly-sync, staged).
 * Runs the staged SQL in an isolated PostgreSQL; nothing touches the real database or Notion.
 */
const DIR = "docs/pending/pid-nightly-sync";
const SQL = readFileSync(`${DIR}/01_pid_nightly_sync.sql`, "utf8");
const UNDO = readFileSync(`${DIR}/undo/01_pid_nightly_sync.sql`, "utf8");

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA private; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TYPE public.app_role AS ENUM ('admin', 'manager');
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TYPE public.credential_category AS ENUM ('wifi','gate_community','property_access','garage','lockbox','streaming','supply_storage','alarm_security','other');
CREATE TABLE public.feature_flags(key text PRIMARY KEY, label text, description text, enabled boolean NOT NULL DEFAULT false);
CREATE TABLE public.integration_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system text, operation text, status text);
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text, is_demo boolean NOT NULL DEFAULT false, ownerrez_property_id text,
  nickname text, bedrooms int, year_built int, lifecycle_status text, systems jsonb, hoa jsonb, updated_at timestamptz DEFAULT now());
CREATE TABLE public.property_field_provenance(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, field_key text NOT NULL,
  value_source text NOT NULL, source_record_id text, as_of timestamptz NOT NULL DEFAULT now(), note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (property_id, field_key));
CREATE TABLE public.property_profile_edits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, item_key text, edited_at timestamptz DEFAULT now());
CREATE TABLE public.property_external_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, kind text NOT NULL, label text, url text NOT NULL,
  context text, staff_only boolean, canonical boolean, needs_replacement boolean, source text, source_field text, as_of timestamptz, note text, UNIQUE (property_id, kind, url));
CREATE TABLE public.property_credentials(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, category public.credential_category, label text NOT NULL,
  username text, secret_ciphertext text, secret_nonce text, instructions text, last_verified_on date, verified_by uuid, source text, sort_order int, active boolean DEFAULT true,
  created_by uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.credential_intake_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, source_field text NOT NULL,
  suggested_category public.credential_category, suggested_label text, secret_ciphertext text NOT NULL, secret_nonce text NOT NULL, status text DEFAULT 'pending',
  reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
`;
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";
const SNAP = "2026-11-13T08:00:00+00";

let pg: PGlite;
let run: string;
beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(STUBS + SQL);
  await pg.exec(`INSERT INTO public.properties(id, name, nickname, year_built, bedrooms, lifecycle_status, systems) VALUES
    ('${A}', 'Home A', 'Old A', NULL, 3, 'active_operations', '{"smoke":{"brand":"Kidde"}}'),
    ('${B}', 'Home B', 'Old B', NULL, 4, 'active_operations', NULL);
    INSERT INTO public.property_field_provenance(property_id, field_key, value_source, updated_at) VALUES
    ('${A}', 'nickname', 'notion_pid', '2026-09-01T12:00:00+00'), ('${B}', 'nickname', 'notion_pid', '2026-09-01T12:00:00+00');`);
  run = (await pg.query(`INSERT INTO public.integration_events(system, operation, status) VALUES ('notion_pid','nightly_sync','processing') RETURNING id`)).rows[0].id;
});

const prov = { value_source: "notion_pid", updated_at: "2026-09-01T12:00:00+00:00" };
const apply = (home: string, writes: any[], extra: Partial<Record<string, any>> = {}) =>
  pg.query(`SELECT public.pid_sync_apply_home($1, $2, 'page', '2026-11-13', $3, $4, $5, $6, $7, $8, $9) AS r`, [
    run, home, SNAP, JSON.stringify(writes), JSON.stringify(extra.links ?? []), JSON.stringify(extra.extras ?? []),
    JSON.stringify(extra.credentials ?? []), JSON.stringify(extra.intake ?? []), JSON.stringify(extra.review ?? []),
  ]);
const row = async (id: string) => (await pg.query(`SELECT nickname, year_built, bedrooms, systems FROM public.properties WHERE id = $1`, [id])).rows[0];
const count = async (sql: string) => Number((await pg.query(`SELECT count(*)::int n FROM ${sql}`)).rows[0].n);
const LINK = { kind: "system", url: "https://app.breezeway.io/property/1/profile", label: "BW Property Link", staff_only: true, canonical: true, needs_replacement: false, source_field: "BW Property Link", note: null };
const EXTRA = { field_name: "Base Price", field_type: "number", value: { type: "text", text: "189" }, as_of: "2026-11-11T10:00:00Z" };
const REVIEW = { home: "Home A", ownerrez_id: "1", field_key: "bedrooms", kind: "ownerrez", resolve_value: "3", notion_value: "4", reason: "OwnerRez wins" };

describe("one home, one transaction", () => {
  it("writes a home's values, source records, links, From the PID values and review list together", async () => {
    const r = await apply(A, [
      { path: ["nickname"], expected: "Old A", value: "New A", prov },
      { path: ["systems", "smoke", "expires_on"], expected: null, value: "2030-01-31", prov: null },
      { path: ["year_built"], expected: null, value: 2024, prov: null },
    ], { links: [LINK], extras: [EXTRA], review: [REVIEW] });
    expect(r.rows[0].r).toMatchObject({ written: 3, links: 1, extras: 1, review: 1 });
    expect(await row(A)).toMatchObject({ nickname: "New A", year_built: 2024, systems: { smoke: { brand: "Kidde", expires_on: "2030-01-31" } } });
    const p = (await pg.query(`SELECT field_key, value_source, as_of::date::text d, note FROM public.property_field_provenance WHERE property_id = $1 ORDER BY field_key`, [A])).rows;
    expect(p).toEqual([
      { field_key: "nickname", value_source: "notion_pid", d: "2026-11-13", note: "PID nightly 2026-11-13" },
      { field_key: "systems.smoke.expires_on", value_source: "notion_pid", d: "2026-11-13", note: "PID nightly 2026-11-13" },
      { field_key: "year_built", value_source: "notion_pid", d: "2026-11-13", note: "PID nightly 2026-11-13" },
    ]);
  });

  it("writes nothing for a home when one of its values changed since the run read it, and other homes still copy", async () => {
    await expect(apply(A, [
      { path: ["year_built"], expected: null, value: 2024, prov: null },
      { path: ["nickname"], expected: "Something else", value: "New A", prov },
    ], { links: [LINK], extras: [EXTRA], review: [REVIEW] })).rejects.toThrow("nickname changed since the run read it");
    expect(await row(A)).toMatchObject({ nickname: "Old A", year_built: null });
    expect(await count(`public.property_field_provenance WHERE property_id = '${A}' AND field_key = 'year_built'`)).toBe(0);
    expect(await count("public.property_external_links")).toBe(0);
    expect(await count("public.property_pid_extra_fields")).toBe(0);
    expect(await count("public.pid_sync_review_items")).toBe(0);
    await apply(B, [{ path: ["nickname"], expected: "Old B", value: "New B", prov }]);
    expect((await row(B)).nickname).toBe("New B");
  });

  it("refuses the home when it was edited in Resolve during the run", async () => {
    await pg.exec(`INSERT INTO public.property_profile_edits(property_id, item_key, edited_at) VALUES ('${A}', 'tier', '2026-11-13T08:01:00+00')`);
    await expect(apply(A, [{ path: ["nickname"], expected: "Old A", value: "New A", prov }])).rejects.toThrow("edited in Resolve during the run");
    expect((await row(A)).nickname).toBe("Old A");
  });

  it("refuses when the source record changed", async () => {
    await pg.exec(`UPDATE public.property_field_provenance SET value_source = 'staff_entry' WHERE property_id = '${A}'`);
    await expect(apply(A, [{ path: ["nickname"], expected: "Old A", value: "New A", prov }])).rejects.toThrow("source changed");
    expect((await row(A)).nickname).toBe("Old A");
  });

  it("never writes an OwnerRez or identity field", async () => {
    await expect(apply(A, [{ path: ["bedrooms"], expected: 3, value: 4, prov: null }])).rejects.toThrow("may not be written");
    await expect(apply(A, [{ path: ["name"], expected: "Home A", value: "X", prov: null }])).rejects.toThrow("may not be written");
    expect(await row(A)).toMatchObject({ bedrooms: 3 });
  });
});

describe("a value changed in Resolve after a copy is never overwritten", () => {
  it("is listed by pid_sync_changed_since_copy and its write is refused", async () => {
    await apply(A, [{ path: ["nickname"], expected: "Old A", value: "New A", prov }]);
    expect((await pg.query(`SELECT * FROM public.pid_sync_changed_since_copy()`)).rows).toEqual([]);
    const after = (await pg.query(`SELECT updated_at::text u FROM public.property_field_provenance WHERE property_id = $1 AND field_key = 'nickname'`, [A])).rows[0].u;
    await pg.exec(`UPDATE public.properties SET nickname = 'Typed in Resolve' WHERE id = '${A}'`);
    expect((await pg.query(`SELECT * FROM public.pid_sync_changed_since_copy()`)).rows).toEqual([{ property_id: A, field_key: "nickname" }]);
    await expect(apply(A, [{ path: ["nickname"], expected: "Typed in Resolve", value: "Newer A", prov: { value_source: "notion_pid", updated_at: after } }])).rejects.toThrow("was changed in Resolve");
    expect((await row(A)).nickname).toBe("Typed in Resolve");
  });
});

describe("codes go only to the vault", () => {
  it("files a new code once, sends code-like text to the intake list once, and keeps both encrypted", async () => {
    const cred = { op: "insert", pid_field: "Gate Code", category: "gate_community", label: "Gate / community code", username: null, instructions: null, ciphertext: "CIPHER", nonce: "N", last_verified_on: "2026-11-11" };
    const intake = { source_field: "PID: HOA Notes", category: "gate_community", label: "Possible code in HOA Notes", ciphertext: "C2", nonce: "N2", fingerprint: "f1" };
    await apply(A, [], { credentials: [cred], intake: [intake] });
    expect(await count(`public.property_credentials WHERE source = 'notion_pid' AND secret_ciphertext = 'CIPHER'`)).toBe(1);
    expect(await count(`public.credential_intake_queue WHERE status = 'pending'`)).toBe(1);
    await apply(A, [], { intake: [intake] });
    expect(await count("public.credential_intake_queue")).toBe(1);
    await expect(apply(A, [], { credentials: [cred] })).rejects.toThrow("Gate Code code changed");
  });

  it("does not overwrite a code saved in Resolve", async () => {
    const id = (await pg.query(`INSERT INTO public.property_credentials(property_id, category, label, secret_ciphertext, secret_nonce, source) VALUES ($1, 'gate_community', 'Gate / community code', 'X', 'Y', 'staff_entry') RETURNING id, updated_at::text u`, [A])).rows[0];
    await expect(apply(A, [], { credentials: [{ op: "update", id: id.id, expected_updated_at: id.u, pid_field: "Gate Code", ciphertext: "Z", nonce: "W" }] })).rejects.toThrow("changed since the run read it");
    expect((await pg.query(`SELECT secret_ciphertext s FROM public.property_credentials WHERE id = $1`, [id.id])).rows[0].s).toBe("X");
  });
});

describe("staged files", () => {
  it("adds the switch OFF, and the undo removes everything it added", async () => {
    expect((await pg.query(`SELECT enabled FROM public.feature_flags WHERE key = 'pid_nightly_sync'`)).rows).toEqual([{ enabled: false }]);
    await pg.exec(UNDO);
    expect(await count(`public.feature_flags WHERE key = 'pid_nightly_sync'`)).toBe(0);
    const left = (await pg.query(`SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname LIKE 'pid_sync%' OR c.relname = 'property_pid_extra_fields'`)).rows[0].n;
    expect(left).toBe(0);
    expect((await pg.query(`SELECT count(*)::int n FROM pg_proc WHERE proname LIKE 'pid_%'`)).rows[0].n).toBe(0);
  });
});
