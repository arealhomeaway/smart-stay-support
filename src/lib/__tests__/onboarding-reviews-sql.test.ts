import { describe, it, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const KATI = "00000000-0000-4000-8000-0000000000a1"; // Onboarding Director
const PM = "00000000-0000-4000-8000-0000000000a2"; // step owner
const DESIGNER = "00000000-0000-4000-8000-0000000000a3"; // Lead Designer on the home
const COVER = "00000000-0000-4000-8000-0000000000a4"; // covering the Onboarding Manager seat
const OUTSIDER = "00000000-0000-4000-8000-0000000000a5";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const PROJECT = "00000000-0000-4000-8000-0000000000b2";
const STEP_LOA = "00000000-0000-4000-8000-0000000000c1";
const STEP_UTIL = "00000000-0000-4000-8000-0000000000c2";
const STEP_PLAIN = "00000000-0000-4000-8000-0000000000c3";
const T_LOA = "00000000-0000-4000-8000-0000000000d1";
const T_UTIL = "00000000-0000-4000-8000-0000000000d2";
const T_PLAIN = "00000000-0000-4000-8000-0000000000d3";

const SQL = readFileSync("docs/pending/onboarding-reviews/01_reviews.sql", "utf8");
const UNDO = readFileSync("docs/pending/onboarding-reviews/undo.sql", "utf8");

async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA private; CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  CREATE TABLE profiles(id uuid PRIMARY KEY, full_name text);
  INSERT INTO profiles VALUES('${KATI}','Kati Hand'),('${PM}','Pat Manager'),('${DESIGNER}','Dee Signer'),('${COVER}','Cora Cover'),('${OUTSIDER}','Otto');
  CREATE TABLE functional_roles(code text PRIMARY KEY, active boolean, current_seat_holder uuid, team text);
  INSERT INTO functional_roles VALUES('onboarding_director',true,'${KATI}','onboarding'),('lead_designer',true,NULL,'onboarding'),('onboarding_manager',true,NULL,'onboarding'),('director_ops',true,NULL,'leadership');
  CREATE TABLE coverage_overrides(role_code text, kind text, user_id uuid, starts_at timestamptz, ends_at timestamptz, created_at timestamptz DEFAULT now());
  CREATE TABLE ao_business_holidays(day date PRIMARY KEY, label text DEFAULT '');
  CREATE FUNCTION public.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IN ('${KATI}','${PM}','${DESIGNER}','${COVER}') $$;
  CREATE FUNCTION public.is_supervisor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
  CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
  CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${KATI}'::uuid $$;
  CREATE FUNCTION private.is_onboarding_leader(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${KATI}'::uuid $$;
  CREATE FUNCTION public.seat_holder(_code text) RETURNS uuid LANGUAGE sql AS $$ SELECT current_seat_holder FROM functional_roles WHERE code=_code $$;
  CREATE FUNCTION public.seat_override_at(_role_code text, _at timestamptz DEFAULT now()) RETURNS TABLE(kind text, user_id uuid) LANGUAGE sql AS $$
    SELECT o.kind, o.user_id FROM coverage_overrides o WHERE o.role_code=_role_code AND _at>=o.starts_at AND _at<o.ends_at ORDER BY o.created_at DESC LIMIT 1 $$;
  CREATE FUNCTION public.seat_holder_at(_role_code text, _at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql AS $$
    SELECT COALESCE((SELECT o.user_id FROM public.seat_override_at(_role_code,_at) o WHERE o.kind='cover'),(SELECT current_seat_holder FROM functional_roles WHERE code=_role_code)) $$;
  CREATE TABLE onboarding_projects(id uuid PRIMARY KEY, property_id uuid, role_assignments jsonb DEFAULT '{}', handoff_state text DEFAULT 'ready', created_at timestamptz DEFAULT now());
  CREATE FUNCTION public.project_role_assignee(_project_id uuid, _role text) RETURNS uuid LANGUAGE sql AS $$
    SELECT nullif(p.role_assignments->>_role,'')::uuid FROM onboarding_projects p WHERE p.id=_project_id $$;
  CREATE FUNCTION private.ao_add_business_days(_d date, _n integer) RETURNS date LANGUAGE plpgsql AS $$
    DECLARE d date := _d; left_n int := abs(_n); BEGIN WHILE left_n > 0 LOOP d := d + 1;
    IF extract(isodow FROM d) < 6 AND NOT EXISTS (SELECT 1 FROM ao_business_holidays h WHERE h.day = d) THEN left_n := left_n - 1; END IF; END LOOP; RETURN d; END $$;
  CREATE TABLE onboarding_template_tasks(id uuid PRIMARY KEY, template_id uuid, title text);
  CREATE TABLE onboarding_tasks(id uuid PRIMARY KEY, property_id uuid, title text, stage text, status text DEFAULT 'open', assigned_to uuid,
    template_task_id uuid, archived_at timestamptz, exception_at timestamptz, completed_at timestamptz, completed_by uuid, blocker text, sort_order int, is_demo boolean DEFAULT false);
  CREATE TABLE staff_notifications(user_id uuid, kind text, title text, body text, entity_type text, entity_id uuid, link_path text, priority text, actor_id uuid, is_demo boolean, email_status text);
  INSERT INTO onboarding_template_tasks VALUES('${STEP_LOA}','00000000-0000-4000-8000-0000000000e1','LOA'),('${STEP_UTIL}','00000000-0000-4000-8000-0000000000e1','Utilities setup'),('${STEP_PLAIN}','00000000-0000-4000-8000-0000000000e1','Plain');
  INSERT INTO onboarding_projects(id, property_id, role_assignments) VALUES('${PROJECT}','${HOME}','{"lead_designer":"${DESIGNER}"}');
  INSERT INTO onboarding_tasks(id, property_id, title, stage, assigned_to, template_task_id, sort_order) VALUES
   ('${T_LOA}','${HOME}','LOA','utilities','${PM}','${STEP_LOA}',1),('${T_UTIL}','${HOME}','Utilities setup','utilities','${PM}','${STEP_UTIL}',2),
   ('${T_PLAIN}','${HOME}','Plain','utilities','${PM}','${STEP_PLAIN}',3);`);
  await db.exec(SQL);
  return db;
}
const as = (db: PGlite, uid: string | null) => db.exec(`SELECT set_config('test.uid', '${uid ?? ""}', false)`);
const status = async (db: PGlite, id: string) => (await db.query<{ status: string }>(`SELECT status FROM onboarding_tasks WHERE id='${id}'`)).rows[0]?.status;
const configure = (db: PGlite, roles: string, alerts = true, blocks = "nothing", extra = "'{}'::uuid[], NULL") =>
  db.query(`SELECT set_onboarding_step_review_settings('${STEP_LOA}', ${roles}, 1, ${alerts}, '${blocks}', ${extra})`);

describe("onboarding review steps (isolated database)", () => {
  it("defaults off: steps without settings complete exactly as today and create nothing", async () => {
    const db = await setup();
    try {
      await as(db, PM);
      await db.exec(`UPDATE onboarding_tasks SET status='complete'`);
      expect(await status(db, T_LOA)).toBe("complete");
      const n = await db.query<{ n: number }>(`SELECT (SELECT count(*) FROM onboarding_task_reviews)+(SELECT count(*) FROM staff_notifications)+(SELECT count(*) FROM onboarding_step_review_settings) AS n`);
      expect(Number(n.rows[0]?.n)).toBe(0);
      await db.exec(`UPDATE onboarding_projects SET handoff_state='accepted'`);
    } finally { await db.close(); }
  });

  it("two reviewers: approved only when both approve; only assigned reviewers act; cover is used; alerts are in-app only", async () => {
    const db = await setup();
    try {
      await db.exec(`INSERT INTO coverage_overrides VALUES('onboarding_manager','cover','${COVER}',now()-interval '1 hour',now()+interval '1 day')`);
      await as(db, KATI);
      await configure(db, "ARRAY['lead_designer','onboarding_manager']");
      await as(db, PM);
      await expect(db.exec(`UPDATE onboarding_tasks SET status='complete' WHERE id='${T_LOA}'`)).rejects.toThrow("needs review");
      const sub = await db.query<{ r: { review_id: string; status: string } }>(`SELECT submit_onboarding_task_review('${T_LOA}') r`);
      const rid = sub.rows[0]!.r.review_id;
      expect(sub.rows[0]!.r.status).toBe("pending");
      const notes = await db.query<{ user_id: string; email_status: string }>(`SELECT user_id, email_status FROM staff_notifications ORDER BY user_id`);
      expect(notes.rows.map((r) => r.user_id).sort()).toEqual([DESIGNER, COVER].sort());
      expect(notes.rows.every((r) => r.email_status === "none")).toBe(true);
      await as(db, OUTSIDER);
      await expect(db.query(`SELECT decide_onboarding_task_review('${rid}','approved')`)).rejects.toThrow("Only the assigned reviewer");
      await as(db, KATI); // Director is not the Onboarding Manager while someone covers it
      await expect(db.query(`SELECT decide_onboarding_task_review('${rid}','approved')`)).rejects.toThrow("Only the assigned reviewer");
      await as(db, DESIGNER);
      await db.query(`SELECT decide_onboarding_task_review('${rid}','approved')`);
      expect(await status(db, T_LOA)).toBe("open");
      await as(db, COVER);
      await db.query(`SELECT decide_onboarding_task_review('${rid}','approved')`);
      expect(await status(db, T_LOA)).toBe("complete");
      const rv = await db.query<{ status: string }>(`SELECT status FROM onboarding_task_reviews WHERE id='${rid}'`);
      expect(rv.rows[0]?.status).toBe("approved");
    } finally { await db.close(); }
  });

  it("send back needs a note, returns the step to its owner, and resubmission starts a new round; direct edits are logged", async () => {
    const db = await setup();
    try {
      await as(db, KATI);
      await configure(db, "ARRAY['lead_designer']");
      await as(db, PM);
      const rid = (await db.query<{ r: { review_id: string } }>(`SELECT submit_onboarding_task_review('${T_LOA}') r`)).rows[0]!.r.review_id;
      await as(db, DESIGNER);
      await db.query(`SELECT record_onboarding_review_edit('${rid}','Fixed the meter number')`);
      await expect(db.query(`SELECT decide_onboarding_task_review('${rid}','sent_back','')`)).rejects.toThrow("Add a note");
      await db.query(`SELECT decide_onboarding_task_review('${rid}','sent_back','Wrong account holder')`);
      const back = await db.query<{ user_id: string; kind: string }>(`SELECT user_id, kind FROM staff_notifications WHERE kind='onboarding_review_changes'`);
      expect(back.rows[0]?.user_id).toBe(PM);
      expect(await status(db, T_LOA)).toBe("open");
      await as(db, PM);
      const r2 = await db.query<{ r: { review_id: string } }>(`SELECT submit_onboarding_task_review('${T_LOA}','Updated') r`);
      const round = await db.query<{ round: number }>(`SELECT round FROM onboarding_task_reviews WHERE id='${r2.rows[0]!.r.review_id}'`);
      expect(round.rows[0]?.round).toBe(2);
      const kinds = await db.query<{ kind: string }>(`SELECT kind FROM onboarding_task_review_events ORDER BY created_at, kind`);
      expect(kinds.rows.map((k) => k.kind)).toEqual(expect.arrayContaining(["submitted", "edited", "sent_back", "resubmitted"]));
    } finally { await db.close(); }
  });

  it("time limit counts business days in Central time and skips holidays; overdue alerts once and reaches the Director", async () => {
    const db = await setup();
    try {
      // Friday 3 pm Central -> Monday 3 pm Central; with Monday a holiday -> Tuesday.
      const fri = await db.query<{ d: string }>(`SELECT to_char(private.review_due_at('2026-11-06 15:00 America/Chicago'::timestamptz,1) AT TIME ZONE 'America/Chicago','YYYY-MM-DD HH24:MI') d`);
      expect(fri.rows[0]?.d).toBe("2026-11-09 15:00");
      await db.exec(`INSERT INTO ao_business_holidays(day) VALUES('2026-11-09')`);
      const hol = await db.query<{ d: string }>(`SELECT to_char(private.review_due_at('2026-11-06 15:00 America/Chicago'::timestamptz,1) AT TIME ZONE 'America/Chicago','YYYY-MM-DD HH24:MI') d`);
      expect(hol.rows[0]?.d).toBe("2026-11-10 15:00");
      await as(db, KATI);
      await configure(db, "ARRAY['lead_designer']");
      await as(db, PM);
      await db.query(`SELECT submit_onboarding_task_review('${T_LOA}')`);
      await db.exec(`UPDATE onboarding_task_reviews SET due_at = now() - interval '1 minute'`);
      expect((await db.query<{ n: number }>(`SELECT onboarding_review_overdue_sweep() n`)).rows[0]?.n).toBe(1);
      expect((await db.query<{ n: number }>(`SELECT onboarding_review_overdue_sweep() n`)).rows[0]?.n).toBe(0);
      const who = await db.query<{ user_id: string }>(`SELECT user_id FROM staff_notifications WHERE kind='onboarding_review_overdue'`);
      expect(who.rows.map((r) => r.user_id).sort()).toEqual([DESIGNER, KATI].sort());
    } finally { await db.close(); }
  });

  it("alerts toggle off: no submit or overdue alerts", async () => {
    const db = await setup();
    try {
      await as(db, KATI);
      await configure(db, "ARRAY['lead_designer']", false);
      await as(db, PM);
      await db.query(`SELECT submit_onboarding_task_review('${T_LOA}')`);
      await db.exec(`UPDATE onboarding_task_reviews SET due_at = now() - interval '1 minute'`);
      await db.query(`SELECT onboarding_review_overdue_sweep()`);
      expect(Number((await db.query<{ n: number }>(`SELECT count(*) n FROM staff_notifications`)).rows[0]?.n)).toBe(0);
    } finally { await db.close(); }
  });

  it("no second look: skipped with a named record; changes are limited to Admin and Directors and kept in history", async () => {
    const db = await setup();
    try {
      await as(db, PM);
      await expect(db.query(`SELECT set_staff_no_second_look('${PM}', true)`)).rejects.toThrow("Only an Admin or a Director");
      await as(db, KATI);
      await configure(db, "ARRAY['lead_designer']");
      await db.query(`SELECT set_staff_no_second_look('${PM}', true)`);
      await as(db, PM);
      const r = await db.query<{ r: { status: string } }>(`SELECT submit_onboarding_task_review('${T_LOA}') r`);
      expect(r.rows[0]!.r.status).toBe("skipped");
      expect(await status(db, T_LOA)).toBe("complete");
      const ev = await db.query<{ note: string }>(`SELECT note FROM onboarding_task_review_events WHERE kind='skipped'`);
      expect(ev.rows[0]?.note).toBe("Skipped: no second look needed for Pat Manager");
      expect(Number((await db.query<{ n: number }>(`SELECT count(*) n FROM staff_review_preference_history`)).rows[0]?.n)).toBe(1);
    } finally { await db.close(); }
  });

  it("blocks specific steps and handoff until approved", async () => {
    const db = await setup();
    try {
      await as(db, KATI);
      await configure(db, "ARRAY['lead_designer']", false, "steps", `ARRAY['${STEP_UTIL}']::uuid[], NULL`);
      await as(db, PM);
      await expect(db.exec(`UPDATE onboarding_tasks SET status='complete' WHERE id='${T_UTIL}'`)).rejects.toThrow("Waiting on review of LOA");
      await db.exec(`UPDATE onboarding_tasks SET status='complete' WHERE id='${T_PLAIN}'`);
      await as(db, KATI);
      await configure(db, "ARRAY['lead_designer']", false, "handoff");
      await expect(db.exec(`UPDATE onboarding_projects SET handoff_state='accepted'`)).rejects.toThrow("Waiting on review of LOA");
      await as(db, PM);
      const rid = (await db.query<{ r: { review_id: string } }>(`SELECT submit_onboarding_task_review('${T_LOA}') r`)).rows[0]!.r.review_id;
      await as(db, DESIGNER);
      await db.query(`SELECT decide_onboarding_task_review('${rid}','approved')`);
      await db.exec(`UPDATE onboarding_projects SET handoff_state='accepted'`);
    } finally { await db.close(); }
  });

  it("settings changes are leader-only, validated and recorded; undo removes every new object", async () => {
    const db = await setup();
    try {
      await as(db, PM);
      await expect(configure(db, "ARRAY['lead_designer']")).rejects.toThrow("Only the Onboarding Director");
      await as(db, KATI);
      await expect(configure(db, "ARRAY['lead_designer','onboarding_manager','designer']")).rejects.toThrow("up to two");
      await configure(db, "ARRAY['lead_designer']");
      expect(Number((await db.query<{ n: number }>(`SELECT count(*) n FROM onboarding_step_review_settings_history`)).rows[0]?.n)).toBe(1);
      await db.exec(UNDO);
      const left = await db.query<{ n: number }>(`SELECT count(*) n FROM pg_class WHERE relname LIKE 'onboarding_task_review%' OR relname LIKE 'onboarding_step_review%' OR relname LIKE 'staff_review_pref%'`);
      expect(Number(left.rows[0]?.n)).toBe(0);
      const fns = await db.query<{ n: number }>(`SELECT count(*) n FROM pg_proc WHERE proname LIKE '%review%' AND proname NOT IN ('project_role_assignee')`);
      expect(Number(fns.rows[0]?.n)).toBe(0);
    } finally { await db.close(); }
  });
});
