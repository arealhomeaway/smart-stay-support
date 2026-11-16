// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
// Practice copy of docs/pending/portal-card-edit/apply.sql (Admin, Nov 16, allowed change A). Nothing here touches the real database.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const APPLY = readFileSync("docs/pending/portal-card-edit/apply.sql", "utf8");
const UNDO = readFileSync("docs/pending/portal-card-edit/apply.undo.sql", "utf8");
const OWNER = "00000000-0000-4000-8000-0000000000a1";
const STRANGER = "00000000-0000-4000-8000-0000000000a2";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const HOME2 = "00000000-0000-4000-8000-0000000000b2";
const PROG = "00000000-0000-4000-8000-0000000000c1";

const SCHEMA = `
CREATE SCHEMA private; CREATE SCHEMA auth;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TYPE public.app_role AS ENUM ('admin', 'owner');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.is_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION private.owner_current_property_for_actor(u uuid, p uuid, g uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u = '${OWNER}'::uuid $$;
CREATE TABLE public.ao_library_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, once_per_owner boolean DEFAULT false);
CREATE TABLE public.ao_home_plan_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, program_id uuid, card_id uuid, owner_completed_at timestamptz);
CREATE TABLE public.ao_contributions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_card_id uuid, property_id uuid, program_id uuid, card_id uuid,
  submitted_by uuid, field_values jsonb, submitted_at timestamptz DEFAULT now());
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, entity_type text, entity_id uuid, uploaded_by uuid, deleted_at timestamptz);
CREATE TABLE public.chat(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, kind text, author uuid, body text);
CREATE FUNCTION public.post_home_chat_message(_p uuid, _k text, _b text, _a jsonb, _m uuid[]) RETURNS uuid LANGUAGE sql AS
  $$ INSERT INTO public.chat(property_id, kind, author, body) VALUES (_p, _k, auth.uid(), _b) RETURNING id $$;
CREATE TABLE public.audit_log(actor_id uuid, actor_label text, action text, entity_type text, entity_label text, reason text, before_value jsonb, after_value jsonb);
`;

let db: PGlite;
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const as = (uid: string) => db.exec(`SET test.uid = '${uid}'`);
const edit = (pc: string, values: unknown, files: unknown = []) =>
  one("SELECT public.ao_edit_card_answer($1, $2::jsonb, $3::jsonb) id", [pc, JSON.stringify(values), JSON.stringify(files)]);

async function seed(opts: { once?: boolean; done?: boolean } = {}) {
  const card = (await one("INSERT INTO public.ao_library_cards(title, once_per_owner) VALUES ('Draft your home''s listing title and description', $1) RETURNING id", [Boolean(opts.once)])).id;
  const done = opts.done === false ? null : "2026-11-10T15:00:00Z";
  const pc = (await one("INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, owner_completed_at) VALUES ($1, $2, $3, $4) RETURNING id", [HOME, PROG, card, done])).id;
  await db.query("INSERT INTO public.ao_contributions(plan_card_id, property_id, program_id, card_id, submitted_by, field_values) VALUES ($1, $2, $3, $4, $5, $6)",
    [pc, HOME, PROG, card, OWNER, JSON.stringify({ title: "Cozy lake house" })]);
  return { card, pc };
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(APPLY);
});

describe("Owner edits a completed plan card", () => {
  it("saves the new answer, keeps a who/when/before/after record and the card stays completed", async () => {
    const { pc } = await seed();
    await as(OWNER);
    await edit(pc, { title: "Lake house with dock" });
    const ch = await one("SELECT changed_by, changed_at, before_values, after_values, before_files, after_files FROM public.ao_contribution_changes");
    expect(ch.changed_by).toBe(OWNER);
    expect(ch.changed_at).toBeTruthy();
    expect(ch.before_values).toEqual({ title: "Cozy lake house" });
    expect(ch.after_values).toEqual({ title: "Lake house with dock" });
    expect((await one("SELECT field_values FROM public.ao_contributions")).field_values).toEqual({ title: "Lake house with dock" });
    expect(new Date((await one("SELECT owner_completed_at FROM public.ao_home_plan_cards")).owner_completed_at).toISOString()).toBe("2026-11-10T15:00:00.000Z");
  });

  it("posts exactly one line in the home's owner chat, as the owner", async () => {
    const { pc } = await seed();
    await as(OWNER);
    await edit(pc, { title: "Lake house with dock" });
    const rows = (await db.query("SELECT property_id, kind, author, body FROM public.chat")).rows;
    expect(rows).toEqual([{ property_id: HOME, kind: "owner", author: OWNER, body: "I updated my answer on Draft your home's listing title and description." }]);
  });

  it("adds and later removes a file the owner uploaded to the home", async () => {
    const { pc } = await seed();
    const doc = (await one("INSERT INTO public.documents(property_id, entity_type, entity_id, uploaded_by) VALUES ($1, 'property', $1, $2) RETURNING id", [HOME, OWNER])).id;
    await as(OWNER);
    await edit(pc, { title: "Cozy lake house" }, [{ document_id: doc, name: "dock.jpg" }]);
    expect((await one("SELECT files FROM public.ao_contributions")).files).toEqual([{ document_id: doc, name: "dock.jpg" }]);
    await edit(pc, { title: "Cozy lake house" }, []);
    expect((await one("SELECT files FROM public.ao_contributions")).files).toEqual([]);
    expect(Number((await one("SELECT count(*) n FROM public.ao_contribution_changes")).n)).toBe(2);
    expect(Number((await one("SELECT count(*) n FROM public.documents WHERE deleted_at IS NULL")).n)).toBe(1);
  });

  it("refuses a file that is not the owner's on this home", async () => {
    const { pc } = await seed();
    const other = (await one("INSERT INTO public.documents(property_id, entity_type, entity_id, uploaded_by) VALUES ($1, 'property', $1, $2) RETURNING id", [HOME2, OWNER])).id;
    await as(OWNER);
    await expect(edit(pc, { title: "x" }, [{ document_id: other, name: "a.pdf" }])).rejects.toThrow("A file is not one of your files on this home.");
  });

  it("refuses anyone who is not the home's owner", async () => {
    const { pc } = await seed();
    await as(STRANGER);
    await expect(edit(pc, { title: "x" })).rejects.toThrow("Not allowed");
  });

  it("refuses a card that is not completed yet, and a save with nothing changed", async () => {
    const open = await seed({ done: false });
    await as(OWNER);
    await expect(edit(open.pc, { title: "x" })).rejects.toThrow("Send your answer first.");
    const done = await seed();
    await expect(edit(done.pc, { title: "Cozy lake house" })).rejects.toThrow("Nothing changed.");
    expect(Number((await one("SELECT count(*) n FROM public.chat")).n)).toBe(0);
  });

  it("a card answered once for all homes keeps one answer on every home", async () => {
    const { card, pc } = await seed({ once: true });
    const pc2 = (await one("INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, owner_completed_at) VALUES ($1, $2, $3, now()) RETURNING id", [HOME2, PROG, card])).id;
    await db.query("INSERT INTO public.ao_contributions(plan_card_id, property_id, program_id, card_id, submitted_by, field_values) VALUES ($1, $2, $3, $4, $5, $6)",
      [pc2, HOME2, PROG, card, OWNER, JSON.stringify({ title: "Cozy lake house" })]);
    await as(OWNER);
    await edit(pc, { title: "New" });
    expect((await one("SELECT field_values FROM public.ao_contributions WHERE plan_card_id=$1", [pc2])).field_values).toEqual({ title: "New" });
    expect(Number((await one("SELECT count(*) n FROM public.chat")).n)).toBe(1);
  });

  it("undo stops new edits and keeps the change records", async () => {
    const { pc } = await seed();
    await as(OWNER);
    await edit(pc, { title: "New" });
    await db.exec(UNDO);
    await expect(edit(pc, { title: "Again" })).rejects.toThrow();
    expect(Number((await one("SELECT count(*) n FROM public.ao_contribution_changes")).n)).toBe(1);
  });
});
