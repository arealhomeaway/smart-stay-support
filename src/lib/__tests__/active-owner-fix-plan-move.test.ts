// Fix 5 (Nov 11): the V2 to Standard dry run writes nothing, and the staged move keeps completed work
// completed (original who, when and evidence), adds the missing Standard steps, leaves unmatched V2 Tasks
// alone, repeats safely and undoes exactly. Isolated PostgreSQL only.
import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/active-owner-fix";
const read = (p: string) => readFileSync(p, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STD = "94ef41f6-b195-4b94-b09c-830f706f5d1a", V2 = U(900), STD_T = U(901), V2_T = U(902);
const PROJECTS = ["0c2d2b1d-6967-4b2a-a973-2685c06cfd3b", "94338f4a-4a97-4268-869a-79ed103bbc8b",
  "add4e549-2929-42db-b5fd-131787088768", "11bb7e6a-cb17-4b6d-b27f-df9b505d4400"];
const done = U(50), who = U(51), sA = U(60), sB = U(61), sC = U(62);
let db: PGlite;
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!;
const n = async (sql: string, p: unknown[] = []) => (await one<{ n: number }>(sql, p)).n;
const fp = async () => (await one<{ h: string }>(`SELECT md5(coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_tasks t),'') ||
  coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_projects t),'')) h`)).h;

describe("Fix 5: move to the Standard plan, isolated PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private; CREATE SCHEMA auth;
      CREATE TYPE public.app_role AS ENUM ('admin');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;`);
    await db.exec(read("src/lib/__tests__/fixtures/active-owner-fix-schema.sql"));
    await db.exec(`
      CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
      CREATE FUNCTION public.format_property_label(jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('primary', $1->>'name') $$;
      CREATE TABLE public.onboarding_templates(id uuid PRIMARY KEY, key text, name text);
      CREATE TABLE public.onboarding_template_versions(id uuid PRIMARY KEY, template_id uuid, version int, snapshot jsonb);
      CREATE TABLE public.onboarding_task_file_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, receiving_task_id uuid, source_task_id uuid, origin text, created_by uuid, UNIQUE(receiving_task_id, source_task_id));
      CREATE FUNCTION public.plan_step_applies(jsonb, text, text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
      CREATE FUNCTION public.project_role_assignee(uuid, text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${U(70)}'::uuid $$;
      CREATE FUNCTION public.plan_due_from_rule(date, int, text) RETURNS date LANGUAGE sql STABLE AS $$ SELECT $1 + coalesce($2,0) $$;
      INSERT INTO public.onboarding_templates VALUES ('${STD_T}','arha_onboarding_standard','Standard'),('${V2_T}','arha_v2','V2');
      INSERT INTO public.onboarding_template_versions VALUES ('${V2}','${V2_T}',1,'{"steps":[]}'),
        ('${STD}','${STD_T}',4,'{"steps":[
          {"id":"${sA}","title":"Schedule the handoff meeting","stage":"launch","functional_role":"project_manager","offset_days":5,"schedule_anchor":"planned_closing","show_files_from":["${sB}"]},
          {"id":"${sB}","title":"Transfer trash service","stage":"setup","subtasks":["Call the city"]},
          {"id":"${sC}","title":"Activate the Roku devices","stage":"launch","functional_role":"utilities"}]}');
      INSERT INTO public.owner_programs(id, property_id, owner_user_id, status) VALUES ('${U(80)}', NULL, NULL, 'active');`);
    for (const [i, pid] of PROJECTS.entries()) {
      const home = U(10 + i);
      await db.query("INSERT INTO public.properties(id, name) VALUES ($1, $2)", [home, `${i + 1} Home St`]);
      await db.query("INSERT INTO public.owner_program_properties(program_id, property_id) VALUES ($1,$2)", [U(80), home]);
      await db.query(`INSERT INTO public.onboarding_projects(id, property_id, template_version_id, planned_closing_on, furnishing_scope)
        VALUES ($1,$2,$3,'2026-12-01','full_furnishing')`, [pid, home, V2]);
      await db.query(`INSERT INTO public.onboarding_tasks(id, property_id, title, status, assigned_to, due_on, completed_at, completed_by, evidence_note)
        VALUES ($1,$2,'Schedule the Handoff Meeting','complete',$3,'2026-11-20','2026-11-02T15:00:00Z',$4,'Met on site')`,
        [i === 0 ? done : U(200 + i), home, who, who]);
      await db.query("INSERT INTO public.onboarding_tasks(id, property_id, title, status) VALUES ($1,$2,'Transfer trash service','open')", [U(300 + i), home]);
      await db.query("INSERT INTO public.onboarding_tasks(id, property_id, title, status) VALUES ($1,$2,'Old V2 only step','open')", [U(400 + i), home]);
    }
  });
  afterAll(async () => db?.close());

  it("the dry run writes nothing and lists mapped, unmatched and new steps", async () => {
    const before = await fp();
    const rows = (await db.query<{ kind: string }>(read(`${DIR}/05a_v2_to_standard_dry_run.sql`))).rows;
    expect(await fp()).toBe(before);
    const kinds = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.kind]: (m[r.kind] ?? 0) + 1 }), {});
    expect(kinds).toEqual({ mapped: 8, no_match: 4, new_step: 4 });
  });

  it("completed work stays completed with its original who, when and evidence; unmatched V2 Tasks stay as they are", async () => {
    const home = U(10);
    const oldOnly = await one<Record<string, unknown>>("SELECT * FROM public.onboarding_tasks WHERE id=$1", [U(400)]);
    await db.exec(read(`${DIR}/05b_v2_to_standard_move.sql`));
    const moved = await one<{ status: string; completed_by: string; completed_at: string; evidence_note: string; assigned_to: string; due_on: string }>(
      "SELECT * FROM public.onboarding_tasks WHERE property_id=$1 AND template_task_id=$2 AND archived_at IS NULL", [home, sA]);
    expect(moved.status).toBe("complete");
    expect(moved.completed_by).toBe(who);
    expect(new Date(moved.completed_at).toISOString()).toBe("2026-11-02T15:00:00.000Z");
    expect(moved.evidence_note).toBe("Met on site");
    expect(moved.assigned_to).toBe(who);
    expect(String(moved.due_on)).toContain("2026");
    expect((await one<{ archived_at: string | null }>("SELECT archived_at FROM public.onboarding_tasks WHERE id=$1", [done])).archived_at).not.toBeNull();
    expect(await one<Record<string, unknown>>("SELECT * FROM public.onboarding_tasks WHERE id=$1", [U(400)])).toEqual(oldOnly);
    const roku = await one<{ status: string; assigned_to: string }>("SELECT * FROM public.onboarding_tasks WHERE property_id=$1 AND template_task_id=$2", [home, sC]);
    expect(roku).toMatchObject({ status: "open", assigned_to: U(70) });
    expect((await one<{ v: string }>("SELECT template_version_id v FROM public.onboarding_projects WHERE id=$1", [PROJECTS[0]])).v).toBe(STD);
    expect(await n("SELECT count(*)::int n FROM public.onboarding_task_file_links")).toBe(4);
  });

  it("a repeat changes nothing and the undo puts every home back exactly", async () => {
    const after = await fp();
    await db.exec(read(`${DIR}/05b_v2_to_standard_move.sql`));
    expect(await fp()).toBe(after);
    await db.exec(read(`${DIR}/05b_v2_to_standard_move.undo.sql`));
    expect(await n("SELECT count(*)::int n FROM public.onboarding_tasks WHERE archived_at IS NULL AND template_task_id IS NOT NULL")).toBe(0);
    expect(await n("SELECT count(*)::int n FROM public.onboarding_tasks WHERE archived_at IS NULL")).toBe(12);
    expect(await n("SELECT count(*)::int n FROM public.onboarding_projects WHERE template_version_id=$1", [V2])).toBe(4);
  });
});
