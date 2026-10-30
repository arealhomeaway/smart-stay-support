import { describe,it,expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { homeownerApprovalRequired } from "../owner-dependency";

const actor="00000000-0000-4000-8000-000000000001", project="00000000-0000-4000-8000-000000000002", home="00000000-0000-4000-8000-000000000003";
describe("approved review fixes",()=>{
 it("business decision requires homeowner approval even when the legacy flag is false",()=>{
  expect(homeownerApprovalRequired({owner_dependency:"business_decision",requires_owner_approval:false})).toBe(true);
  expect(homeownerApprovalRequired({owner_dependency:"feedback",requires_owner_approval:false})).toBe(false);
 });
 it("atomic Project Team save moves only eligible Tasks and records valid audit fields; audit failure rolls back",async()=>{
  const db=new PGlite();
  try {
   await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA private; CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${actor}'::uuid $$;
   CREATE FUNCTION public.is_supervisor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
   CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
   CREATE TABLE onboarding_projects(id uuid PRIMARY KEY,property_id uuid,project_manager uuid,utility_manager uuid,role_assignments jsonb);
   CREATE TABLE onboarding_tasks(id serial,property_id uuid,assigned_seat text,assigned_to uuid,status text,archived_at timestamptz,exception_at timestamptz);
   CREATE TABLE audit_log(actor_id uuid,action text,entity_type text,entity_id uuid,entity_label text,before_value jsonb,after_value jsonb);
   INSERT INTO onboarding_projects VALUES('${project}','${home}',NULL,NULL,'{}');
   INSERT INTO onboarding_tasks(property_id,assigned_seat,status,archived_at,exception_at) VALUES
   ('${home}','utilities','open',NULL,NULL),('${home}','utilities','in_progress',NULL,NULL),('${home}','utilities','blocked',NULL,NULL),
   ('${home}','utilities','open',now(),NULL),('${home}','utilities','open',NULL,now()),('${home}','utilities','complete',NULL,NULL);`);
   await db.exec(readFileSync("docs/pending/review-fixes/01_project_team.sql","utf8"));
   const result=await db.query<{r:{moved:number}}>(`SELECT set_onboarding_project_role('${project}','utilities','${actor}',true) r`);
   expect(result.rows[0]?.r.moved).toBe(3);
   const n=await db.query<{n:number}>("SELECT count(*)::int n FROM onboarding_tasks WHERE assigned_to IS NOT NULL");expect(n.rows[0]?.n).toBe(3);
   const log=await db.query<{actor_id:string;before_value:unknown;after_value:{reassigned_tasks:number}}>("SELECT * FROM audit_log");expect(log.rows[0]?.actor_id).toBe(actor);expect(log.rows[0]?.after_value.reassigned_tasks).toBe(3);
   await db.exec("ALTER TABLE audit_log ADD CONSTRAINT fail_audit CHECK(false) NOT VALID");
   await expect(db.query(`SELECT set_onboarding_project_role('${project}','utilities',NULL,true)`)).rejects.toThrow();
   const pr=await db.query<{utility_manager:string}>("SELECT utility_manager FROM onboarding_projects");expect(pr.rows[0]?.utility_manager).toBe(actor);
   await expect(db.query(`SELECT set_onboarding_project_role('${project}','owner',NULL,true)`)).rejects.toThrow("That role");
  } finally {await db.close();}
 });
 it("database blocks business-decision completion, permits approved completion and leaves unrelated legacy edits alone",async()=>{
  const db=new PGlite();try {
   await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;
   CREATE TABLE onboarding_template_tasks(id int,owner_dependency text,requires_owner_approval boolean,title text);
   CREATE TABLE onboarding_tasks(id int,status text,owner_dependency text,requires_owner_approval boolean,owner_approval_status text,title text);
   INSERT INTO onboarding_template_tasks VALUES(1,'business_decision',false,'Legacy');
   INSERT INTO onboarding_tasks VALUES(1,'open','business_decision',false,'not_required','Open'),(2,'complete','business_decision',false,'not_required','Legacy');`);
   await db.exec(readFileSync("docs/pending/review-fixes/02_business_decision.sql","utf8"));
   await expect(db.exec("UPDATE onboarding_tasks SET status='complete' WHERE id=1")).rejects.toThrow("homeowner decision");
   await db.exec("UPDATE onboarding_tasks SET owner_approval_status='approved' WHERE id=1;UPDATE onboarding_tasks SET status='complete' WHERE id=1;");
   await db.exec("UPDATE onboarding_tasks SET title='Unrelated edit' WHERE id=2;UPDATE onboarding_template_tasks SET title='Unrelated edit' WHERE id=1;");
   await expect(db.exec("INSERT INTO onboarding_template_tasks VALUES(3,'business_decision',false,'New')")).rejects.toThrow("requires homeowner approval");
   await db.exec("INSERT INTO onboarding_template_tasks VALUES(3,'business_decision',true,'New')");
   const r=await db.query<{status:string}>("SELECT status FROM onboarding_tasks WHERE id=1");expect(r.rows[0]?.status).toBe("complete");
  }finally{await db.close();}
 });
});