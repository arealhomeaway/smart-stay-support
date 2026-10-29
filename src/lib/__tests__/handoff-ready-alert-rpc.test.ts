import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Isolated PostgreSQL only. The pending trigger is never applied to the live database here.
const project = "00000000-0000-4000-8000-0000000000a1", home = "00000000-0000-4000-8000-0000000000b1";
const micah = "00000000-0000-4000-8000-0000000000c1", cover = "00000000-0000-4000-8000-0000000000c2", kati = "00000000-0000-4000-8000-0000000000c3";
const schema = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE properties(id uuid PRIMARY KEY, nickname text, name text, address_line1 text, is_demo boolean);
CREATE TABLE onboarding_projects(id uuid PRIMARY KEY, property_id uuid, handoff_state text, ready_for_ops_by uuid);
CREATE TABLE functional_roles(code text, current_seat_holder uuid, active boolean);
CREATE TABLE coverage_overrides(role_code text, kind text, user_id uuid, starts_at timestamptz, ends_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE staff_notifications(id uuid DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text, entity_type text, entity_id uuid, link_path text, priority text, actor_id uuid, email_status text, is_demo boolean, read_at timestamptz, retracted_at timestamptz);
CREATE FUNCTION seat_holder(_code text) RETURNS uuid LANGUAGE sql AS $$ SELECT current_seat_holder FROM functional_roles WHERE code=_code AND active LIMIT 1 $$;
CREATE FUNCTION seat_override_at(_role_code text, _at timestamptz DEFAULT now()) RETURNS TABLE(kind text, user_id uuid) LANGUAGE sql AS $$ SELECT o.kind,o.user_id FROM coverage_overrides o WHERE o.role_code=_role_code AND _at>=o.starts_at AND _at<o.ends_at ORDER BY o.created_at DESC LIMIT 1 $$;
CREATE FUNCTION notify_staff(_user_id uuid,_kind text,_title text,_body text,_entity_type text,_entity_id uuid,_link_path text,_priority text,_actor_id uuid,_email boolean,_is_demo boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE _id uuid; BEGIN IF _user_id IS NULL OR _actor_id=_user_id THEN RETURN NULL; END IF;
INSERT INTO staff_notifications(user_id,kind,title,body,entity_type,entity_id,link_path,priority,actor_id,email_status,is_demo) VALUES(_user_id,_kind,_title,coalesce(_body,''),_entity_type,_entity_id,_link_path,coalesce(_priority,'normal'),_actor_id,CASE WHEN _email AND NOT coalesce(_is_demo,false) THEN 'pending' ELSE 'none' END,coalesce(_is_demo,false)) RETURNING id INTO _id; RETURN _id; END $$;
`;
let db: PGlite;
const n = async (where = "true") => (await db.query<{ n: number }>(`SELECT count(*)::int n FROM staff_notifications WHERE ${where}`)).rows[0]?.n;
const markReady = () => db.query("UPDATE onboarding_projects SET handoff_state='ready', ready_for_ops_by=$1 WHERE id=$2", [kati, project]);

describe("Pending ready for handoff alert, isolated only", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(schema);
    await db.exec(readFileSync("docs/pending/step2-connect/handoff-ready-alert.sql", "utf8").replaceAll("public.", ""));
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec("TRUNCATE properties, onboarding_projects, functional_roles, coverage_overrides, staff_notifications");
    await db.query("INSERT INTO properties VALUES($1,NULL,'Maple Home',NULL,false)", [home]);
    await db.query("INSERT INTO onboarding_projects VALUES($1,$2,'in_progress',NULL)", [project, home]);
    await db.query("INSERT INTO functional_roles VALUES('director_ops',$1,true)", [micah]);
  });
  it("alerts the seat holder once with an email and a link to the Handoff tab", async () => {
    await markReady();
    const r = await db.query<{ user_id: string; email_status: string; link_path: string; title: string }>("SELECT user_id,email_status,link_path,title FROM staff_notifications");
    expect(r.rows).toEqual([{ user_id: micah, email_status: "pending", link_path: `/property/${home}?tab=handoff`, title: "Home ready for handoff: Maple Home" }]);
  });
  it("also alerts whoever covers the seat right now", async () => {
    await db.query("INSERT INTO coverage_overrides VALUES('director_ops','cover',$1,now()-interval '1 hour',now()+interval '1 hour')", [cover]);
    await markReady();
    expect((await db.query<{ user_id: string }>("SELECT user_id FROM staff_notifications ORDER BY user_id")).rows.map((x) => x.user_id)).toEqual([micah, cover]);
  });
  it("does not duplicate while the earlier alert is unread", async () => {
    await markReady();
    await db.query("UPDATE onboarding_projects SET handoff_state='in_progress' WHERE id=$1", [project]);
    await markReady();
    expect(await n()).toBe(1);
  });
  it("alerts again after the earlier one was read", async () => {
    await markReady();
    await db.exec("UPDATE staff_notifications SET read_at=now()");
    await db.query("UPDATE onboarding_projects SET handoff_state='in_progress' WHERE id=$1", [project]);
    await markReady();
    expect(await n()).toBe(2);
  });
  it("sends nothing on other changes, including acceptance", async () => {
    await db.query("UPDATE onboarding_projects SET handoff_state='accepted' WHERE id=$1", [project]);
    expect(await n()).toBe(0);
  });
  it("demo homes get an in-app alert only, never email", async () => {
    await db.exec("UPDATE properties SET is_demo=true");
    await markReady();
    expect(await n("email_status='none' AND is_demo")).toBe(1);
  });
  it("undo removes the trigger so nothing is sent", async () => {
    await db.exec(readFileSync("docs/pending/step2-connect/undo-handoff-ready-alert.sql", "utf8").replaceAll("public.", ""));
    await markReady();
    expect(await n()).toBe(0);
    await db.exec(readFileSync("docs/pending/step2-connect/handoff-ready-alert.sql", "utf8").replaceAll("public.", ""));
  });
});
