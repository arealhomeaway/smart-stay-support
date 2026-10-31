import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const staff = "00000000-0000-4000-8000-0000000000a1";
const owner = "00000000-0000-4000-8000-0000000000b1";
let db: PGlite;

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true),'')::uuid $$;
CREATE TABLE public.staff(id uuid PRIMARY KEY);
CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.is_internal_staff($1) $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY);
CREATE TABLE public.onboarding_templates(id uuid PRIMARY KEY, name text);
CREATE TABLE public.onboarding_template_tasks(id uuid PRIMARY KEY, template_id uuid, title text);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY, template_task_id uuid, status text);
INSERT INTO public.onboarding_templates VALUES
 ('c6f0cab5-4cbc-4531-b471-780ccc051bb2','ARHA Onboarding — Full Plan'),('84f3a777-44a8-430a-af7e-8f18dc9a7dae','ARHA Onboarding - Standard');
INSERT INTO public.onboarding_template_tasks VALUES
 ('9f283354-0771-4bfd-a8da-875d9802f1d2','84f3a777-44a8-430a-af7e-8f18dc9a7dae','Update the utility/property matrix'),
 ('03a86fb7-20b7-42d1-8a32-47516518529d','c6f0cab5-4cbc-4531-b471-780ccc051bb2','Confirm utilities are scheduled to be transferred/set up at closing');
INSERT INTO public.onboarding_tasks VALUES ('00000000-0000-4000-8000-0000000000c1','9f283354-0771-4bfd-a8da-875d9802f1d2','open');
`;
const fingerprint = async () =>
  (await db.query<{ h: string }>(`SELECT md5(
    (SELECT coalesce(string_agg(t::text, '|' ORDER BY id), '') FROM public.onboarding_templates t) ||
    (SELECT coalesce(string_agg(t::text, '|' ORDER BY id), '') FROM public.onboarding_template_tasks t) ||
    (SELECT coalesce(string_agg(t::text, '|' ORDER BY id), '') FROM public.onboarding_tasks t)) h`)).rows[0]!.h;
const count = async (w = "true") =>
  (await db.query<{ n: number }>(`SELECT count(*)::int n FROM public.ao_library_cards WHERE ${w}`)).rows[0]!.n;

describe("Library v2 draft seed, isolated PostgreSQL", () => {
  let before = "";
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    before = await fingerprint();
    await db.exec(read("docs/pending/ao-engine/01_engine_foundation.sql"));
    await db.exec(read("docs/pending/ao-library/01_seed_cards_v1.data.sql"));
    await db.query("INSERT INTO public.staff VALUES ($1)", [staff]);
  });
  afterAll(async () => db?.close());

  it("loads all 55 cards as drafts with stable codes", async () => {
    expect(await count()).toBe(55);
    expect(await count("status='draft'")).toBe(55);
    expect(await count("event_triggered")).toBe(10);
    expect(await count("lane='flexible' AND takeover_text<>''")).toBe(0);
  });

  it("maps locks, deadlines and linked steps from both templates", async () => {
    const p01 = (await db.query<{ lock_rule: string; deadline_business_days: number; cutoff_rule: string; ids: string[] }>(
      "SELECT lock_rule, deadline_business_days, cutoff_rule, linked_template_task_ids::text[] ids FROM public.ao_library_cards WHERE code='P01'")).rows[0]!;
    expect(p01.lock_rule).toBe("none");
    expect(p01.deadline_business_days).toBe(3);
    expect(p01.cutoff_rule).toBe("next_business_day_9am");
    expect(p01.ids).toContain("03a86fb7-20b7-42d1-8a32-47516518529d");
    expect(p01.ids).toContain("9f283354-0771-4bfd-a8da-875d9802f1d2");
    expect(await count("code='P03' AND lock_rule='until_linked_step_done'")).toBe(1);
    expect(await count("code='N01' AND cutoff_rule='none' AND deadline_calendar_days=7")).toBe(1);
  });

  it("homeowners and signed-out callers cannot see drafts", async () => {
    await db.exec("GRANT USAGE ON SCHEMA private, auth TO authenticated, anon; GRANT SELECT ON public.staff TO authenticated");
    await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${owner}',false)`);
    expect(await count()).toBe(0);
    await db.exec(`SELECT set_config('test.uid','${staff}',false)`);
    expect(await count()).toBe(55);
    await db.exec("RESET ROLE; SET ROLE anon");
    await expect(count()).rejects.toThrow();
    await db.exec("RESET ROLE");
  });

  it("templates and home plans unchanged; undo removes exactly these rows", async () => {
    expect(await fingerprint()).toBe(before);
    await db.query("INSERT INTO public.ao_library_cards(code,title,lane,stage_window) VALUES ('X99','Other card','flexible','anytime')");
    await db.exec(read("docs/pending/ao-library/undo/01_seed_cards_v1.data.sql"));
    expect(await count()).toBe(1);
    expect(await count("code='X99'")).toBe(1);
    expect(await fingerprint()).toBe(before);
  });
});
