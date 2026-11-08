import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/handoff/ (Emily, Nov 7, 2026; register O4, punch list H4).
 * The staged files run byte for byte; only tables and helpers they call are stubbed.
 * Nothing touches the real database.
 */
const DIR = "docs/pending/handoff";
const read = (p: string) => readFileSync(`${DIR}/${p}`, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SUP = U(1), DIR_OPS = U(2);
const TPL = "84f3a777-44a8-430a-af7e-8f18dc9a7dae";
const V3 = "7851b728-3b06-4bcb-87a6-cc69e2125c19";
const HOME = U(10), HOME2 = U(11), DEMO_HOME = U(12);
const PROJ = U(20), PROJ2 = U(21), DEMO_PROJ = U(22);
/** 8:00 AM Central on a given date in November (CST, UTC-6). */
const at8 = (day: string) => `${day}T14:00:00Z`;

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA cron; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION private.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE TABLE cron.jobs(name text PRIMARY KEY, schedule text, command text);
CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS
  $$ INSERT INTO cron.jobs VALUES (n, s, c) ON CONFLICT (name) DO UPDATE SET schedule = excluded.schedule RETURNING 1::bigint $$;
CREATE FUNCTION cron.unschedule(n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.jobs WHERE name = n RETURNING true $$;
CREATE TABLE public.functional_roles(code text PRIMARY KEY, current_seat_holder uuid);
CREATE FUNCTION public.seat_holder_at(_code text, _at timestamptz) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT current_seat_holder FROM public.functional_roles WHERE code = _code $$;
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text,
  entity_type text, entity_id uuid, link_path text, email boolean, is_demo boolean);
CREATE FUNCTION public.notify_staff(_user_id uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid,
  _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean) RETURNS uuid LANGUAGE sql AS
  $$ INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, email, is_demo)
     VALUES (_user_id, _kind, _title, _body, _entity_type, _entity_id, _link_path, _email, _is_demo) RETURNING id $$;
CREATE FUNCTION public.format_property_label(_p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS
  $$ SELECT jsonb_build_object('primary', _p->>'address_line1') $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, address_line1 text, is_demo boolean DEFAULT false, handoff_accepted_at timestamptz, locked boolean DEFAULT false);
CREATE FUNCTION private.onboarding_work_locked(_p uuid[]) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.properties WHERE id = ANY(_p) AND locked) $$;
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY, property_id uuid, status text DEFAULT 'active', target_handoff_on date,
  handoff_state text DEFAULT 'in_progress', ops_accepted_at timestamptz, is_demo boolean DEFAULT false);
CREATE TABLE public.onboarding_template_stages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid, name text, sort_order int, active boolean DEFAULT true);
CREATE TABLE public.onboarding_template_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid, stage text, title text,
  sort_order int, blocks_handoff boolean, is_required boolean, evidence_required boolean DEFAULT false, is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_template_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid, version int, snapshot jsonb,
  published_at timestamptz DEFAULT now(), published_by uuid);
CREATE FUNCTION public.block_version_change() RETURNS trigger LANGUAGE plpgsql AS
  $$ BEGIN RAISE EXCEPTION 'Published template versions cannot be changed. Publish a new version instead.'; END $$;
CREATE TRIGGER block_template_version_mutation BEFORE DELETE OR UPDATE ON public.onboarding_template_versions
  FOR EACH ROW EXECUTE FUNCTION public.block_version_change();
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, title text, status text DEFAULT 'open',
  completed_at timestamptz, blocks_handoff boolean, is_required boolean, evidence_required boolean DEFAULT false, archived_at timestamptz,
  updated_at timestamptz DEFAULT now());
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text, entity_type text, entity_id uuid,
  entity_label text, before_value jsonb, after_value jsonb);
`;

const PUBLISH_V3 = `INSERT INTO public.onboarding_template_versions(id, template_id, version, snapshot)
  SELECT '${V3}', '${TPL}', 3, jsonb_build_object(
    'stages', (SELECT jsonb_agg(jsonb_build_object('name', s.name, 'sort_order', s.sort_order) ORDER BY s.sort_order) FROM public.onboarding_template_stages s WHERE s.template_id = '${TPL}' AND s.active),
    'steps', (SELECT jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order) FROM public.onboarding_template_tasks t WHERE t.template_id = '${TPL}' AND t.is_active))`;

let db: PGlite;
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!;
const n = async (sql: string, p: unknown[] = []) => Number((await one<{ n: number }>(sql, p)).n);

async function fresh() {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.query("INSERT INTO public.functional_roles VALUES ('ops_supervisor', $1), ('director_ops', $2)", [SUP, DIR_OPS]);
  await db.query("INSERT INTO public.properties(id, address_line1, is_demo) VALUES ($1, '1 Main St', false), ($2, '2 Oak Ave', false), ($3, '9 Demo Rd', true)", [HOME, HOME2, DEMO_HOME]);
  await db.query("INSERT INTO public.onboarding_projects(id, property_id, is_demo) VALUES ($1, $2, false), ($3, $4, false), ($5, $6, true)", [PROJ, HOME, PROJ2, HOME2, DEMO_PROJ, DEMO_HOME]);
  await db.exec(read("01_handoff_reminders.sql"));
}

/** The Standard plan: 6 stages, 25 handoff steps (one inactive), 20 other steps; 1,550 blocking home Tasks, 60 completed. */
async function plan() {
  await db.exec(`
    INSERT INTO public.onboarding_template_stages(template_id, name, sort_order)
      SELECT '${TPL}', s, o FROM unnest(ARRAY['Intake','Pre-Close','Ordering & Repairs','Setup & Staging','Preparing for Handoff','Handoff'], ARRAY[10,20,30,40,50,60]) AS x(s, o);
    INSERT INTO public.onboarding_template_tasks(template_id, stage, title, sort_order, blocks_handoff, is_required, evidence_required, is_active)
      SELECT '${TPL}', CASE WHEN g <= 18 THEN 'Preparing for Handoff' ELSE 'Handoff' END, 'Handoff step ' || g, 500 + g, true, true, g % 3 = 0, g <> 25
      FROM generate_series(1, 25) g;
    INSERT INTO public.onboarding_template_tasks(template_id, stage, title, sort_order, blocks_handoff, is_required, evidence_required)
      SELECT '${TPL}', 'Pre-Close', 'Other step ' || g, g, g % 2 = 0, true, g % 4 = 0 FROM generate_series(1, 20) g;
    INSERT INTO public.onboarding_tasks(property_id, title, status, completed_at, blocks_handoff, is_required, archived_at)
      SELECT CASE WHEN g % 2 = 0 THEN '${HOME}'::uuid ELSE '${HOME2}'::uuid END, 'Home task ' || g,
             CASE WHEN g <= 60 THEN 'complete' ELSE 'open' END, CASE WHEN g <= 60 THEN now() END, true, true,
             CASE WHEN g BETWEEN 61 AND 95 THEN now() END
      FROM generate_series(1, 1550) g;
    INSERT INTO public.onboarding_tasks(property_id, title, blocks_handoff, is_required) SELECT '${HOME}', 'Not blocking ' || g, false, g % 2 = 0 FROM generate_series(1, 30) g;
  `);
  await db.exec(PUBLISH_V3);
}

describe("handoff reminders (01)", () => {
  beforeEach(fresh);

  it("a project 7 days out is reminded once, to both roles, and not again the next day", async () => {
    await db.query("UPDATE public.onboarding_projects SET target_handoff_on = '2026-11-16' WHERE id = $1", [PROJ]);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-09")])).toBe(1);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-09")])).toBe(0);
    const sent = (await db.query<{ user_id: string; title: string; body: string; link_path: string; email: boolean }>(
      "SELECT user_id, title, body, link_path, email FROM public.staff_notifications ORDER BY user_id")).rows;
    expect(sent.map((s) => s.user_id)).toEqual([SUP, DIR_OPS]);
    expect(sent[0]!.title).toBe("Handoff in 7 days: 1 Main St");
    expect(sent[0]!.body).toBe("Handoff date: Monday, November 16. Anything still open carries over to Operations.");
    expect(sent[0]!.link_path).toBe(`/property/${HOME}?tab=handoff`);
    expect(sent.every((s) => s.email)).toBe(true);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-10")])).toBe(0);
    expect(await n("SELECT count(*) n FROM public.staff_notifications")).toBe(2);
  });

  it("reminds 7 days before, 2 days before and on the day, and only in the 8 AM Central hour", async () => {
    await db.query("UPDATE public.onboarding_projects SET target_handoff_on = '2026-11-16' WHERE id = $1", [PROJ]);
    expect(await n("SELECT public.run_handoff_reminders($1) n", ["2026-11-09T13:00:00Z"])).toBe(0); // 7 AM Central
    expect(await n("SELECT public.run_handoff_reminders($1) n", ["2026-11-09T15:00:00Z"])).toBe(0); // 9 AM Central
    for (const day of ["2026-11-09", "2026-11-14", "2026-11-16"])
      expect(await n("SELECT public.run_handoff_reminders($1) n", [at8(day)])).toBe(1);
    for (const day of ["2026-11-10", "2026-11-13", "2026-11-15", "2026-11-17"])
      expect(await n("SELECT public.run_handoff_reminders($1) n", [at8(day)])).toBe(0);
    const titles = (await db.query<{ title: string }>("SELECT DISTINCT title FROM public.staff_notifications ORDER BY 1")).rows.map((r) => r.title);
    expect(titles).toEqual(["Handoff in 2 days: 1 Main St", "Handoff in 7 days: 1 Main St", "Handoff today: 1 Main St"]);
    // Summer time: 8 AM Central is 13:00 UTC.
    await db.query("UPDATE public.onboarding_projects SET target_handoff_on = '2027-06-08' WHERE id = $1", [PROJ]);
    expect(await n("SELECT public.run_handoff_reminders($1) n", ["2027-06-01T14:00:00Z"])).toBe(0);
    expect(await n("SELECT public.run_handoff_reminders($1) n", ["2027-06-01T13:00:00Z"])).toBe(1);
  });

  it("a moved date reminds on the new schedule", async () => {
    await db.query("UPDATE public.onboarding_projects SET target_handoff_on = '2026-11-16' WHERE id = $1", [PROJ]);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-09")])).toBe(1);
    await db.query("UPDATE public.onboarding_projects SET target_handoff_on = '2026-11-20' WHERE id = $1", [PROJ]);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-14")])).toBe(0); // old 2 day date
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-13")])).toBe(1); // new 7 day date
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-18")])).toBe(1);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-20")])).toBe(1);
    const rows = (await db.query<{ handoff_on: string; kind: string }>("SELECT handoff_on::text, kind FROM public.handoff_reminders ORDER BY sent_on")).rows;
    expect(rows).toEqual([
      { handoff_on: "2026-11-16", kind: "seven_days" },
      { handoff_on: "2026-11-20", kind: "seven_days" },
      { handoff_on: "2026-11-20", kind: "two_days" },
      { handoff_on: "2026-11-20", kind: "day_of" },
    ]);
  });

  it("no reminder once handed off, for no date, a demo home, or a cancelled project", async () => {
    await db.query("UPDATE public.onboarding_projects SET target_handoff_on = '2026-11-16'");
    await db.query("UPDATE public.onboarding_projects SET handoff_state = 'accepted', ops_accepted_at = now() WHERE id = $1", [PROJ]);
    await db.query("UPDATE public.onboarding_projects SET status = 'cancelled' WHERE id = $1", [PROJ2]);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-09")])).toBe(0);
    await db.query("UPDATE public.onboarding_projects SET handoff_state = 'in_progress', ops_accepted_at = NULL WHERE id = $1", [PROJ]);
    await db.query("UPDATE public.properties SET handoff_accepted_at = now() WHERE id = $1", [HOME]);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-09")])).toBe(0);
    await db.query("UPDATE public.onboarding_projects SET target_handoff_on = NULL");
    await db.query("UPDATE public.properties SET handoff_accepted_at = NULL");
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-09")])).toBe(0);
    expect(await n("SELECT count(*) n FROM public.staff_notifications")).toBe(0);
  });

  it("one person in both roles gets one alert; an empty role sends nothing", async () => {
    await db.query("UPDATE public.functional_roles SET current_seat_holder = $1", [SUP]);
    await db.query("UPDATE public.onboarding_projects SET target_handoff_on = '2026-11-16' WHERE id = $1", [PROJ]);
    expect(await n("SELECT public.run_handoff_reminders($1) n", [at8("2026-11-09")])).toBe(1);
    expect(await n("SELECT count(*) n FROM public.staff_notifications")).toBe(1);
  });

  it("schedules the daily job, is service only, and undoes cleanly", async () => {
    const job = await one<{ schedule: string; command: string }>("SELECT schedule, command FROM cron.jobs WHERE name = 'handoff-reminders'");
    expect(job).toEqual({ schedule: "0 13,14 * * *", command: "SELECT public.run_handoff_reminders()" });
    expect(await n("SELECT count(*) n FROM information_schema.role_routine_grants WHERE routine_name = 'run_handoff_reminders' AND grantee IN ('authenticated','anon')")).toBe(0);
    await db.exec(read("01_undo_handoff_reminders.sql"));
    expect(await n("SELECT count(*) n FROM cron.jobs")).toBe(0);
    expect(await n("SELECT count(*) n FROM pg_proc WHERE proname = 'run_handoff_reminders'")).toBe(0);
    expect(await n("SELECT count(*) n FROM pg_class WHERE relname = 'handoff_reminders'")).toBe(0);
  });
});

describe("handoff never blocks (02, 03)", () => {
  beforeEach(async () => {
    await fresh();
    await plan();
    await db.exec(read("02_flag_snapshot_table.sql"));
  });

  async function counts() {
    return one<Record<string, number>>(`SELECT
      (SELECT count(*) FROM public.onboarding_template_tasks WHERE stage IN ('Preparing for Handoff','Handoff') AND (blocks_handoff OR is_required))::int AS plan_handoff_marked,
      (SELECT count(*) FROM public.onboarding_template_tasks WHERE stage = 'Pre-Close' AND blocks_handoff)::int AS plan_other_blocking,
      (SELECT count(*) FROM public.onboarding_tasks WHERE blocks_handoff)::int AS home_blocking,
      (SELECT count(*) FROM public.onboarding_tasks WHERE blocks_handoff AND status = 'complete')::int AS home_blocking_complete,
      (SELECT count(*) FROM public.onboarding_tasks WHERE is_required)::int AS home_required`);
  }

  it("clears the 25 plan steps and the 1,490 open home Tasks, leaves the rest, and publishes version 4", async () => {
    expect(await counts()).toEqual({ plan_handoff_marked: 25, plan_other_blocking: 10, home_blocking: 1550, home_blocking_complete: 60, home_required: 1565 });
    await db.exec(read("03_clear_handoff_flags.sql"));
    expect(await counts()).toEqual({ plan_handoff_marked: 0, plan_other_blocking: 10, home_blocking: 60, home_blocking_complete: 60, home_required: 75 });
    // Evidence and every other flag are untouched.
    expect(await n("SELECT count(*) n FROM public.onboarding_template_tasks WHERE evidence_required")).toBe(13);
    const v4 = await one<{ version: number; steps: number; handoff_blocking: number; published_by: string | null }>(`
      SELECT version, jsonb_array_length(snapshot->'steps') steps, published_by,
        (SELECT count(*) FROM jsonb_array_elements(snapshot->'steps') s WHERE (s->>'blocks_handoff')::boolean OR (s->>'is_required')::boolean AND s->>'stage' IN ('Handoff','Preparing for Handoff'))::int handoff_blocking
      FROM public.onboarding_template_versions WHERE version = 4`);
    expect(v4).toEqual({ version: 4, steps: 44, handoff_blocking: 10, published_by: null });
    // Version 4 equals version 3 apart from the two cleared marks on the handoff steps.
    expect(await n(`SELECT count(*) n FROM
      (SELECT (s - 'blocks_handoff' - 'is_required') x FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') s WHERE v.version = 3
       EXCEPT ALL SELECT (s - 'blocks_handoff' - 'is_required') FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') s WHERE v.version = 4) d`)).toBe(0);
    expect(await n("SELECT count(*) n FROM public.audit_log WHERE action = 'handoff_never_blocks_applied'")).toBe(3);
    expect(await n("SELECT count(*) n FROM public.onboarding_flag_snapshots")).toBe(1515);
  });

  it("refuses to run twice", async () => {
    await db.exec(read("03_clear_handoff_flags.sql"));
    await expect(db.exec(read("03_clear_handoff_flags.sql"))).rejects.toThrow("already run");
  });

  it("refuses when the live plan differs from version 3, changing nothing", async () => {
    await db.exec("UPDATE public.onboarding_template_tasks SET title = 'Edited' WHERE title = 'Other step 1'");
    await expect(db.exec(read("03_clear_handoff_flags.sql"))).rejects.toThrow("differs from version 3");
    expect((await counts())["home_blocking"]).toBe(1550);
  });

  it("refuses when a count is not what was reported, changing nothing", async () => {
    await db.exec("UPDATE public.onboarding_tasks SET status = 'complete', completed_at = now() WHERE title = 'Home task 100'");
    await expect(db.exec(read("03_clear_handoff_flags.sql"))).rejects.toThrow("Expected 1,490");
    expect((await counts())["home_blocking"]).toBe(1550);
    expect(await n("SELECT count(*) n FROM public.onboarding_flag_snapshots")).toBe(0);
  });

  it("leaves homes whose handoff is locked exactly as they are", async () => {
    await db.query("UPDATE public.properties SET locked = true WHERE id = $1", [HOME2]);
    await expect(db.exec(read("03_clear_handoff_flags.sql"))).rejects.toThrow("Expected 1,490");
  });

  it("undo restores the exact previous values and publishes version 3's content again", async () => {
    const before = (await db.query("SELECT id, blocks_handoff, is_required FROM public.onboarding_tasks ORDER BY id")).rows;
    const planBefore = (await db.query("SELECT id, blocks_handoff, is_required FROM public.onboarding_template_tasks ORDER BY id")).rows;
    await db.exec(read("03_clear_handoff_flags.sql"));
    await db.exec(read("03_undo_clear_handoff_flags.sql"));
    expect((await db.query("SELECT id, blocks_handoff, is_required FROM public.onboarding_tasks ORDER BY id")).rows).toEqual(before);
    expect((await db.query("SELECT id, blocks_handoff, is_required FROM public.onboarding_template_tasks ORDER BY id")).rows).toEqual(planBefore);
    expect(await n("SELECT count(*) n FROM public.onboarding_template_versions v5, public.onboarding_template_versions v3 WHERE v5.version = 5 AND v3.version = 3 AND v5.snapshot = v3.snapshot")).toBe(1);
    await db.exec(read("02_undo_flag_snapshot_table.sql"));
    expect(await n("SELECT count(*) n FROM pg_class WHERE relname = 'onboarding_flag_snapshots'")).toBe(0);
  });
});
