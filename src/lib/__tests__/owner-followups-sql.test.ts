import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const pm = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const admin = "00000000-0000-4000-8000-000000000003";
const prog = "00000000-0000-4000-8000-000000000010";
const home = "00000000-0000-4000-8000-000000000020";
let db: PGlite;

async function as<T>(user: string, sql: string) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.test_uid','${user}',false);`);
  try { return (await db.query<T>(sql)).rows; } finally { await db.exec("RESET ROLE"); }
}

describe("staged owner follow-up table and close function", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.test_uid',true),'')::uuid$$;
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${admin}'::uuid AND $2='admin' $$;
      CREATE TABLE public.owner_programs(id uuid PRIMARY KEY); INSERT INTO public.owner_programs VALUES('${prog}');
      CREATE TABLE public.properties(id uuid PRIMARY KEY); INSERT INTO public.properties VALUES('${home}');
      CREATE TABLE public.staff_notifications(id uuid DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, read_at timestamptz);`);
    await db.exec(readFileSync("docs/pending/owner-behind/01_followup_tasks.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });

  const insert = (id: string) => db.exec(`INSERT INTO public.owner_followup_tasks(id,program_id,property_id,assigned_to,route_reason,item_count,title,link_path)
    VALUES('${id}','${prog}','${home}','${pm}','project_manager',2,'t','/p')`);

  it("only one open follow-up per home", async () => {
    await insert("00000000-0000-4000-8000-0000000000a1");
    await expect(insert("00000000-0000-4000-8000-0000000000a2")).rejects.toThrow(/unique|duplicate/);
  });
  it("another teammate cannot see or close it", async () => {
    expect(await as(other, "SELECT id FROM public.owner_followup_tasks")).toHaveLength(0);
    await expect(as(other, "SELECT public.close_owner_followup('00000000-0000-4000-8000-0000000000a1')")).rejects.toThrow(/assigned teammate/);
  });
  it("Reached out records who and when, then a new one may open", async () => {
    await db.exec(`INSERT INTO public.staff_notifications(entity_type,entity_id) VALUES('owner_followup_task','00000000-0000-4000-8000-0000000000a1')`);
    await as(pm, "SELECT public.close_owner_followup('00000000-0000-4000-8000-0000000000a1')");
    const r = (await db.query<{ status: string; closed_by: string; closed_at: string | null; close_note: string }>(
      "SELECT status, closed_by, closed_at, close_note FROM public.owner_followup_tasks")).rows[0]!;
    expect(r.status).toBe("closed");
    expect(r.closed_by).toBe(pm);
    expect(r.closed_at).not.toBeNull();
    expect(r.close_note).toBe("Reached out");
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM public.staff_notifications WHERE read_at IS NOT NULL")).rows[0]!.n).toBe(1);
    await insert("00000000-0000-4000-8000-0000000000a3");
  });
  it("no anon or PUBLIC access to the new table or function; no anon SECURITY DEFINER added", async () => {
    const r = (await db.query<Record<string, boolean>>(`SELECT
      has_function_privilege('anon','public.close_owner_followup(uuid)','EXECUTE') anon_fn,
      EXISTS(SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid='public.close_owner_followup(uuid)'::regprocedure AND a.grantee=0) pub_fn,
      has_table_privilege('anon','public.owner_followup_tasks','SELECT') anon_tbl,
      has_table_privilege('authenticated','public.owner_followup_tasks','INSERT') auth_insert,
      has_function_privilege('authenticated','public.close_owner_followup(uuid)','EXECUTE') auth_fn`)).rows[0];
    expect(r).toEqual({ anon_fn: false, pub_fn: false, anon_tbl: false, auth_insert: false, auth_fn: true });
    const exposure = await db.query<{ n: number }>(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
      WHERE s.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')`);
    expect(exposure.rows[0]!.n).toBe(0);
  });
  it("signed-out callers are refused", async () => {
    await db.exec("SET ROLE authenticated; SELECT set_config('request.test_uid','',false);");
    try { await expect(db.query("SELECT public.close_owner_followup('00000000-0000-4000-8000-0000000000a3')")).rejects.toThrow(/Sign in/); }
    finally { await db.exec("RESET ROLE"); }
  });
});
