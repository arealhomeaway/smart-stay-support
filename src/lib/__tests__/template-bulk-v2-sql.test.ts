import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const tpl = "00000000-0000-4000-8000-000000000301";
const actor = "00000000-0000-4000-8000-000000000302";
const a = "00000000-0000-4000-8000-000000000401";
const b = "00000000-0000-4000-8000-000000000402";
const c = "00000000-0000-4000-8000-000000000403";
let db: PGlite;

async function run(sql: string, values: unknown[]) {
  return (await db.query<{ r: { changed: number; skipped: { stepId: string }[]; auditRecorded: boolean } }>(`SELECT public.bulk_update_onboarding_template_steps_v2(${sql}) AS r`, values)).rows[0]!.r;
}
const row = async (id: string) => (await db.query<Record<string, unknown>>("SELECT * FROM public.onboarding_template_tasks WHERE id=$1", [id])).rows[0]!;

describe("template bulk edit v2 (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("CREATE ROLE service_role;");
    await db.exec(readFileSync("supabase/tests/fixtures/template_bulk_edit_schema.sql", "utf8"));
    await db.exec("ALTER TABLE public.onboarding_template_tasks ADD COLUMN condition jsonb, ADD COLUMN owner_dependency text, ADD COLUMN is_active boolean NOT NULL DEFAULT true;");
    await db.exec(readFileSync("docs/pending/bulk-edit/0164_bulk_template_step_edit.sql", "utf8"));
    await db.exec(readFileSync("docs/pending/template-bulk-v2/01_bulk_v2.sql", "utf8"));
  });
  afterAll(async () => db.close());
  beforeEach(async () => {
    await db.exec("TRUNCATE public.audit_log, public.onboarding_tasks, public.onboarding_template_tasks, public.onboarding_template_stages, public.onboarding_templates");
    await db.query("SELECT set_config('test.actor',$1,false), set_config('test.leader','true',false)", [actor]);
    await db.query("INSERT INTO public.onboarding_templates(id,name) VALUES ($1,'Practice')", [tpl]);
    await db.query(`INSERT INTO public.onboarding_template_tasks(id,template_id,title,stage,sort_order,blocks_handoff) VALUES
      ($1,$4,'One','Intake',10,false),($2,$4,'Two','Intake',20,true),($3,$4,'Three','Intake',30,false)`, [a, b, c, tpl]);
    await db.query("INSERT INTO public.onboarding_tasks(id,template_task_id,title) VALUES ('00000000-0000-4000-8000-000000000999',$1,'Home task')", [a]);
  });

  it("sets a condition on several steps in one audited call", async () => {
    const r = await run("_template_id:=$1,_step_ids:=$2,_set_condition:=true,_condition:=$3::jsonb", [tpl, [a, c], JSON.stringify({ all: [{ field: "module", value: "pool" }] })]);
    expect(r.changed).toBe(2);
    expect((await row(a))["condition"]).toEqual({ all: [{ field: "module", value: "pool" }] });
    expect((await db.query("SELECT count(*)::int n FROM public.audit_log")).rows[0]).toEqual({ n: 1 });
  });
  it("rejects an unknown condition and changes nothing", async () => {
    await expect(run("_template_id:=$1,_step_ids:=$2,_set_condition:=true,_condition:=$3::jsonb", [tpl, [a], JSON.stringify({ all: [{ field: "module", value: "spa" }] })])).rejects.toThrow("Unsupported condition.");
    expect((await row(a))["condition"]).toBeNull();
  });
  it("turns steps inactive", async () => {
    const r = await run("_template_id:=$1,_step_ids:=$2,_set_is_active:=true,_is_active:=false", [tpl, [a, b]]);
    expect(r.changed).toBe(2);
    expect((await row(b))["is_active"]).toBe(false);
  });
  it("Business Decision sets homeowner approval and skips handoff-blocking steps", async () => {
    const r = await run("_template_id:=$1,_step_ids:=$2,_set_owner_dependency:=true,_owner_dependency:='business_decision'", [tpl, [a, b]]);
    expect(r.changed).toBe(1);
    expect(r.skipped.map((s) => s.stepId)).toEqual([b]);
    expect((await row(a))["requires_owner_approval"]).toBe(true);
    expect((await row(b))["owner_dependency"]).toBeNull();
  });
  it("refuses non-leaders", async () => {
    await db.query("SELECT set_config('test.leader','false',false)");
    await expect(run("_template_id:=$1,_step_ids:=$2,_set_is_active:=true,_is_active:=false", [tpl, [a]])).rejects.toThrow("Only the Onboarding Director");
  });
  it("never touches home plan Tasks", async () => {
    await run("_template_id:=$1,_step_ids:=$2,_set_is_active:=true,_is_active:=false", [tpl, [a]]);
    expect((await db.query("SELECT title FROM public.onboarding_tasks")).rows).toEqual([{ title: "Home task" }]);
  });
  it("no anon or PUBLIC execute, and undo removes both functions", async () => {
    const acl = (await db.query<{ acl: string }>("SELECT proacl::text acl FROM pg_proc WHERE proname='bulk_update_onboarding_template_steps_v2'")).rows[0]!.acl;
    expect(acl.includes("anon=")).toBe(false);
    expect(/(^|[{,])=X/.test(acl)).toBe(false);
    await db.exec(readFileSync("docs/pending/template-bulk-v2/undo.sql", "utf8"));
    expect((await db.query("SELECT count(*)::int n FROM pg_proc WHERE proname IN ('bulk_update_onboarding_template_steps_v2','template_bulk_v2_ready')")).rows[0]).toEqual({ n: 0 });
    await db.exec(readFileSync("docs/pending/template-bulk-v2/01_bulk_v2.sql", "utf8"));
  });
});
