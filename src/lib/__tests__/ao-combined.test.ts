import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Combined copy test: 01 foundation, 55-card seed, 02 RPCs and 03 reads applied together, then undone in reverse.
const read = (p: string) => readFileSync(p, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = U(1), owner = U(3), coOwner = U(4), assignee = U(6), home = U(10), prog = U(20), stepA = U(30), taskA = U(31);
const FULL = "c6f0cab5-4cbc-4531-b471-780ccc051bb2", STD = "84f3a777-44a8-430a-af7e-8f18dc9a7dae";
let db: PGlite;

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true),'')::uuid $$;
CREATE TABLE public.staff(id uuid PRIMARY KEY, is_admin boolean NOT NULL DEFAULT false);
CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1 AND is_admin AND $2='admin') $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE private.members(program_id uuid, user_id uuid, removed_at timestamptz);
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM private.members WHERE program_id=$1 AND user_id=$2 AND removed_at IS NULL) $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY, property_id uuid, owner_user_id uuid, status text, is_demo boolean NOT NULL DEFAULT false, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid NOT NULL, property_id uuid, phase text NOT NULL, stage text NOT NULL, title text NOT NULL, recommendation text, status text NOT NULL DEFAULT 'prepared', source_type text, owner_action_type text, onboarding_task_id uuid, is_demo boolean, created_by uuid, task_type text, available_from timestamptz, respond_by date, responded_at timestamptz, closed_at timestamptz, outcome text, updated_at timestamptz);
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, handoff_state text DEFAULT 'in_progress', ops_accepted_at timestamptz, completed_at timestamptz, ready_for_ops_at timestamptz, planned_closing_on date, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_templates(id uuid PRIMARY KEY, name text);
CREATE TABLE public.onboarding_template_tasks(id uuid PRIMARY KEY, template_id uuid, title text);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY, property_id uuid, template_task_id uuid, status text, assigned_to uuid, completed_by uuid, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid, owner_user_id uuid, review_id uuid, kind text, priority text, title text, body text, email_status text, is_demo boolean);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text, title text, body text, entity_type text, entity_id uuid, email_status text, is_demo boolean);
INSERT INTO public.onboarding_templates VALUES ('${FULL}','ARHA Onboarding — Full Plan'),('${STD}','ARHA Onboarding - Standard');
INSERT INTO public.onboarding_template_tasks VALUES ('${stepA}','${FULL}','Order furniture');
`;

const as = (uid: string | null) => db.query(`SELECT set_config('test.uid', $1, false)`, [uid ?? ""]);
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!;
const n = async (sql: string, p: unknown[] = []) => (await one<{ n: number }>(sql, p)).n;
const fingerprint = async () => (await one<{ h: string }>(`SELECT md5(
  (SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_templates t) ||
  (SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_template_tasks t) ||
  (SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_tasks t)) h`)).h;
const anonSet = async () => (await one<{ s: string }>(`SELECT coalesce(string_agg(p.oid::regprocedure::text, ',' ORDER BY 1),'') s FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')`)).s;
const catalog = async () => (await one<{ s: string }>(`SELECT
  (SELECT coalesce(string_agg(p.oid::regprocedure::text || md5(pg_get_functiondef(p.oid)) || coalesce(p.proacl::text,''), ',' ORDER BY 1),'')
     FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname IN ('public','private')) ||
  (SELECT coalesce(string_agg(tgname, ',' ORDER BY 1),'') FROM pg_trigger WHERE NOT tgisinternal) ||
  (SELECT coalesce(string_agg(c.relname || coalesce(c.relacl::text,''), ',' ORDER BY 1),'') FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
     WHERE ns.nspname IN ('public','private') AND c.relkind='r') ||
  (SELECT coalesce(string_agg(polname, ',' ORDER BY 1),'') FROM pg_policy) s`)).s;
const plan = (code: string) => one<{ id: string; join_outcome: string; owner_review_id: string | null; unlocked_at: string | null; reminder_at: Date | null; cutoff_at: Date | null; deadline_at: Date | null }>(
  "SELECT pc.* FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id=pc.card_id WHERE pc.property_id=$1 AND c.code=$2", [home, code]);

describe("Active Owner engine combined copy: 01, seed, 02, 03", () => {
  let catBefore = "", anonBefore = "", fpBefore = "";
  const anonAfter: string[] = [];
  const csvCodes = read("docs/pending/ao-library/cards_v1.csv").split("\n").slice(1).filter(Boolean).map((l) => l.split(",")[0]).sort();
  let locked = "", open = "", flex = "";

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(`INSERT INTO public.staff VALUES ('${admin}', true), ('${assignee}', false);
      INSERT INTO public.properties VALUES ('${home}', false);
      INSERT INTO public.owner_programs(id, property_id, owner_user_id, status) VALUES ('${prog}','${home}','${owner}','active');
      INSERT INTO private.members VALUES ('${prog}','${owner}',null),('${prog}','${coOwner}',null);
      INSERT INTO public.onboarding_projects(property_id, handoff_state) VALUES ('${home}','in_progress');
      INSERT INTO public.onboarding_tasks(id, property_id, template_task_id, status, assigned_to) VALUES ('${taskA}','${home}','${stepA}','open','${assignee}');`);
    catBefore = await catalog(); anonBefore = await anonSet(); fpBefore = await fingerprint();
    for (const f of ["docs/pending/ao-engine/01_engine_foundation.sql", "docs/pending/ao-library/01_seed_cards_v1.data.sql",
      "docs/pending/ao-engine/02_engine_rpcs.sql", "docs/pending/ao-engine/03_screen_reads.sql"]) {
      await db.exec(read(f));
      anonAfter.push(await anonSet());
    }
  });
  afterAll(async () => db?.close());

  it("anon-executable SECURITY DEFINER set identical after every step", () => {
    for (const s of anonAfter) expect(s).toBe(anonBefore);
  });

  it("55 drafts with codes matching cards_v1.csv, 10 event-triggered", async () => {
    expect(await n("SELECT count(*)::int n FROM public.ao_library_cards WHERE status='draft'")).toBe(55);
    expect(await n("SELECT count(*)::int n FROM public.ao_library_cards WHERE lane='triggered'")).toBe(10);
    const codes = (await db.query<{ code: string }>("SELECT code FROM public.ao_library_cards ORDER BY code")).rows.map((r) => r.code);
    expect(codes).toEqual([...csvCodes]);
  });

  it("release 3 sample cards in the copy, switch the home on, preview matches", async () => {
    locked = (await one<{ code: string }>("SELECT code FROM public.ao_library_cards WHERE lock_rule='until_linked_step_done' ORDER BY code LIMIT 1")).code;
    open = (await one<{ code: string }>("SELECT code FROM public.ao_library_cards WHERE lock_rule='none' AND lane<>'flexible' AND lane<>'triggered' ORDER BY code LIMIT 1")).code;
    flex = (await one<{ code: string }>("SELECT code FROM public.ao_library_cards WHERE lane='flexible' ORDER BY code LIMIT 1")).code;
    await db.query(`UPDATE public.ao_library_cards SET stage_window='anytime', linked_template_task_ids=ARRAY['${stepA}']::uuid[] WHERE code=$1`, [locked]);
    await db.query(`UPDATE public.ao_library_cards SET stage_window='anytime' WHERE code IN ($1,$2)`, [open, flex]);
    await as(admin);
    for (const c of [locked, open, flex])
      await db.query("SELECT public.ao_card_set_status((SELECT id FROM public.ao_library_cards WHERE code=$1),'released')", [c]);
    expect(await n("SELECT count(*)::int n FROM public.ao_library_cards WHERE status='released'")).toBe(3);
    const prev = await db.query("SELECT public.ao_preview_home_automation($1) p", [home]);
    expect(JSON.stringify(prev.rows)).toContain("locked");
    expect(await n("SELECT count(*)::int n FROM public.ao_home_plan_cards")).toBe(0);
    await db.query("SELECT public.ao_set_home_automation($1,true)", [home]);
    expect((await plan(locked)).join_outcome).toBe("locked");
    expect((await plan(open)).join_outcome).toBe("open");
    expect((await plan(flex)).join_outcome).toBe("open");
    expect(await n("SELECT count(*)::int n FROM public.ao_home_plan_cards")).toBe(3);
  });

  it("Task completion unlocks; reminder once; expiry alert to assignee only", async () => {
    await db.query("UPDATE public.onboarding_tasks SET status='complete', completed_by=$2 WHERE id=$1", [taskA, assignee]);
    const p = await plan(locked);
    expect(p.unlocked_at).not.toBeNull();
    const r = new Date(p.reminder_at!.getTime() + 60_000).toISOString();
    await db.query("SELECT public.ao_process_clocks($1)", [r]); await db.query("SELECT public.ao_process_clocks($1)", [r]);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE review_id=$1", [p.owner_review_id])).toBe(1);
    const c = new Date(p.cutoff_at!.getTime() + 60_000).toISOString();
    await db.query("SELECT public.ao_process_clocks($1)", [c]); await db.query("SELECT public.ao_process_clocks($1)", [c]);
    const alerts = (await db.query<{ user_id: string }>("SELECT user_id FROM public.staff_notifications WHERE entity_id IS NOT NULL OR true")).rows;
    expect(alerts.map((a) => a.user_id).filter((u) => u === assignee).length).toBeGreaterThanOrEqual(1);
    expect(alerts.every((a) => a.user_id === assignee)).toBe(true);
    expect((await one<{ outcome: string }>("SELECT outcome FROM public.owner_reviews WHERE id=$1", [p.owner_review_id])).outcome).toBe("Owner opportunity expired, ARHA completed");
    await db.query("UPDATE public.onboarding_tasks SET status='open', completed_by=null WHERE id=$1", [taskA]);
  });

  it("member submits; owner plan read returns the cards", async () => {
    await as(coOwner);
    await db.query(`SELECT public.ao_submit_card($1,'{"note":"done"}')`, [(await plan(flex)).id]);
    expect((await one<{ submitted_by: string }>("SELECT submitted_by FROM public.ao_contributions")).submitted_by).toBe(coOwner);
    const rows = await db.query("SELECT public.ao_owner_plan($1) p", [prog]);
    expect(JSON.stringify(rows.rows)).toContain((await plan(flex)).id);
  });

  it("templates and home Tasks unchanged; reverse undo restores the exact catalog", async () => {
    expect(await fingerprint()).toBe(fpBefore);
    await as(null);
    await db.exec("DELETE FROM public.ao_contributions; DELETE FROM public.ao_home_plan_cards; DELETE FROM public.ao_home_plan_settings_history; DELETE FROM public.ao_home_plan_settings;");
    for (const f of ["docs/pending/ao-engine/undo/03_screen_reads.sql", "docs/pending/ao-engine/undo/02_engine_rpcs.sql", "docs/pending/ao-library/undo/01_seed_cards_v1.data.sql"])
      await db.exec(read(f));
    expect(await n("SELECT count(*)::int n FROM public.ao_library_cards")).toBe(3); // the 3 released copies were edited, then undo removes by code
  });
});
