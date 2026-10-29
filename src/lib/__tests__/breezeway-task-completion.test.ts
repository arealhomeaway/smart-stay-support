import { beforeAll, afterAll, beforeEach, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { breezewayCompleted } from "../breezeway-task-completion";
let db: PGlite;
const home = "00000000-0000-4000-8000-000000000001", task = "00000000-0000-4000-8000-000000000002", project = "00000000-0000-4000-8000-000000000003", link = "00000000-0000-4000-8000-000000000004";
const stamp = "2026-10-29T00:00:00Z";
const call = () => db.query<{ done: boolean }>("select complete_onboarding_from_breezeway($1,123,$2,'Finished',$3,$3,$3,$3) as done", [link, home, stamp]);
beforeAll(async () => {
 db = new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT coalesce(current_setting('test.role',true),'service_role')$$;
 CREATE FUNCTION private.onboarding_work_locked(uuid[]) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE TABLE properties(id uuid,archived_at timestamptz,updated_at timestamptz,handoff_accepted_at timestamptz,lifecycle_status text,breezeway_property_id text,breezeway_mapping_state text);
 CREATE TABLE onboarding_projects(id uuid,property_id uuid,status text,updated_at timestamptz,completed_at timestamptz);
 CREATE TABLE onboarding_tasks(id uuid,property_id uuid,archived_at timestamptz,status text,completed_at timestamptz,completed_by uuid,updated_at timestamptz,blocker text,evidence_required boolean,evidence_note text,requires_owner_approval boolean,owner_approval_status text,stage text,title text,is_demo boolean);
 CREATE TABLE breezeway_outbound_tasks(id uuid,source_type text,breezeway_task_id bigint,property_id uuid,onboarding_task_id uuid,breezeway_home_id text);
 CREATE TABLE onboarding_project_events(project_id uuid,kind text,new_value text);
 CREATE TABLE audit_log(actor_label text,action text,entity_type text,entity_id uuid,entity_label text,reason text,before_value jsonb,after_value jsonb);
 CREATE TABLE onboarding_notes(property_id uuid,task_id uuid,body text,is_demo boolean);`);
 await db.exec(readFileSync("docs/pending/quick-fixes/complete-onboarding-from-breezeway.sql", "utf8"));
});
afterAll(async () => { await db.close(); });
beforeEach(async () => {
 await db.exec("TRUNCATE properties,onboarding_projects,onboarding_tasks,breezeway_outbound_tasks,onboarding_project_events,audit_log,onboarding_notes; SELECT set_config('test.role','service_role',false)");
 await db.query("INSERT INTO properties VALUES($1,NULL,$2,NULL,'onboarding','100','verified')", [home, stamp]);
 await db.query("INSERT INTO onboarding_projects VALUES($1,$2,'active',$3,NULL)", [project, home, stamp]);
 await db.query("INSERT INTO onboarding_tasks VALUES($1,$2,NULL,'open',NULL,NULL,$3,'',false,'',false,'not_required','setup','Test Task',true)", [task, home, stamp]);
 await db.query("INSERT INTO breezeway_outbound_tasks VALUES($1,'onboarding_task',123,$2,$3,'100')", [link, home, task]);
});
it("completes once with Completed in Breezeway history, repeats do nothing", async () => {
 expect((await call()).rows[0]?.done).toBe(true);
 expect((await call()).rows[0]?.done).toBe(false);
 expect((await db.query<{ status: string }>("SELECT status FROM onboarding_tasks")).rows[0]?.status).toBe("complete");
 expect((await db.query("SELECT body FROM onboarding_notes")).rows).toEqual([{ body: "Completed in Breezeway" }]);
 expect((await db.query("SELECT reason FROM audit_log")).rows).toEqual([{ reason: "Completed in Breezeway" }]);
});
it("refuses nonintegration callers", async () => {
 await db.exec("SELECT set_config('test.role','authenticated',false)");
 await expect(call()).rejects.toThrow("Integration access required.");
});
it("does not bypass required evidence, owner decisions or accepted handoff", async () => {
 await db.exec("UPDATE onboarding_tasks SET evidence_required=true");
 expect((await call()).rows[0]?.done).toBe(false);
 await db.exec("UPDATE onboarding_tasks SET evidence_required=false,requires_owner_approval=true");
 expect((await call()).rows[0]?.done).toBe(false);
 await db.exec("UPDATE onboarding_tasks SET requires_owner_approval=false; UPDATE properties SET handoff_accepted_at=now()");
 expect((await call()).rows[0]?.done).toBe(false);
});
it("recognizes only completed Breezeway states", () => {
 expect(breezewayCompleted("Finished", null)).toBe(true);
 expect(breezewayCompleted(null,"Approved")).toBe(true);
 expect(breezewayCompleted("In Progress", "Open")).toBe(false);
});