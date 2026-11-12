// Fix 5 (changed Nov 11 by the Admin): the V2 to Standard move archives every V2 Task (kept, recorded),
// creates every Standard step open as the plan assigns it, creates only the steps in the confirmed done
// list as completed (with the COO note), uses no title matching, and undoes exactly from its receipts.
// The 05a dry run writes nothing and reports, per home, Tasks to archive, steps to create, steps created
// completed and the owner cards that would be Already covered. Isolated PostgreSQL only.
import { afterEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/active-owner-fix";
const read = (p: string) => readFileSync(p, "utf8");
const MOVE = read(`${DIR}/05b_v2_to_standard_move.sql`);
const UNDO = read(`${DIR}/05b_v2_to_standard_move.undo.sql`);
const DRY = read(`${DIR}/05a_v2_to_standard_dry_run.sql`);
const GUARD = read(`${DIR}/live-capture/owner_business_decision_guard.sql`);
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STD = "94ef41f6-b195-4b94-b09c-830f706f5d1a", V2 = U(900), STD_T = U(901), V2_T = U(902);
const ACTOR = "98bd6696-4018-4965-b645-0471c5ae3925";
const NOTE = "Done before Resolve, confirmed by the COO, Nov 11";
const PROJECTS = ["0c2d2b1d-6967-4b2a-a973-2685c06cfd3b", "94338f4a-4a97-4268-869a-79ed103bbc8b",
  "add4e549-2929-42db-b5fd-131787088768", "11bb7e6a-cb17-4b6d-b27f-df9b505d4400"];
// Standard steps: A handoff meeting, B trash (one subtask), C Roku, D owner decision, H a handoff step.
const sA = U(60), sB = U(61), sC = U(62), sD = U(63), sH = U(64);
const who = U(51);
const LIST_RE = /-- >>> CONFIRMED DONE LIST >>>[\s\S]*?'(\[[\s\S]*?\])'[\s\S]*?-- <<< CONFIRMED DONE LIST <<</;
const listOf = (sql: string) => JSON.parse(LIST_RE.exec(sql)![1]!) as { project: string; home: string; done_steps: string[] }[];
/** Fills the confirmed done list in a copy of 05a or 05b, as the Admin will after the checklist. */
const withList = (sql: string, done: Record<number, string[]>) => {
  const list = listOf(sql).map((e, i) => ({ ...e, done_steps: done[i] ?? [] }));
  return sql.replace(LIST_RE, (m, json: string) => m.replace(json, JSON.stringify(list)));
};

let db: PGlite;
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!;
const n = async (sql: string, p: unknown[] = []) => (await one<{ n: number }>(sql, p)).n;
const fp = async () => (await one<{ h: string }>(`SELECT md5(coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_tasks t),'') ||
  coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_projects t),'')) h`)).h;

async function setup() {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;`);
  await db.exec(read("src/lib/__tests__/fixtures/active-owner-fix-schema.sql"));
  await db.exec(GUARD);
  await db.exec(`
    CREATE TRIGGER owner_business_decision_completion_guard BEFORE INSERT OR UPDATE OF status ON public.onboarding_tasks
      FOR EACH ROW EXECUTE FUNCTION public.owner_business_decision_guard();
    CREATE FUNCTION public.handoff_step_for_task(_task_id uuid) RETURNS text LANGUAGE sql STABLE AS $$
      SELECT CASE WHEN template_task_id='${sH}' THEN 'ready' END FROM public.onboarding_tasks WHERE id=_task_id $$;
    CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE FUNCTION public.format_property_label(jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('primary', $1->>'name') $$;
    CREATE TABLE public.onboarding_templates(id uuid PRIMARY KEY, key text, name text);
    CREATE TABLE public.onboarding_template_versions(id uuid PRIMARY KEY, template_id uuid, version int, snapshot jsonb);
    CREATE TABLE public.onboarding_task_file_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, receiving_task_id uuid, source_task_id uuid, origin text, created_by uuid, UNIQUE(receiving_task_id, source_task_id));
    CREATE FUNCTION public.plan_step_applies(jsonb, text, text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce($1->>'skip','') = '' $$;
    CREATE FUNCTION public.project_role_assignee(uuid, text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${U(70)}'::uuid $$;
    CREATE FUNCTION public.plan_due_from_rule(date, int, text) RETURNS date LANGUAGE sql STABLE AS $$ SELECT $1 + coalesce($2,0) $$;
    INSERT INTO public.onboarding_templates VALUES ('${STD_T}','arha_onboarding_standard','Standard'),('${V2_T}','arha_v2','V2');
    INSERT INTO public.onboarding_template_versions VALUES ('${V2}','${V2_T}',1,'{"steps":[]}'),
      ('${STD}','${STD_T}',4,'{"steps":[
        {"id":"${sA}","title":"Schedule the handoff meeting","stage":"launch","functional_role":"project_manager","offset_days":5,"schedule_anchor":"planned_closing","show_files_from":["${sB}"]},
        {"id":"${sB}","title":"Transfer trash service","stage":"setup","subtasks":["Call the city"]},
        {"id":"${sC}","title":"Activate the Roku devices","stage":"launch","functional_role":"utilities"},
        {"id":"${sD}","title":"Share the estimate with the owner","stage":"design","owner_dependency":"business_decision","requires_owner_approval":true},
        {"id":"${sH}","title":"Mark ready for Operations","stage":"launch"},
        {"id":"${U(65)}","title":"Pool step","stage":"setup","condition":{"skip":"no pool"}}]}');
    INSERT INTO public.ao_library_cards(code, title, lane, stage_window, status, linked_template_task_ids) VALUES
      ('X01', 'One step card', 'launch', 'onboarding_launch', 'released', ARRAY['${sA}']::uuid[]),
      ('X02', 'Two step card', 'launch', 'onboarding_launch', 'released', ARRAY['${sA}','${sC}']::uuid[]),
      ('X03', 'Card with a step not on the plan', 'launch', 'onboarding_launch', 'released', ARRAY['${sB}','${U(65)}']::uuid[]),
      ('X04', 'Draft card', 'launch', 'onboarding_launch', 'draft', ARRAY['${sA}']::uuid[]);`);
  for (const [i, pid] of PROJECTS.entries()) {
    const home = U(10 + i);
    await db.query("INSERT INTO public.properties(id, name) VALUES ($1, $2)", [home, `${i + 1} Home St`]);
    await db.query(`INSERT INTO public.onboarding_projects(id, property_id, template_version_id, planned_closing_on, furnishing_scope)
      VALUES ($1,$2,$3,'2026-12-01','full_furnishing')`, [pid, home, V2]);
    // A completed V2 Task with the same title as Standard step A: no title matching may carry it over.
    await db.query(`INSERT INTO public.onboarding_tasks(id, property_id, title, status, assigned_to, due_on, completed_at, completed_by, evidence_note)
      VALUES ($1,$2,'Schedule the Handoff Meeting','complete',$3,'2026-11-20','2026-11-02T15:00:00Z',$3,'Met on site')`, [U(200 + i), home, who]);
    await db.query("INSERT INTO public.onboarding_tasks(id, property_id, title, status) VALUES ($1,$2,'Transfer trash service','open')", [U(300 + i), home]);
    await db.query("INSERT INTO public.onboarding_tasks(id, property_id, title, status, parent_task_id) VALUES ($1,$2,'Old V2 subtask','open',$3)", [U(400 + i), home, U(300 + i)]);
    // Archived before the move: must stay archived through the move and the undo.
    await db.query("INSERT INTO public.onboarding_tasks(id, property_id, title, status, archived_at, archived_by) VALUES ($1,$2,'Retired long ago','open','2026-10-01T00:00:00Z',$3)", [U(500 + i), home, who]);
  }
}
afterEach(async () => db?.close());

describe("Fix 5: move to the Standard plan, isolated PostgreSQL", () => {
  it("05a and 05b carry the same confirmed done list, empty for each of the four homes", () => {
    const a = listOf(DRY), b = listOf(MOVE);
    expect(a).toEqual(b);
    expect(b.map((e) => e.project)).toEqual(PROJECTS);
    expect(b.every((e) => e.done_steps.length === 0)).toBe(true);
    expect(MOVE.indexOf("CONFIRMED DONE LIST")).toBeLessThan(MOVE.indexOf("CREATE TABLE IF NOT EXISTS public.ao_plan_move_receipts"));
    expect(MOVE).not.toMatch(/regexp_replace\(t\.title/);
  });

  it("the dry run writes nothing and reports per home: Tasks to archive, steps to create, completed from the list, cards covered", async () => {
    await setup();
    const before = await fp();
    const empty = (await db.query<Record<string, unknown>>(DRY)).rows;
    expect(await fp()).toBe(before);
    expect(empty).toHaveLength(4);
    expect(empty[0]).toMatchObject({ home: "1 Home St", v2_tasks_to_archive: 3, standard_steps_to_create: 5, subtasks_to_create: 1,
      created_completed: 0, already_covered_cards: "none", stops: null });
    // Home 1 lists A and B: X01 (A only) and X03 (B; its other step is not on the plan) are covered, X02 (A and C) is not.
    const filled = (await db.query<Record<string, unknown>>(withList(DRY, { 0: [sA, sB], 1: [sA, sC] }))).rows;
    expect(await fp()).toBe(before);
    expect(filled[0]).toMatchObject({ created_completed: 2, already_covered_cards: "X01, X03", stops: null });
    expect(filled[1]).toMatchObject({ created_completed: 2, already_covered_cards: "X01, X02", stops: null });
    const bad = (await db.query<{ stops: string | null }>(withList(DRY, { 2: [sD, sH, U(65)] }))).rows;
    expect(bad[2]!.stops).toContain("needs a homeowner decision: Share the estimate with the owner");
    expect(bad[2]!.stops).toContain("handoff step: Mark ready for Operations");
    expect(bad[2]!.stops).toContain(`not on this home's Standard plan: ${U(65)}`);
  });

  it("with an empty list: every V2 Task is archived and recorded, every Standard step is created open as the plan assigns it", async () => {
    await setup();
    const home = U(10);
    const rowsBefore = await n("SELECT count(*)::int n FROM public.onboarding_tasks");
    await db.exec(MOVE);
    // Nothing deleted; each V2 Task archived with who and when, each recorded once.
    expect(await n("SELECT count(*)::int n FROM public.onboarding_tasks WHERE id = ANY($1::uuid[])", [[U(200), U(300), U(400), U(500)]])).toBe(4);
    const arch = await one<{ archived_at: string; archived_by: string; status: string; completed_by: string; evidence_note: string }>(
      "SELECT * FROM public.onboarding_tasks WHERE id=$1", [U(200)]);
    expect(arch.archived_at).not.toBeNull();
    expect(arch.archived_by).toBe(ACTOR);
    expect(arch).toMatchObject({ status: "complete", completed_by: who, evidence_note: "Met on site" });
    expect(await n(`SELECT count(*)::int n FROM public.onboarding_tasks WHERE property_id=$1 AND archived_at IS NULL
      AND id NOT IN (SELECT task_id FROM public.ao_plan_move_receipts WHERE kind IN ('created','created_done'))`, [home])).toBe(0);
    expect(await n("SELECT count(*)::int n FROM public.ao_plan_move_receipts WHERE kind='archived_v2' AND property_id=$1", [home])).toBe(3);
    expect(await n("SELECT count(*)::int n FROM public.ao_plan_move_receipts WHERE kind='archived_v2' AND task_id=$1", [U(500)])).toBe(0);
    // No title matching: Standard step A starts open even though a completed V2 Task had the same title.
    const a = await one<{ status: string; assigned_to: string; completed_at: string | null; due_on: string }>(
      "SELECT * FROM public.onboarding_tasks WHERE property_id=$1 AND template_task_id=$2 AND archived_at IS NULL", [home, sA]);
    expect(a).toMatchObject({ status: "open", assigned_to: U(70), completed_at: null });
    expect(String(a.due_on)).toContain("2026");
    expect(await n("SELECT count(*)::int n FROM public.onboarding_tasks WHERE archived_at IS NULL AND status='complete'")).toBe(0);
    // 5 applicable steps + 1 subtask per home; the pool step does not apply.
    expect(await n("SELECT count(*)::int n FROM public.onboarding_tasks") - rowsBefore).toBe(24);
    expect(await n("SELECT count(*)::int n FROM public.onboarding_tasks WHERE template_task_id=$1", [U(65)])).toBe(0);
    expect((await one<{ v: string }>("SELECT template_version_id v FROM public.onboarding_projects WHERE id=$1", [PROJECTS[0]])).v).toBe(STD);
    expect(await n("SELECT count(*)::int n FROM public.onboarding_task_file_links")).toBe(4);
  });

  it("listed steps are created completed with the COO note; their subtasks too; others stay open", async () => {
    await setup();
    const home = U(10);
    await db.exec(withList(MOVE, { 0: [sA, sB] }));
    const a = await one<{ status: string; completed_by: string; completed_at: string; evidence_note: string }>(
      "SELECT * FROM public.onboarding_tasks WHERE property_id=$1 AND template_task_id=$2", [home, sA]);
    expect(a).toMatchObject({ status: "complete", completed_by: ACTOR, evidence_note: NOTE });
    expect(a.completed_at).not.toBeNull();
    const sub = await one<{ status: string; evidence_note: string }>(
      "SELECT s.* FROM public.onboarding_tasks s JOIN public.onboarding_tasks p ON p.id = s.parent_task_id WHERE p.property_id=$1 AND p.template_task_id=$2", [home, sB]);
    expect(sub).toMatchObject({ status: "complete", evidence_note: NOTE });
    expect((await one<{ status: string }>("SELECT status FROM public.onboarding_tasks WHERE property_id=$1 AND template_task_id=$2", [home, sC])).status).toBe("open");
    expect(await n("SELECT count(*)::int n FROM public.onboarding_tasks WHERE property_id=$1 AND archived_at IS NULL AND status='complete'", [U(11)])).toBe(0);
    expect(await n("SELECT count(*)::int n FROM public.ao_plan_move_receipts WHERE kind='created_done' AND property_id=$1", [home])).toBe(3);
  });

  it("a listed step needing a homeowner decision, a handoff step or a step not on the plan stops the move with nothing written", async () => {
    for (const steps of [[sD], [sH], [U(65)], [U(999)]]) {
      await setup();
      const before = await fp();
      await expect(db.exec(`BEGIN; ${withList(MOVE, { 1: steps })} COMMIT;`)).rejects.toThrow();
      await db.exec("ROLLBACK").catch(() => undefined);
      expect(await fp()).toBe(before);
      await db.close();
    }
    await setup();
  }, 60_000);

  it("a home whose handoff is already accepted stops the move with nothing written, and the dry run says so", async () => {
    await setup();
    await db.query("UPDATE public.onboarding_projects SET handoff_state='accepted', status='complete' WHERE id=$1", [PROJECTS[1]]);
    const before = await fp();
    const rows = (await db.query<{ stops: string | null }>(DRY)).rows;
    expect(rows[1]!.stops).toContain("handoff already accepted");
    await expect(db.exec(`BEGIN; ${MOVE} COMMIT;`)).rejects.toThrow(/already accepted/);
    await db.exec("ROLLBACK").catch(() => undefined);
    expect(await fp()).toBe(before);
  });

  it("a repeat changes nothing and the undo un-archives exactly the V2 Tasks from the receipts", async () => {
    await setup();
    const before = await one<{ h: string }>("SELECT md5(string_agg(t::text,'|' ORDER BY id)) h FROM (SELECT id, title, status, archived_at, archived_by, completed_at, completed_by, evidence_note FROM public.onboarding_tasks) t");
    await db.exec(withList(MOVE, { 0: [sA] }));
    const after = await fp();
    await db.exec(withList(MOVE, { 0: [sA] }));
    expect(await fp()).toBe(after);
    await db.exec(UNDO);
    expect(await one<{ h: string }>(`SELECT md5(string_agg(t::text,'|' ORDER BY id)) h FROM (SELECT id, title, status, archived_at, archived_by, completed_at, completed_by, evidence_note
      FROM public.onboarding_tasks WHERE id NOT IN (SELECT task_id FROM public.ao_plan_move_receipts WHERE kind IN ('created','created_done'))) t`)).toEqual(before);
    expect(await n(`SELECT count(*)::int n FROM public.onboarding_tasks WHERE id IN (SELECT task_id FROM public.ao_plan_move_receipts WHERE kind IN ('created','created_done'))
      AND (archived_at IS NULL OR archived_by IS NULL)`)).toBe(0);
    expect(await n("SELECT count(*)::int n FROM public.onboarding_tasks WHERE id = ANY($1::uuid[]) AND archived_at IS NOT NULL", [[U(500), U(501), U(502), U(503)]])).toBe(4);
    expect(await n("SELECT count(*)::int n FROM public.onboarding_projects WHERE template_version_id=$1", [V2])).toBe(4);
  });
});
