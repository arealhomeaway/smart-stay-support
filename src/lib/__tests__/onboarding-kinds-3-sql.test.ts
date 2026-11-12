// Nov 12 small fix batch, item 3: the staged file in docs/pending/onboarding-kinds-3 runs on an
// isolated PostgreSQL copy (PGlite) built from the live table shapes. Nothing touches the real database.
import { describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/onboarding-kinds-3";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8").replace(/^NOTIFY .*$/m, "");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = U(1), stranger = U(9);
const home = U(11), home2 = U(12), prog = U(21);
const outsideTask = U(31), stepTask = U(32), plainTask = U(33), step = U(41);
const plan = U(51), review = U(52), work = U(53), plainPlan = U(54), plan2 = U(55);

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE FUNCTION private.is_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $2 = '${owner}' $$;
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY, property_id uuid, status text, archived_at timestamptz);
CREATE TABLE public.owner_program_properties(program_id uuid, property_id uuid, archived_at timestamptz);
CREATE TABLE public.onboarding_template_tasks(id uuid PRIMARY KEY, kind_settings jsonb NOT NULL DEFAULT '{}');
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY, property_id uuid, template_task_id uuid, task_kind text DEFAULT 'do_it',
  kind_settings jsonb NOT NULL DEFAULT '{}', archived_at timestamptz);
CREATE TABLE public.ao_home_plan_cards(id uuid PRIMARY KEY, program_id uuid, property_id uuid, linked_task_id uuid);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY, program_id uuid, property_id uuid, archived_at timestamptz, onboarding_task_id uuid);
CREATE TABLE public.owner_item_task_sends(review_id uuid PRIMARY KEY, task_id uuid);
CREATE TABLE public.work_items(id uuid PRIMARY KEY, program_id uuid, property_id uuid, source_task_id uuid);
`;

async function fresh(programStatus = "active") {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(`
    INSERT INTO public.owner_programs VALUES ('${prog}', '${home}', '${programStatus}', NULL);
    INSERT INTO public.owner_program_properties VALUES ('${prog}', '${home2}', NULL);
    INSERT INTO public.onboarding_template_tasks VALUES ('${step}', '{"where":"houzz_pro","documentName":"design proposal","ownerMessage":"Open the [document] in {where}."}');
    INSERT INTO public.onboarding_tasks(id, property_id, template_task_id, task_kind, kind_settings) VALUES
      ('${outsideTask}', '${home}', NULL, 'outside_resolve', '{"where":"docusign","documentName":"management agreement"}'),
      ('${stepTask}', '${home2}', '${step}', 'outside_resolve', '{"where":"houzz_pro"}'),
      ('${plainTask}', '${home}', NULL, 'do_it', '{}');
    INSERT INTO public.ao_home_plan_cards VALUES ('${plan}', '${prog}', '${home}', '${outsideTask}'), ('${plainPlan}', '${prog}', '${home}', '${plainTask}'),
      ('${plan2}', '${prog}', '${home2}', '${stepTask}');
    INSERT INTO public.owner_reviews VALUES ('${review}', '${prog}', '${home}', NULL, NULL);
    INSERT INTO public.owner_item_task_sends VALUES ('${review}', '${outsideTask}');
    INSERT INTO public.work_items VALUES ('${work}', '${prog}', '${home}', '${outsideTask}');`);
  await db.exec(read("01_owner_outside_notes.sql"));
  return db;
}
const as = (db: PGlite, uid: string) => db.exec(`SELECT set_config('request.jwt.claim.sub', '${uid}', false)`);
type Row = { source: string; item_id: string; where_code: string | null; document_name: string | null; owner_message: string | null; live_program: boolean };
const rows = async (db: PGlite) =>
  (await db.query<Row>(`SELECT source, item_id::text, where_code, document_name, owner_message, live_program FROM public.owner_outside_resolve_notes('${prog}') ORDER BY source, item_id`)).rows;

describe("item 3: owner_outside_resolve_notes (staged)", () => {
  it("returns each outside-Resolve owner card with its place, document name and live program", async () => {
    const db = await fresh();
    await as(db, owner);
    expect(await rows(db)).toEqual([
      { source: "plan", item_id: plan, where_code: "docusign", document_name: "management agreement", owner_message: null, live_program: true },
      { source: "plan", item_id: plan2, where_code: "houzz_pro", document_name: "design proposal", owner_message: "Open the [document] in {where}.", live_program: true },
      { source: "review", item_id: review, where_code: "docusign", document_name: "management agreement", owner_message: null, live_program: true },
      { source: "work", item_id: work, where_code: "docusign", document_name: "management agreement", owner_message: null, live_program: true },
    ]);
  });
  it("a closed program is not live", async () => {
    const db = await fresh("closed");
    await as(db, owner);
    expect((await rows(db)).every((r) => r.live_program === false)).toBe(true);
  });
  it("only program members and staff can read it", async () => {
    const db = await fresh();
    await as(db, stranger);
    await expect(db.exec(`SELECT * FROM public.owner_outside_resolve_notes('${prog}')`)).rejects.toThrow("Not available");
  });
  it("is closed to anon and the public", async () => {
    const db = await fresh();
    const acl = (await db.query<{ a: string }>("SELECT proacl::text a FROM pg_proc WHERE proname = 'owner_outside_resolve_notes'")).rows[0]!.a;
    expect(acl.includes("authenticated=X")).toBe(true);
    expect(acl.includes("anon=")).toBe(false);
    expect(/(^|[{,])=X/.test(acl)).toBe(false);
  });
  it("undo removes it", async () => {
    const db = await fresh();
    await db.exec(read("01_owner_outside_notes.undo.sql"));
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM pg_proc WHERE proname = 'owner_outside_resolve_notes'")).rows[0]!.n).toBe(0);
  });
});
