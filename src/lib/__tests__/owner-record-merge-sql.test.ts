// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
// Practice copy of docs/pending/owner-record-merge/apply.sql (Admin, Nov 16). Nothing here touches the real database.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const APPLY = readFileSync("docs/pending/owner-record-merge/apply.sql", "utf8");
const UNDO = readFileSync("docs/pending/owner-record-merge/apply.undo.sql", "utf8");
const NANCY_KEEP = "2ec04185-6b03-4204-8680-b3e8897b23d5", NANCY_OLD = "7ee766c6-05a7-48b9-9fcd-20b2f588cb8c";
const RAMSEY_KEEP = "056a57f2-959f-41f8-8ff5-4eac7c0bac9b", RAMSEY_OLD = "41497378-4717-4d44-bde3-b6f559fcf72a";
const ADRIEL_KEEP = "55757b31-7995-4725-a2d7-429af790a87b", ADRIEL_OLD = "a9372065-2230-40d4-aa6e-8221b8e07cb3";
const FERN = "00000000-0000-4000-8000-00000000f001", STRAY = "00000000-0000-4000-8000-00000000f002";

const SCHEMA = `
CREATE TABLE public.property_owners(id uuid PRIMARY KEY, source text NOT NULL DEFAULT 'ownerrez', source_owner_id text NOT NULL,
  name text, active boolean NOT NULL DEFAULT true, notes text, UNIQUE(source, source_owner_id));
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text, owner_record_id uuid REFERENCES public.property_owners(id));
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_record_id uuid REFERENCES public.property_owners(id));
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_recipient_id uuid REFERENCES public.property_owners(id));
CREATE TABLE public.document_recipient_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid);
CREATE TABLE public.owner_approval_publications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_record_id uuid);
CREATE TABLE public.owner_invite_redemptions(owner_record_id uuid);
CREATE TABLE public.ticket_owner_updates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_record_id uuid);
CREATE TABLE public.property_owner_team_note_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid);
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text, entity_type text,
  entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz DEFAULT clock_timestamp());
INSERT INTO public.property_owners(id, source_owner_id, name) VALUES
  ('${NANCY_OLD}', 'ownerrez:150925118', null), ('${NANCY_KEEP}', '150925118', 'Nancy DeLeon'),
  ('${RAMSEY_KEEP}', 'ownerrez:150924525', 'Rachel Ramsey'), ('${RAMSEY_OLD}', '150924525', 'Mike & Rachel Ramsey'),
  ('${ADRIEL_OLD}', 'ownerrez:150923799', 'Adriel Properties, LLC'), ('${ADRIEL_KEEP}', '150923799', 'Adriel Properties, LLC (Niles & Dana Syska)'),
  (gen_random_uuid(), '150900001', 'Someone else');
INSERT INTO public.properties VALUES ('${FERN}', '3400 N Fern Ave', '${RAMSEY_KEEP}'), ('${STRAY}', 'A second Ramsey home', '${RAMSEY_OLD}');
INSERT INTO public.owner_programs(owner_record_id) VALUES ('${RAMSEY_KEEP}'), ('${ADRIEL_KEEP}');
INSERT INTO public.documents(owner_recipient_id) VALUES ('${RAMSEY_KEEP}'), ('${RAMSEY_OLD}');
`;

let db: PGlite;
const rows = async (sql: string) => (await db.query(sql)).rows;
const one = async (sql: string) => (await rows(sql))[0];
const fail = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return (e as Error).message; } };

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
});

describe("Merging the three duplicate OwnerRez owner records", () => {
  it("keeps the record already in use and retires the other, for all three pairs", async () => {
    await db.exec(APPLY);
    const r = await rows(`SELECT id, source_owner_id, active FROM public.property_owners ORDER BY source_owner_id`);
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(by[NANCY_KEEP]).toMatchObject({ source_owner_id: "150925118", active: true });
    expect(by[RAMSEY_KEEP]).toMatchObject({ source_owner_id: "150924525", active: true });
    expect(by[ADRIEL_KEEP]).toMatchObject({ source_owner_id: "150923799", active: true });
    expect(by[NANCY_OLD]).toMatchObject({ source_owner_id: "merged:ownerrez:150925118", active: false });
    expect(by[RAMSEY_OLD]).toMatchObject({ source_owner_id: "merged:150924525", active: false });
    expect(by[ADRIEL_OLD]).toMatchObject({ source_owner_id: "merged:ownerrez:150923799", active: false });
  });

  it("points homes and documents that used the retired record at the kept one", async () => {
    await db.exec(APPLY);
    expect((await one(`SELECT owner_record_id FROM public.properties WHERE id = '${STRAY}'`)).owner_record_id).toBe(RAMSEY_KEEP);
    expect((await one(`SELECT owner_record_id FROM public.properties WHERE id = '${FERN}'`)).owner_record_id).toBe(RAMSEY_KEEP);
    expect((await one(`SELECT count(*)::int n FROM public.documents WHERE owner_recipient_id = '${RAMSEY_OLD}'`)).n).toBe(0);
  });

  it("writes one audit row per merge", async () => {
    await db.exec(APPLY);
    expect((await one(`SELECT count(*)::int n FROM public.audit_log WHERE action = 'owner_record_merged'`)).n).toBe(3);
  });

  it("refuses to run when a record to retire is used by a program, and changes nothing", async () => {
    await db.exec(`INSERT INTO public.owner_programs(owner_record_id) VALUES ('${NANCY_OLD}')`);
    expect(await fail(db.exec(APPLY))).toContain("used by a program or by history");
    expect((await one(`SELECT count(*)::int n FROM public.property_owners WHERE active = false`)).n).toBe(0);
  });

  it("refuses to run when a record to retire has recipient history", async () => {
    await db.exec(`INSERT INTO public.document_recipient_events(owner_id) VALUES ('${ADRIEL_OLD}')`);
    expect(await fail(db.exec(APPLY))).toContain("used by a program or by history");
  });

  it("blocks a second record for the same OwnerRez owner in either format", async () => {
    await db.exec(APPLY);
    expect(await fail(db.exec(`INSERT INTO public.property_owners(id, source_owner_id) VALUES (gen_random_uuid(), 'ownerrez:150924525')`))).toContain("property_owners_one_per_ownerrez_owner");
    expect(await fail(db.exec(`INSERT INTO public.property_owners(id, source_owner_id) VALUES (gen_random_uuid(), '150925118')`))).not.toBeNull();
    await db.exec(`INSERT INTO public.property_owners(id, source, source_owner_id) VALUES (gen_random_uuid(), 'manual', '150924525')`);
  });

  it("undo restores every record, home and document exactly", async () => {
    const before = await rows(`SELECT id, source_owner_id, active, notes FROM public.property_owners ORDER BY id`);
    const homes = await rows(`SELECT id, owner_record_id FROM public.properties ORDER BY id`);
    const docs = await rows(`SELECT id, owner_recipient_id FROM public.documents ORDER BY id`);
    await db.exec(APPLY);
    await db.exec(UNDO);
    expect(await rows(`SELECT id, source_owner_id, active, notes FROM public.property_owners ORDER BY id`)).toEqual(before);
    expect(await rows(`SELECT id, owner_record_id FROM public.properties ORDER BY id`)).toEqual(homes);
    expect(await rows(`SELECT id, owner_recipient_id FROM public.documents ORDER BY id`)).toEqual(docs);
    expect((await one(`SELECT count(*)::int n FROM public.audit_log WHERE action = 'owner_record_merge_undone'`)).n).toBe(1);
  });
});
