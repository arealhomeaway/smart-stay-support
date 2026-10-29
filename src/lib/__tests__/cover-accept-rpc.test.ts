import { beforeAll, beforeEach, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const holder = "00000000-0000-4000-8000-000000000001";
const cover = "00000000-0000-4000-8000-000000000002";
const pc = "00000000-0000-4000-8000-000000000003";
const admin = "00000000-0000-4000-8000-000000000004";
const director = "00000000-0000-4000-8000-000000000005";
const home = "00000000-0000-4000-8000-000000000010";
const project = "00000000-0000-4000-8000-000000000011";
let db: PGlite;
const act = (step = "accepted") => db.query("select perform_handoff_step($1,$2,'[]',false)", [project, step]);
const as = (id: string) => db.query("select set_config('test.actor',$1,false)", [id]);

describe("exact captured handoff acceptance with active cover, isolated PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync("supabase/tests/fixtures/home_task_bulk_edit_schema.sql", "utf8"));
    await db.exec(`CREATE ROLE service_role;
      CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text);
      CREATE TABLE functional_roles(code text PRIMARY KEY,active boolean DEFAULT true,current_seat_holder uuid);
      CREATE TABLE onboarding_templates(id uuid PRIMARY KEY,name text,is_archived boolean DEFAULT false);
      CREATE TABLE onboarding_template_tasks(id uuid PRIMARY KEY,template_id uuid,title text,is_active boolean DEFAULT true,sort_order int DEFAULT 0);
      ALTER TABLE properties ADD COLUMN is_demo boolean DEFAULT false;
      ALTER TABLE onboarding_tasks ADD COLUMN template_task_id uuid,ADD COLUMN completed_by uuid;
      ALTER TABLE onboarding_projects ADD COLUMN handoff_state text DEFAULT 'ready',ADD COLUMN ready_for_ops_at timestamptz,ADD COLUMN ready_for_ops_by uuid,ADD COLUMN ops_accepted_at timestamptz,ADD COLUMN ops_accepted_by uuid,ADD COLUMN completed_at timestamptz;
      ALTER TABLE onboarding_project_events ADD COLUMN property_id uuid,ADD COLUMN summary text,ADD COLUMN detail text,ADD COLUMN prior_value text,ADD COLUMN actor uuid,ADD COLUMN is_demo boolean;
      CREATE TABLE tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid,title text,description text,status text,priority text,category text,entry_kind text,guest_in_residence boolean,initiator_type text,record_type text,functional_role_code text,due_at timestamptz,source_channel text,source_reference text,created_by uuid,record_owner uuid,accountable_owner uuid,reported_at timestamptz,is_demo boolean,archived_at timestamptz);
      CREATE TABLE ticket_activity(ticket_id uuid,actor_id uuid,event_type text,note text);
      CREATE TABLE coverage_overrides(role_code text,kind text,user_id uuid,starts_at timestamptz,ends_at timestamptz,created_at timestamptz DEFAULT now());
      CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
      CREATE FUNCTION is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT auth.uid() IS NOT NULL$$;
      CREATE FUNCTION is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT auth.uid() IS NOT NULL$$;
      CREATE FUNCTION seat_holder(text) RETURNS uuid LANGUAGE sql AS $$SELECT current_seat_holder FROM functional_roles WHERE code=$1 AND active LIMIT 1$$;
      CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT $1='${admin}'::uuid AND $2='admin'$$;
      CREATE FUNCTION seat_override_at(_role_code text,_at timestamptz DEFAULT now()) RETURNS TABLE(kind text,user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$SELECT o.kind,o.user_id FROM coverage_overrides o WHERE o.role_code=_role_code AND _at>=o.starts_at AND _at<o.ends_at ORDER BY o.created_at DESC LIMIT 1$$;`);
    await db.exec(readFileSync("docs/pending/onboarding-cleanup/0168_handoff_step_duplicates.sql", "utf8"));
    for (const f of ["0170_standard_schema.sql", "0171_home_status.sql", "0172_no_block_carryover.sql"]) await db.exec(readFileSync(`docs/pending/handoff-standard/${f}`, "utf8"));
    await db.exec(readFileSync("docs/pending/cover-accept/apply.sql", "utf8"));
    await db.query("insert into functional_roles values('director_ops',true,$1),('onboarding_director',true,$2)", [holder, director]);
    await db.query("insert into properties(id) values($1)", [home]);
    await db.query("insert into onboarding_projects(id,property_id,director) values($1,$2,$3)", [project,home,director]);
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec("truncate coverage_overrides, handoff_step_history, audit_log");
    await db.query("update onboarding_projects set handoff_state='ready',status='active' where id=$1",[project]);
  });
  for (const [name,id] of [["seat holder",holder],["Admin",admin]] as const) it(`${name} can accept and writes history`,async()=>{
    await as(id); await act();
    expect((await db.query<{actor_id:string;step:string}>("select actor_id,step from handoff_step_history")).rows).toEqual([{actor_id:id,step:"accepted"}]);
  });
  it("active director_ops cover can accept",async()=>{
    await db.query("insert into coverage_overrides values('director_ops','cover',$1,now()-interval '1 hour',now()+interval '1 hour',now())",[cover]);
    await as(cover); await act();
    expect((await db.query<{handoff_state:string}>("select handoff_state from onboarding_projects")).rows[0]?.handoff_state).toBe("accepted");
  });
  it("expired cover cannot accept",async()=>{
    await db.query("insert into coverage_overrides values('director_ops','cover',$1,now()-interval '2 hours',now()-interval '1 hour',now())",[cover]);
    await as(cover); await expect(act()).rejects.toThrow("Operations Director");
    expect((await db.query<{n:number}>("select count(*)::int n from handoff_step_history")).rows[0]?.n).toBe(0);
  });
  it("PC cannot accept",async()=>{await as(pc);await expect(act()).rejects.toThrow("Operations Director");});
  it("signed-out caller cannot accept",async()=>{await as("");await expect(act()).rejects.toThrow("Project not available");});
  it("non-cover override cannot accept",async()=>{
    await db.query("insert into coverage_overrides values('director_ops','away',$1,now()-interval '1 hour',now()+interval '1 hour',now())",[cover]);
    await as(cover);await expect(act()).rejects.toThrow("Operations Director");
  });
  it("Mark ready still refuses the Operations cover",async()=>{
    await db.query("insert into coverage_overrides values('director_ops','cover',$1,now()-interval '1 hour',now()+interval '1 hour',now())",[cover]);
    await db.exec("update onboarding_projects set handoff_state='in_progress'");await as(cover);
    await expect(act("ready")).rejects.toThrow("Onboarding Director");
  });
  it("Mark ready still allows the Onboarding Director",async()=>{
    await db.exec("update onboarding_projects set handoff_state='in_progress'");await as(director);await act("ready");
    expect((await db.query<{handoff_state:string}>("select handoff_state from onboarding_projects")).rows[0]?.handoff_state).toBe("ready");
  });
});