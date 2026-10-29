import { beforeAll, beforeEach, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const dirOps = "00000000-0000-4000-8000-000000000001";
const cover = "00000000-0000-4000-8000-000000000002";
const pc = "00000000-0000-4000-8000-000000000003";
const admin = "00000000-0000-4000-8000-000000000004";
const director = "00000000-0000-4000-8000-000000000005";
const homeowner = "00000000-0000-4000-8000-000000000006";
const home = "00000000-0000-4000-8000-000000000010";
const project = "00000000-0000-4000-8000-000000000011";
const demoHome = "00000000-0000-4000-8000-000000000020";
const demoProject = "00000000-0000-4000-8000-000000000021";
const bareHome = "00000000-0000-4000-8000-000000000030";
const bareProject = "00000000-0000-4000-8000-000000000031";
const program = "00000000-0000-4000-8000-000000000040";
const demoProgram = "00000000-0000-4000-8000-000000000041";
const tpl = "00000000-0000-4000-8000-000000000050";
const lib = "00000000-0000-4000-8000-000000000051";

let db: PGlite;
const as = (id: string) => db.query("select set_config('test.actor',$1,false)", [id]);
const accept = (p: string) => db.query("select perform_handoff_step($1,'accepted','[]',false)", [p]);
const n = async (sql: string) => (await db.query<{ n: number }>(`select count(*)::int n from ${sql}`)).rows[0]?.n;
const addItem = async (days: number, kind = "template", src = tpl) =>
  (await db.query<{ id: string }>("select after_handoff_plan_save(null,null,$1,$2,$3,null) id", [kind, src, days])).rows[0]?.id;

describe("after-handoff owner plan, isolated PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync("supabase/tests/fixtures/home_task_bulk_edit_schema.sql", "utf8"));
    await db.exec(`CREATE ROLE service_role;
      CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text);
      CREATE TABLE user_roles(user_id uuid,role text);
      CREATE TABLE functional_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text UNIQUE,name text,team text,active boolean DEFAULT true,current_seat_holder uuid,current_seat_name text,sort_order int DEFAULT 0);
      CREATE TABLE onboarding_templates(id uuid PRIMARY KEY,name text,is_archived boolean DEFAULT false);
      CREATE TABLE onboarding_template_tasks(id uuid PRIMARY KEY,template_id uuid,title text,is_active boolean DEFAULT true,sort_order int DEFAULT 0);
      ALTER TABLE properties ADD COLUMN is_demo boolean DEFAULT false;
      ALTER TABLE work_items ADD COLUMN id uuid UNIQUE DEFAULT gen_random_uuid();
      ALTER TABLE onboarding_tasks ADD COLUMN template_task_id uuid,ADD COLUMN completed_by uuid;
      ALTER TABLE onboarding_projects ADD COLUMN handoff_state text DEFAULT 'ready',ADD COLUMN ready_for_ops_at timestamptz,ADD COLUMN ready_for_ops_by uuid,ADD COLUMN ops_accepted_at timestamptz,ADD COLUMN ops_accepted_by uuid,ADD COLUMN completed_at timestamptz;
      ALTER TABLE onboarding_project_events ADD COLUMN property_id uuid,ADD COLUMN summary text,ADD COLUMN detail text,ADD COLUMN prior_value text,ADD COLUMN actor uuid,ADD COLUMN is_demo boolean;
      CREATE TABLE tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid,title text,description text,status text,priority text,category text,entry_kind text,guest_in_residence boolean,initiator_type text,record_type text,functional_role_code text,due_at timestamptz,source_channel text,source_reference text,created_by uuid,record_owner uuid,accountable_owner uuid,reported_at timestamptz,is_demo boolean,archived_at timestamptz);
      CREATE TABLE ticket_activity(ticket_id uuid,actor_id uuid,event_type text,note text);
      CREATE TABLE coverage_overrides(role_code text,kind text,user_id uuid,starts_at timestamptz,ends_at timestamptz,created_at timestamptz DEFAULT now());
      CREATE TABLE owner_programs(id uuid PRIMARY KEY,property_id uuid,owner_name text,status text,is_demo boolean DEFAULT false,archived_at timestamptz,created_at timestamptz DEFAULT now());
      CREATE TABLE owner_program_properties(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid,property_id uuid,is_demo boolean DEFAULT false,archived_at timestamptz);
      CREATE TABLE owner_task_templates(id uuid PRIMARY KEY,title text,active boolean DEFAULT true);
      CREATE TABLE owner_opportunity_library(id uuid PRIMARY KEY,title text,active boolean DEFAULT true);
      CREATE TABLE owner_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE email_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
      CREATE FUNCTION is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT auth.uid() IS NOT NULL$$;
      CREATE FUNCTION is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT auth.uid() IS NOT NULL$$;
      CREATE FUNCTION is_internal_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','manager','tech','onboarding'))$$;
      CREATE FUNCTION seat_holder(text) RETURNS uuid LANGUAGE sql AS $$SELECT current_seat_holder FROM functional_roles WHERE code=$1 AND active LIMIT 1$$;
      CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT $1='${admin}'::uuid AND $2='admin'$$;
      CREATE FUNCTION seat_override_at(_role_code text,_at timestamptz DEFAULT now()) RETURNS TABLE(kind text,user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$SELECT o.kind,o.user_id FROM coverage_overrides o WHERE o.role_code=_role_code AND _at>=o.starts_at AND _at<o.ends_at ORDER BY o.created_at DESC LIMIT 1$$;`);
    await db.exec(readFileSync("docs/pending/onboarding-cleanup/0168_handoff_step_duplicates.sql", "utf8"));
    for (const f of ["0170_standard_schema.sql", "0171_home_status.sql", "0172_no_block_carryover.sql"]) await db.exec(readFileSync(`docs/pending/handoff-standard/${f}`, "utf8"));
    await db.exec(readFileSync("docs/pending/after-handoff/undo-perform_handoff_step.sql", "utf8"));
    await db.query("insert into functional_roles(code,name,team,current_seat_holder) values('director_ops','Director of Operations','leadership',$1),('onboarding_director','Onboarding Director','onboarding',$2)", [dirOps, director]);
    await db.exec(readFileSync("docs/pending/after-handoff/01_plan_and_schedule.sql", "utf8"));
    await db.exec(readFileSync("docs/pending/after-handoff/02_perform_handoff_step.sql", "utf8"));
    await db.query("insert into user_roles values($1,'admin'),($2,'manager'),($3,'manager'),($4,'tech'),($5,'onboarding'),($6,'owner')", [admin, dirOps, cover, pc, director, homeowner]);
    await db.query("insert into properties(id,is_demo) values($1,false),($2,true),($3,false)", [home, demoHome, bareHome]);
    await db.query("insert into onboarding_projects(id,property_id,director) values($1,$2,$7),($3,$4,$7),($5,$6,$7)", [project, home, demoProject, demoHome, bareProject, bareHome, director]);
    await db.query("insert into owner_programs(id,property_id,status,is_demo) values($1,$2,'active',false),($3,$4,'active',true)", [program, home, demoProgram, demoHome]);
    await db.query("insert into owner_task_templates values($1,'Review welcome guide',true)", [tpl]);
    await db.query("insert into owner_opportunity_library values($1,'Neighborhood guide',true)", [lib]);
    await db.exec("GRANT USAGE ON SCHEMA auth, private TO authenticated");
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec("truncate after_handoff_schedule_events, after_handoff_schedule, after_handoff_plan_events, after_handoff_plan_items, coverage_overrides, handoff_step_history CASCADE");
    await db.exec("update onboarding_projects set handoff_state='ready',status='active'");
  });

  it("creates the follow-up seat held by the Director of Operations", async () => {
    const r = (await db.query<{ team: string; current_seat_holder: string; name: string }>("select team,current_seat_holder,name from functional_roles where code='active_owner_followup'")).rows;
    expect(r).toEqual([{ team: "operations", current_seat_holder: dirOps, name: "Active Owner follow-up" }]);
  });

  it("acceptance schedules one row per active item, retry safe, America/Chicago day", async () => {
    await as(admin);
    const a = await addItem(0); await addItem(3, "library", lib);
    const off = await addItem(5); await db.query("select after_handoff_plan_set_active($1,false)", [off]);
    await as(dirOps); await accept(project); await accept(project);
    await db.query("select private.schedule_after_handoff($1,$2)", [project, home]);
    const rows = (await db.query<{ plan_item_id: string; d: number; status: string; program_id: string }>(
      "select plan_item_id, send_on-(now() at time zone 'America/Chicago')::date d, status, program_id from after_handoff_schedule order by send_on")).rows;
    expect(rows.map((r) => r.d)).toEqual([0, 3]);
    expect(rows[0]?.plan_item_id).toBe(a ?? "");
    expect(rows.every((r) => r.status === "scheduled" && r.program_id === program)).toBe(true);
    expect(await n("after_handoff_schedule_events where action='scheduled'")).toBe(2);
  });

  it("demo homes get nothing", async () => {
    await as(admin); await addItem(0);
    await db.query("update properties set is_demo=false where id=$1", [demoHome]);
    await db.query("update properties set is_demo=true where id=$1", [demoHome]);
    await db.query("select private.schedule_after_handoff($1,$2)", [demoProject, demoHome]);
    expect(await n("after_handoff_schedule")).toBe(0);
  });

  it("homes without an active program get none and a history note", async () => {
    await as(admin); await addItem(0); await as(dirOps); await accept(bareProject);
    expect(await n("after_handoff_schedule")).toBe(0);
    const ev = (await db.query<{ note: string }>("select note from after_handoff_schedule_events where property_id=$1", [bareHome])).rows;
    expect(ev).toEqual([{ note: "No Active Owner program at handoff; nothing scheduled" }]);
  });

  it("plan edits after acceptance do not change existing schedules", async () => {
    await as(admin); const id = await addItem(2); await as(dirOps); await accept(project);
    const before = (await db.query<{ send_on: string }>("select send_on::text from after_handoff_schedule")).rows;
    await as(admin);
    await db.query("select after_handoff_plan_save($1,'Renamed','template',$2,9,'x')", [id, tpl]);
    await db.query("select after_handoff_plan_set_active($1,false)", [id]);
    expect((await db.query<{ send_on: string }>("select send_on::text from after_handoff_schedule")).rows).toEqual(before);
    expect(await n("after_handoff_plan_events")).toBe(3);
  });

  it("plan editors: Admin, Director of Operations holder and active cover; others refused", async () => {
    await as(admin); expect(await addItem(1)).toBeTruthy();
    await as(dirOps); expect(await addItem(1)).toBeTruthy();
    await db.query("insert into coverage_overrides values('director_ops','cover',$1,now()-interval '1 hour',now()+interval '1 hour',now())", [cover]);
    await as(cover); expect(await addItem(1)).toBeTruthy();
    for (const id of [pc, director, homeowner, ""]) { await as(id); await expect(addItem(1)).rejects.toThrow("Only an Admin"); }
  });

  it("history is add-only", async () => {
    await as(admin); await addItem(1);
    await expect(db.exec("update after_handoff_plan_events set action='x'")).rejects.toThrow("add-only");
    await expect(db.exec("delete from after_handoff_plan_events")).rejects.toThrow("add-only");
  });

  it("internal staff can read; homeowners cannot", async () => {
    await as(admin); await addItem(1);
    const read = async (id: string) => {
      await as(id); await db.exec("set role authenticated");
      try { return await n("after_handoff_plan_items"); } finally { await db.exec("reset role"); }
    };
    expect(await read(pc)).toBe(1);
    expect(await read(homeowner)).toBe(0);
  });

  it("reschedule, skip, cancel and one-off are recorded; PC refused", async () => {
    await as(admin); await addItem(0); await addItem(3, "library", lib); await addItem(7);
    await as(dirOps); await accept(project);
    const ids = (await db.query<{ id: string }>("select id from after_handoff_schedule order by send_on")).rows.map((r) => r.id);
    await as(pc); await expect(db.query("select after_handoff_schedule_update($1,'skip',null,null)", [ids[0]])).rejects.toThrow("Only the Active Owner");
    await as(dirOps);
    await db.query("select after_handoff_schedule_update($1,'reschedule','2030-01-02',null)", [ids[0]]);
    await db.query("select after_handoff_schedule_update($1,'skip',null,'not needed')", [ids[1]]);
    await db.query("select after_handoff_schedule_update($1,'cancel',null,null)", [ids[2]]);
    await expect(db.query("select after_handoff_schedule_update($1,'cancel',null,null)", [ids[2]])).rejects.toThrow("Only scheduled");
    await db.query("select after_handoff_schedule_add_one_off($1,$2,'library',$3,null,'2030-02-01',null)", [program, home, lib]);
    const acts = (await db.query<{ action: string }>("select action from after_handoff_schedule_events where action<>'scheduled' order by created_at, action")).rows.map((r) => r.action).sort();
    expect(acts).toEqual(["cancelled", "one_off_added", "rescheduled", "skipped"]);
    expect((await db.query<{ s: string }>("select string_agg(status,',' order by status) s from after_handoff_schedule")).rows[0]?.s).toBe("cancelled,scheduled,scheduled,skipped");
  });

  it("follow-up seat holder can manage follow-up but not edit the plan", async () => {
    await db.query("update functional_roles set current_seat_holder=$1 where code='active_owner_followup'", [pc]);
    await as(pc);
    expect((await db.query<{ id: string }>("select after_handoff_schedule_add_one_off($1,$2,'template',$3,null,'2030-02-01',null) id", [program, home, tpl])).rows[0]?.id).toBeTruthy();
    await expect(addItem(1)).rejects.toThrow("Only an Admin");
    await db.query("update functional_roles set current_seat_holder=$1 where code='active_owner_followup'", [dirOps]);
  });

  it("creates no owner work items, notifications or emails", async () => {
    const wi = await n("work_items");
    await as(admin); await addItem(0); await as(dirOps); await accept(project);
    expect(await n("work_items")).toBe(wi);
    expect(await n("owner_notifications")).toBe(0);
    expect(await n("staff_notifications")).toBe(0);
    expect(await n("email_log")).toBe(0);
    expect(await n("after_handoff_schedule where work_item_id is not null")).toBe(0);
  });
});
