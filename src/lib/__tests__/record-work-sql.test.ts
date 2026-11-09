// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/record-work/01_record_work.sql
 * (applied as drizzle/migrations/0312_record_work_one_flow.sql). Tables are
 * stubbed. Nothing touches the real database.
 */
const STEP = readFileSync("docs/pending/record-work/01_record_work.sql", "utf8");
const PC = "00000000-0000-4000-8000-000000000001";
const OTHER_PC = "00000000-0000-4000-8000-000000000002";
const SUP = "00000000-0000-4000-8000-000000000003";
const OWNER = "00000000-0000-4000-8000-000000000004";
const HOME = "00000000-0000-4000-8000-0000000000a1";
const WT = "00000000-0000-4000-8000-0000000000b1";
const WT2 = "00000000-0000-4000-8000-0000000000b2";

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
INSERT INTO public.user_roles VALUES ('${PC}','tech'), ('${OTHER_PC}','tech'), ('${SUP}','manager'), ('${OWNER}','owner');
CREATE FUNCTION private.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role IN ('admin','manager','tech','onboarding')) $$;
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb, updated_by uuid, updated_at timestamptz);
CREATE TABLE public.work_types(id uuid PRIMARY KEY, name text, functional_role_code text);
INSERT INTO public.work_types VALUES ('${WT}', 'Immediate maintenance', 'po_day'), ('${WT2}', 'Current or past guest request', 'ge_day');
CREATE TABLE public.functional_roles(code text PRIMARY KEY, name text, current_seat_holder uuid);
INSERT INTO public.functional_roles VALUES ('ops_supervisor','Operations Supervisor','${SUP}'), ('director_ops','Director of Operations',NULL), ('po_day','Property Operations Coordinator',NULL);
CREATE FUNCTION public.seat_holder_at(_code text, _at timestamptz) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT current_seat_holder FROM public.functional_roles WHERE code = _code $$;
CREATE TABLE public.route_answer(user_id uuid, role_code text);
CREATE FUNCTION public.ticket_route_at(_role_code text, _work_type_id uuid, _at timestamptz DEFAULT now())
  RETURNS TABLE(user_id uuid, role_code text, source text, note text) LANGUAGE sql STABLE AS
  $$ SELECT r.user_id, r.role_code, 'automatic', 'stub' FROM public.route_answer r LIMIT 1 $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, is_demo boolean DEFAULT false);
INSERT INTO public.properties VALUES ('${HOME}', false);
CREATE SEQUENCE public.tickets_ref_seq;
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ref int DEFAULT nextval('public.tickets_ref_seq'),
  title text, property_id uuid, work_type_id uuid, is_demo boolean DEFAULT false, created_by uuid, archived_at timestamptz,
  reported_at timestamptz DEFAULT now(), external_source text, external_status text,
  escalation_level text NOT NULL DEFAULT 'none', escalated_at timestamptz);
CREATE TABLE public.property_activity_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(), category text NOT NULL DEFAULT 'other', what_happened text NOT NULL DEFAULT 'x',
  outcome text NOT NULL DEFAULT 'x', logged_by uuid, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.escalations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, property_id uuid, escalated_by uuid NOT NULL,
  escalated_to_role text NOT NULL, reason text NOT NULL, help_needed text, urgency text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open', is_demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid, kind text,
  event_type text, internal boolean, body text);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text NOT NULL,
  title text NOT NULL, body text NOT NULL DEFAULT '', entity_type text, entity_id uuid, link_path text, priority text NOT NULL DEFAULT 'normal',
  actor_id uuid, email_status text NOT NULL DEFAULT 'none', is_demo boolean NOT NULL DEFAULT false);
CREATE FUNCTION public.notify_staff(_user_id uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid,
  _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE _id uuid;
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN RETURN NULL; END IF;
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, email_status, is_demo)
  VALUES (_user_id, _kind, _title, coalesce(_body,''), _entity_type, _entity_id, _link_path, coalesce(_priority,'normal'), _actor_id,
    CASE WHEN _email AND NOT coalesce(_is_demo,false) THEN 'pending' ELSE 'none' END, coalesce(_is_demo,false))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
`;

let db: PGlite;
const as = async (id: string) => {
  await db.exec("DELETE FROM public.me");
  await db.query("INSERT INTO public.me VALUES ($1)", [id]);
};
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const repeat = () => one("SELECT * FROM public.home_problem_repeat($1, $2)", [HOME, WT]);
const ticket = (title: string, cols = "", vals = "") =>
  one(`INSERT INTO public.tickets(title, property_id, work_type_id, created_by${cols ? ", " + cols : ""})
       VALUES ($1, '${HOME}', '${WT}', '${PC}'${vals ? ", " + vals : ""}) RETURNING id`, [title]);
const oneTouch = (daysAgo = 0, wt = WT) =>
  db.query("INSERT INTO public.property_activity_log(property_id, occurred_at, problem_type_id, one_touch, logged_by) VALUES ($1, now() - make_interval(days => $2), $3, true, $4)", [HOME, daysAgo, wt, PC]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(STEP);
});

beforeEach(async () => {
  await db.exec(`DELETE FROM public.tickets; DELETE FROM public.property_activity_log; DELETE FROM public.escalations;
    DELETE FROM public.ticket_activity; DELETE FROM public.staff_notifications; DELETE FROM public.route_answer;
    UPDATE public.app_settings SET value = '{"times": 3, "days": 90}' WHERE key = 'record_work_repeat';`);
  await as(PC);
});

describe("one touch columns and the repeat setting", () => {
  it("adds the problem type and one touch mark to home history, and the 3 / 90 setting", async () => {
    const cols = (await db.query("SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'property_activity_log' AND column_name IN ('problem_type_id','one_touch') ORDER BY 1")).rows;
    expect(cols.map((c) => c.column_name)).toEqual(["one_touch", "problem_type_id"]);
    expect((await one("SELECT value FROM public.app_settings WHERE key = 'record_work_repeat'")).value).toEqual({ times: 3, days: 90 });
  });
});

describe("repeat flag: same problem type 3 times in 90 days at the same home", () => {
  it("counts tickets and one touch saves together and flags on the third", async () => {
    await ticket("Fridge 1");
    await oneTouch(10);
    expect(await repeat()).toEqual({ times_in_window: 2, times_needed: 3, window_days: 90, flagged: false });
    await oneTouch(20);
    expect(await repeat()).toEqual({ times_in_window: 3, times_needed: 3, window_days: 90, flagged: true });
    const flags = (await db.query("SELECT problem_type, times FROM public.home_repeat_flags($1, NULL)", [HOME])).rows;
    expect(flags).toEqual([{ problem_type: "Immediate maintenance", times: 3 }]);
  });
  it("older than 90 days, another problem type, archived tickets and quiet Notion imports never count", async () => {
    await oneTouch(91);
    await oneTouch(0, WT2);
    await ticket("Archived", "archived_at", "now()");
    await ticket("Notion quiet", "external_source", "'notion'");
    await ticket("Notion reopened", "external_source, external_status", "'notion', 'reopened_in_resolve'");
    // Only the reopened Notion import counts.
    expect((await repeat()).times_in_window).toBe(1);
  });
  it("the 3 and the 90 are settings", async () => {
    await db.exec(`UPDATE public.app_settings SET value = '{"times": 2, "days": 30}' WHERE key = 'record_work_repeat'`);
    await oneTouch(5);
    await oneTouch(40);
    expect(await repeat()).toEqual({ times_in_window: 1, times_needed: 2, window_days: 30, flagged: false });
    await oneTouch(6);
    expect((await repeat()).flagged).toBe(true);
  });
  it("the weekly list holds homes whose repeat happened this week only", async () => {
    await oneTouch(20); await oneTouch(15); await oneTouch(10);
    expect((await db.query("SELECT 1 FROM public.home_repeat_flags(NULL, now() - interval '7 days')")).rows.length).toBe(0);
    await oneTouch(1);
    expect((await db.query("SELECT 1 FROM public.home_repeat_flags(NULL, now() - interval '7 days')")).rows.length).toBe(1);
  });
  it("only staff read home history", async () => {
    await as(OWNER);
    await expect(repeat()).rejects.toThrow("Only Resolve staff");
    await expect(db.query("SELECT * FROM public.home_repeat_flags(NULL, NULL)")).rejects.toThrow("Only Resolve staff");
  });
});

describe("who will do it: a role, never a person", () => {
  const preview = () => one("SELECT * FROM public.record_work_route_preview($1)", [WT]);
  it("maps the routing result to plain kinds", async () => {
    await db.exec(`INSERT INTO public.route_answer VALUES ('${OTHER_PC}', 'po_day')`);
    expect(await preview()).toEqual({ who_kind: "coordinator", role_name: null });
    await db.exec(`UPDATE public.route_answer SET role_code = NULL`);
    expect((await preview()).who_kind).toBe("on_call");
    await db.exec(`UPDATE public.route_answer SET role_code = 'ops_supervisor'`);
    expect((await preview()).who_kind).toBe("supervisor");
    await db.exec(`UPDATE public.route_answer SET role_code = 'director_ops'`);
    expect(await preview()).toEqual({ who_kind: "role", role_name: "Director of Operations" });
    await db.exec(`DELETE FROM public.route_answer`);
    expect((await preview()).who_kind).toBe("nobody");
  });
  it("returns no person id", async () => {
    const cols = (await db.query("SELECT * FROM public.record_work_route_preview($1)", [WT])).fields.map((f) => f.name);
    expect(cols).toEqual(["who_kind", "role_name"]);
  });
});

describe("Escalate now", () => {
  it("marks the ticket escalated and alerts the Operations Supervisor once", async () => {
    const t = await ticket("Kitchen flooding");
    const a = (await one("SELECT public.record_work_escalate($1) id", [t.id])).id;
    const b = (await one("SELECT public.record_work_escalate($1) id", [t.id])).id;
    expect(a).toBe(b);
    const row = await one("SELECT escalation_level, escalated_at IS NOT NULL at_set FROM public.tickets WHERE id = $1", [t.id]);
    expect(row).toEqual({ escalation_level: "supervisor", at_set: true });
    const alerts = (await db.query("SELECT user_id, kind, priority, email_status, link_path FROM public.staff_notifications")).rows;
    expect(alerts).toEqual([{ user_id: SUP, kind: "ticket_escalated", priority: "high", email_status: "pending", link_path: `/tickets/${t.id}` }]);
    const esc = (await db.query("SELECT escalated_to_role, urgency, status, escalated_by FROM public.escalations")).rows;
    expect(esc).toEqual([{ escalated_to_role: "supervisor", urgency: "critical", status: "open", escalated_by: PC }]);
    expect((await db.query("SELECT 1 FROM public.ticket_activity WHERE event_type = 'escalated'")).rows.length).toBe(1);
  });
  it("only the person who recorded the ticket can escalate it here; owners never", async () => {
    const t = await ticket("Roof leak");
    await as(OTHER_PC);
    await expect(one("SELECT public.record_work_escalate($1)", [t.id])).rejects.toThrow("Only the person who recorded");
    await as(OWNER);
    await expect(one("SELECT public.record_work_escalate($1)", [t.id])).rejects.toThrow("Only Resolve staff");
    expect((await db.query("SELECT 1 FROM public.staff_notifications")).rows.length).toBe(0);
  });
});
