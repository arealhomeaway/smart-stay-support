// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/arrival-check/01_arrival_check.sql (Build 12;
 * Emily, Nov 10; register BN4, BN10). Tables are stubbed with the live column names. Fake
 * bookings only. Nothing touches the real database or OwnerRez.
 */
const DIR = "docs/pending/arrival-check";
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const COORD = "00000000-0000-4000-8000-0000000000c1";
const COORD2 = "00000000-0000-4000-8000-0000000000c2";
const SUP = "00000000-0000-4000-8000-0000000000d1";
const HOME = "00000000-0000-4000-8000-000000000101"; // Eastern, 16:00
const UNVERIFIED = "00000000-0000-4000-8000-000000000102";
const NEW_HOUSE = "00000000-0000-4000-8000-000000000103";
const TEST_HOME = "00000000-0000-4000-8000-000000000104";
const CENTRAL_HOME = "00000000-0000-4000-8000-000000000105"; // no zone, no time

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA cron;
CREATE TABLE cron.jobs(name text PRIMARY KEY, schedule text, command text);
CREATE FUNCTION cron.schedule(_n text, _s text, _c text) RETURNS bigint LANGUAGE sql AS
  $$ INSERT INTO cron.jobs VALUES (_n, _s, _c) ON CONFLICT (name) DO UPDATE SET schedule = EXCLUDED.schedule RETURNING 1::bigint $$;
CREATE FUNCTION cron.unschedule(_n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.jobs WHERE name = _n RETURNING true $$;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','onboarding');
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${COORD}','tech'), ('${COORD2}','tech'), ('${SUP}','manager');
CREATE FUNCTION private.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
CREATE FUNCTION public.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.has_role(_u,_r) $$;
CREATE FUNCTION public.is_director(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_accounting(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.holds_functional_role(_u uuid, _c text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _u = '${SUP}' $$;
CREATE FUNCTION public.can_view_export_check(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _u IN ('${ADMIN}','${SUP}') $$;
CREATE FUNCTION public.seat_holder_at(_c text, _at timestamptz) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${SUP}'::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, email text);
INSERT INTO public.profiles VALUES ('${COORD}', 'Coordinator one', 'c1@example.com');
CREATE TABLE public.feature_flags(key text PRIMARY KEY, label text NOT NULL, enabled boolean NOT NULL DEFAULT false,
  description text, updated_by uuid, updated_at timestamptz DEFAULT now());
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb, updated_by uuid, updated_at timestamptz DEFAULT now());
CREATE TABLE public.integration_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system text NOT NULL, direction text NOT NULL,
  operation text NOT NULL, external_id text, status text NOT NULL DEFAULT 'pending', error_message text, request_payload jsonb,
  previous_value jsonb, resolved_by uuid, resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text, nickname text, address_line1 text, is_demo boolean NOT NULL DEFAULT false,
  active boolean DEFAULT true, archived_at timestamptz, breezeway_mapping_state text, breezeway_property_id text, time_zone text,
  check_in_time text, ownerrez_property_id text, access jsonb, created_at timestamptz DEFAULT now());
INSERT INTO public.properties(id, name, address_line1, breezeway_mapping_state, breezeway_property_id, time_zone, check_in_time, ownerrez_property_id, access) VALUES
  ('${HOME}', 'Maple', '1 Maple St', 'verified', '11', 'America/New_York', '16:00', '9001', '{"lock_brand":"Yale","yale_integration_live":"true"}'),
  ('${UNVERIFIED}', 'Oak', '2 Oak St', 'pending', '12', NULL, NULL, '9002', NULL),
  ('${NEW_HOUSE}', 'New House Setup Elm', '3 Elm St', 'verified', '13', NULL, NULL, '9003', NULL),
  ('${TEST_HOME}', 'Fitz', '9211 Fitzgerald Dr.', 'verified', '14', 'America/New_York', '16:00', '9004', NULL),
  ('${CENTRAL_HOME}', 'Pine', '5 Pine St', 'verified', '15', NULL, NULL, '9005', NULL);
CREATE FUNCTION public.format_property_label(_p jsonb) RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT jsonb_build_object('primary', _p->>'address_line1') $$;
CREATE FUNCTION private.breezeway_is_new_house(_h text, _t text[], _n text, _nn text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce(_n,'') ILIKE '%new house%' $$;
CREATE TABLE public.work_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, category text NOT NULL,
  bucket text NOT NULL DEFAULT 'property_ownership', team text NOT NULL DEFAULT 'property_operations', functional_role_code text,
  default_priority text NOT NULL DEFAULT 'p3', response_minutes int NOT NULL DEFAULT 120, action_start_minutes int NOT NULL DEFAULT 480,
  completion_target text, required_closure_evidence text, active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_type text, title text, description text,
  property_id uuid, priority text, suggested_priority text, status text, source_channel text, initiator_type text,
  external_source text, external_id text, reported_at timestamptz, department_code text, functional_role_code text,
  work_type_id uuid, is_demo boolean NOT NULL DEFAULT false, due_at timestamptz, next_action text, next_action_due_at timestamptz,
  guest_in_residence boolean DEFAULT true, reservation_guest_name text, reservation_arrival date, reservation_departure date,
  reservation_guest_count int, reservation_snapshot_at timestamptz, response_due_at timestamptz, action_due_at timestamptz,
  assigned_to uuid, current_action_owner uuid, record_owner uuid, accountable_owner uuid, assignment_source text,
  assignment_note text, acknowledged_at timestamptz, resolved_at timestamptz, resolution_notes text, closure_evidence text,
  outcome_type text, closure_qa_result text DEFAULT 'not_reviewed', action_started_at timestamptz, archived_at timestamptz,
  archived_by uuid, archive_reason text);
CREATE UNIQUE INDEX tickets_external_unique ON public.tickets (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid, kind text,
  event_type text, body text, internal boolean, is_demo boolean, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.scorecard_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), about_user_id uuid, property_id uuid, stay_ref text, ticket_id uuid,
  note text, details jsonb NOT NULL DEFAULT '{}', refers_to uuid REFERENCES public.scorecard_records(id), is_demo boolean NOT NULL DEFAULT false,
  CONSTRAINT scorecard_records_kind_check CHECK (kind IN ('arrival_readiness','queue_sweep','coaching_cycle','weekly_submission','corrective_commitment','finance_packet')));
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text,
  entity_id uuid, is_demo boolean);
CREATE FUNCTION public.notify_staff(_u uuid, _k text, _t text, _b text, _et text, _eid uuid, _l text, _p text, _a uuid, _e boolean, _d boolean)
  RETURNS void LANGUAGE sql AS $$ INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_id, is_demo) VALUES (_u,_k,_t,_b,_eid,_d) $$;
CREATE TABLE public.breezeway_work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), breezeway_task_id bigint, property_id uuid,
  name text, department text, status text, stage text, report_url text, breezeway_created_at timestamptz);
INSERT INTO public.breezeway_work_orders(breezeway_task_id, property_id, name, department, status, stage) VALUES
  (501, '${HOME}', 'Replace filter', 'maintenance', 'Created', 'new'),
  (502, '${HOME}', 'Old leak', 'maintenance', 'Finished', 'finished');
CREATE TABLE public.owner_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, title text);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, title text);
`;

let db: PGlite;
const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];
const all = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
const as = async (uid: string | null) => {
  await db.exec("DELETE FROM public.me");
  if (uid) await db.exec(`INSERT INTO public.me VALUES ('${uid}')`);
};
const err = async (sql: string) => {
  try {
    await db.exec(sql);
  } catch (e) {
    return String((e as Error).message);
  }
  return "";
};
// The start line used by most checks: Nov 19, 2026, midnight UTC.
const setLine = async (at = "2026-11-19T00:00:00Z") => {
  await db.exec(`SELECT set_config('resolve.arrival_checks_switch','on',false);
    INSERT INTO public.app_settings(key, value) VALUES ('arrival_checks_start_line', jsonb_build_object('at','${at}'))
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    UPDATE public.feature_flags SET enabled = true WHERE key = 'arrival_checks';
    SELECT set_config('resolve.arrival_checks_switch','',false);`);
};
const ingest = async (rows: unknown[]) =>
  one(`SELECT public.arrival_ingest_bookings($1::jsonb) AS r`, [JSON.stringify(rows)]);
const run = async (at: string) => (await one(`SELECT private.arrival_checks_run($1::timestamptz) AS r`, [at])).r;
const booking = (id: string, over: Record<string, unknown> = {}) => ({
  id, property_id: 9001, arrival: "2026-11-20", departure: "2026-11-23", status: "active", type: "booking",
  is_block: false, guest_id: 77, guest: { first_name: "Dana", last_name: "Private" }, adults: 3, children: 1, pets: 1,
  booked_utc: "2026-11-01T00:00:00Z", ...over,
});
const complete = (me: string, check: string, at: string, lock = true, note: string | null = null,
  outcome = "ready", issue: string | null = null, plan: string | null = null) =>
  one(`SELECT private.arrival_check_complete($1, $2, $3, $4, true, $5, $6, $7, $8::timestamptz) AS r`,
    [me, check, lock, note, outcome, issue, plan, at]);

describe("arrival check SQL (isolated)", () => {
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(readFileSync(`${DIR}/01_arrival_check.sql`, "utf8"));
    await db.exec(readFileSync(`${DIR}/02_arrival_check_fixes.sql`, "utf8"));
  });

  it("creates the switch off, the work type out of the problem list and the new fact kind", async () => {
    expect((await one(`SELECT enabled FROM public.feature_flags WHERE key='arrival_checks'`)).enabled).toBe(false);
    expect(await one(`SELECT schedule, command FROM cron.jobs WHERE name='arrival-checks'`))
      .toEqual({ schedule: "* * * * *", command: "SELECT public.run_arrival_checks()" });
    const wt = await one(`SELECT active, default_priority, team FROM public.work_types WHERE name='Arrival check'`);
    expect(wt).toEqual({ active: false, default_priority: "p2", team: "property_operations" });
    await db.exec(`INSERT INTO public.scorecard_records(kind, recorded_by) VALUES ('arrival_check', '${ADMIN}')`);
    await db.exec(`INSERT INTO public.scorecard_records(kind, recorded_by) VALUES ('queue_sweep', '${ADMIN}')`);
    expect(await err(`INSERT INTO public.scorecard_records(kind, recorded_by) VALUES ('made_up', '${ADMIN}')`)).toContain("check");
  });

  it("moves the switch and start line only through the Admin switch", async () => {
    expect(await err(`UPDATE public.feature_flags SET enabled = true WHERE key='arrival_checks'`)).toContain("own switch");
    expect(await err(`INSERT INTO public.app_settings(key, value) VALUES ('arrival_checks_start_line','{"at":"2026-01-01"}')`))
      .toContain("start line");
    await as(COORD);
    expect(await err(`SELECT public.set_arrival_checks(true)`)).toContain("Only an Admin");
    await as(ADMIN);
    const r = (await one(`SELECT public.set_arrival_checks(true) AS r`)).r;
    expect(r.enabled).toBe(true);
    const line = (await one(`SELECT private.arrival_checks_start_line() AS l`)).l;
    expect(Math.abs(new Date(line).getTime() - Date.now())).toBeLessThan(10_000);
    expect((await one(`SELECT count(*)::int n FROM public.integration_events WHERE system='arrival_checks'`)).n).toBe(1);
  });

  it("makes nothing while the switch is off", async () => {
    await ingest([booking("b1")]);
    const r = await run("2026-11-20T12:00:00Z");
    expect(r.created).toBe(0);
    expect((await one(`SELECT count(*)::int n FROM public.arrival_checks`)).n).toBe(0);
  });

  it("makes one check at 6:00 AM Central with the home's own check in and a deadline 2 hours before", async () => {
    await setLine();
    await ingest([booking("b1")]);
    expect((await run("2026-11-20T11:59:00Z")).created).toBe(0); // 5:59 AM Central
    expect((await run("2026-11-20T12:00:00Z")).created).toBe(1); // 6:00 AM Central
    expect((await run("2026-11-20T12:01:00Z")).created).toBe(0);
    const c = await one(`SELECT * FROM public.arrival_checks`);
    expect(new Date(c.check_in_at).toISOString()).toBe("2026-11-20T21:00:00.000Z"); // 4:00 PM Eastern
    expect(new Date(c.deadline_at).toISOString()).toBe("2026-11-20T19:00:00.000Z"); // 2:00 PM Eastern
    expect(c.guest_first_name).toBe("Dana");
    expect(c.guests).toBe(4);
    expect(c.pets).toBe(1);
    expect(c.team).toBe("property_operations");
    const t = await one(`SELECT * FROM public.tickets WHERE id = $1`, [c.ticket_id]);
    expect(t.assigned_to).toBeNull();
    expect(t.priority).toBe("p2");
    expect(t.functional_role_code).toBe("po_day");
    expect(t.external_id).toBe("arrival:b1");
    expect(new Date(t.due_at).toISOString()).toBe("2026-11-20T19:00:00.000Z");
    expect(t.guest_in_residence).toBe(false);
    expect(JSON.stringify(t)).not.toContain("Private");
  });

  it("uses 4:00 PM Central when the home has no zone or time", async () => {
    await setLine();
    await ingest([booking("b5", { property_id: 9005 })]);
    await run("2026-11-20T12:00:00Z");
    const c = await one(`SELECT check_in_at FROM public.arrival_checks`);
    expect(new Date(c.check_in_at).toISOString()).toBe("2026-11-20T22:00:00.000Z");
  });

  it("records each skip with its reason", async () => {
    await setLine();
    await ingest([
      booking("prev", { arrival: "2026-11-17", departure: "2026-11-20" }),
      booking("ext"), // same guest, starts the day the stay before ends
      booking("can", { guest_id: 1, status: "cancelled" }),
      booking("blk", { guest_id: 2, is_block: true, type: "block", title: "Maintenance hold" }),
      booking("own", { guest_id: 3, is_block: true, type: "block", title: "Owner stay" }),
      booking("unv", { guest_id: 4, property_id: 9002 }),
      booking("nh", { guest_id: 5, property_id: 9003 }),
      booking("other", { guest_id: 6, property_id: 123456 }),
    ]);
    await run("2026-11-20T12:00:00Z");
    const rows = await all(`SELECT ownerrez_booking_id id, decision, decision_reason r FROM public.arrival_reservations ORDER BY 1`);
    const by = Object.fromEntries(rows.map((x) => [x.id, x.r ?? x.decision]));
    expect(by.ext).toBe("an extension of the stay before it");
    expect(by.can).toBe("cancelled");
    expect(by.blk).toBe("a block, not a stay");
    expect(by.own).toBe("created");
    expect(by.unv).toBe("not a verified Resolve home");
    expect(by.nh).toBe("New House home");
    expect(by.other).toBe("not a Resolve home");
    expect((await one(`SELECT owner_stay FROM public.arrival_checks WHERE ownerrez_booking_id='own'`)).owner_stay).toBe(true);
  });

  it("skips arrivals less than 2 hours after the start line", async () => {
    await setLine("2026-11-20T19:30:00Z"); // check in 21:00 is only 90 minutes after
    await ingest([booking("b1")]);
    await run("2026-11-20T19:31:00Z");
    expect((await one(`SELECT decision_reason r FROM public.arrival_reservations`)).r).toBe("before the start line");
  });

  it("completes on time, gives the credit to the person who did it and closes the ticket", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    const c = await one(`SELECT id, ticket_id FROM public.arrival_checks`);
    expect(await err(`SELECT private.arrival_check_complete('${COORD}', '${c.id}', false, NULL, true, 'ready', NULL, NULL, '2026-11-20T15:00:00Z')`))
      .toContain("note about the lock");
    expect(await err(`SELECT private.arrival_check_complete('${COORD}', '${c.id}', true, NULL, true, 'issue', 'Hot tub cold', NULL, '2026-11-20T15:00:00Z')`))
      .toContain("backup plan");
    expect(await err(`SELECT private.arrival_check_complete('${COORD}', '${c.id}', true, NULL, false, 'ready', NULL, NULL, '2026-11-20T15:00:00Z')`))
      .toContain("work orders");
    const r = (await complete(COORD, c.id, "2026-11-20T18:59:00Z")).r;
    expect(r.result).toBe("on_time");
    const t = await one(`SELECT status, assigned_to, outcome_type FROM public.tickets WHERE id=$1`, [c.ticket_id]);
    expect(t).toEqual({ status: "closed", assigned_to: COORD, outcome_type: "no_issue_found" });
    const f = await all(`SELECT about_user_id, details FROM public.scorecard_records WHERE kind='arrival_check'`);
    expect(f.length).toBe(1);
    expect(f[0].about_user_id).toBe(COORD);
    expect(f[0].details.counted).toBe(true);
    expect(f[0].details.counts_for).toBe("coordinator_homes_ready");
    expect(await err(`SELECT private.arrival_check_complete('${COORD}', '${c.id}', true, NULL, true, 'ready', NULL, NULL, '2026-11-20T19:00:00Z')`))
      .toContain("already done");
  });

  it("refuses a check someone else has, unless a Supervisor or Admin", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    const c = await one(`SELECT id, ticket_id FROM public.arrival_checks`);
    await db.exec(`UPDATE public.tickets SET assigned_to='${COORD2}' WHERE id='${c.ticket_id}'`);
    expect(await err(`SELECT private.arrival_check_complete('${COORD}', '${c.id}', true, NULL, true, 'ready', NULL, NULL, '2026-11-20T15:00:00Z')`))
      .toContain("Someone else");
    expect((await complete(SUP, c.id, "2026-11-20T15:00:00Z")).r.result).toBe("on_time");
  });

  it("an issue makes one ordinary issue ticket with the backup plan", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    const c = await one(`SELECT id FROM public.arrival_checks`);
    const r = (await complete(COORD, c.id, "2026-11-20T19:30:00Z", false, "Lock offline", "issue", "Lock offline", "Lockbox key ready")).r;
    expect(r.result).toBe("late");
    const t = await one(`SELECT title, description, property_id, status, priority, assigned_to, current_action_owner, assignment_note FROM public.tickets WHERE id=$1`, [r.issue_ticket_id]);
    expect(t.title).toBe("Arrival issue: 1 Maple St");
    // Found 90 minutes before check in: Right now, owned by the person who found it.
    expect(t.priority).toBe("p1");
    expect(t.assigned_to).toBe(COORD);
    expect(t.current_action_owner).toBe(COORD);
    expect(t.assignment_note).toBeNull();
    expect(t.description).toContain("Lockbox key ready");
    expect(t.property_id).toBe(HOME);
    expect(t.status).toBe("open");
  });

  it("sends one alert 30 minutes before the deadline, then marks missed at check in against the Supervisor's team", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    expect((await run("2026-11-20T18:29:00Z")).alerts).toBe(0);
    expect((await run("2026-11-20T18:30:00Z")).alerts).toBe(1);
    expect((await run("2026-11-20T18:45:00Z")).alerts).toBe(0);
    const n = await all(`SELECT user_id, title, body FROM public.staff_notifications`);
    expect(n.length).toBe(1);
    expect(n[0].user_id).toBe(SUP);
    // Shown in Central time: 2:00 PM Eastern is 1:00 PM Central.
    expect(n[0].title).toBe("Arrival check due at 1:00 PM at 1 Maple St, not done yet");
    expect((await run("2026-11-20T21:00:00Z")).missed).toBe(1);
    const c = await one(`SELECT id, result, ticket_id FROM public.arrival_checks`);
    expect(c.result).toBe("missed");
    expect((await one(`SELECT status FROM public.tickets WHERE id=$1`, [c.ticket_id])).status).toBe("open");
    const f = await one(`SELECT id, about_user_id, details FROM public.scorecard_records WHERE kind='arrival_check'`);
    expect(f.about_user_id).toBe(SUP);
    expect(f.details.counts_for).toBe("ops_supervisor_team_follow_through");
    // Finished after check in: still missed, a second line refers to the first.
    expect((await complete(COORD, c.id, "2026-11-20T21:30:00Z")).r.result).toBe("missed");
    const later = await one(`SELECT refers_to, details FROM public.scorecard_records WHERE refers_to IS NOT NULL`);
    expect(later.refers_to).toBe(f.id);
    expect(later.details.event).toBe("completed_after_check_in");
  });

  it("a late booking is made at once, kept, and never counted", async () => {
    await setLine();
    await ingest([booking("late", { booked_utc: "2026-11-20T20:00:00Z" })]);
    expect((await run("2026-11-20T20:01:00Z")).created).toBe(1);
    const c = await one(`SELECT id, late_booking FROM public.arrival_checks`);
    expect(c.late_booking).toBe(true);
    await complete(COORD, c.id, "2026-11-20T20:30:00Z");
    expect((await one(`SELECT details FROM public.scorecard_records`)).details.counted).toBe(false);
  });

  it("a cancelled reservation closes the open check out of every count", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    await ingest([booking("b1", { status: "cancelled" })]);
    expect((await run("2026-11-20T13:00:00Z")).cancelled).toBe(1);
    const c = await one(`SELECT status, ticket_id FROM public.arrival_checks`);
    expect(c.status).toBe("cancelled");
    expect((await one(`SELECT outcome_type FROM public.tickets WHERE id=$1`, [c.ticket_id])).outcome_type).toBe("cancelled_by_requestor");
    await run("2026-11-20T21:00:00Z");
    expect((await one(`SELECT count(*)::int n FROM public.scorecard_records`)).n).toBe(0);
  });

  it("checks change only through the steps and are never deleted", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    expect(await err(`UPDATE public.arrival_checks SET result = 'on_time'`)).toContain("only through");
    expect(await err(`DELETE FROM public.arrival_checks`)).toContain("never deleted");
  });

  it("never turns a check ticket into a homeowner notice or Opportunity; an issue ticket stays ordinary", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    const c = await one(`SELECT id, ticket_id FROM public.arrival_checks`);
    await db.exec(`INSERT INTO public.owner_notifications(ticket_id, title) VALUES ('${c.ticket_id}', 'x')`);
    await db.exec(`INSERT INTO public.owner_reviews(ticket_id, title) VALUES ('${c.ticket_id}', 'x')`);
    const r = (await complete(COORD, c.id, "2026-11-20T15:00:00Z", true, null, "issue", "Broken blind", "Fixed by vendor at 1 PM")).r;
    expect((await one(`SELECT priority FROM public.tickets WHERE id=$1`, [r.issue_ticket_id])).priority).toBe("p2"); // 6 hours out: Today
    expect((await one(`SELECT current_action_owner FROM public.tickets WHERE id=$1`, [c.ticket_id])).current_action_owner).toBe(COORD);
    await db.exec(`INSERT INTO public.owner_notifications(ticket_id, title) VALUES ('${r.issue_ticket_id}', 'y')`);
    expect((await all(`SELECT title FROM public.owner_notifications`)).map((x) => x.title)).toEqual(["y"]);
    expect((await one(`SELECT count(*)::int n FROM public.owner_reviews`)).n).toBe(0);
  });

  it("test checks work with the switch off, are hidden demo records and clear", async () => {
    await as(COORD);
    expect(await err(`SELECT public.make_test_arrival_check(180)`)).toContain("Only an Admin");
    await as(ADMIN);
    const r = (await one(`SELECT public.make_test_arrival_check(60) AS r`)).r;
    const c = await one(`SELECT is_test, late_booking, property_id FROM public.arrival_checks WHERE id=$1`, [r.check_id]);
    expect(c).toEqual({ is_test: true, late_booking: true, property_id: TEST_HOME });
    const t = await one(`SELECT is_demo, property_id, title FROM public.tickets WHERE id=$1`, [r.ticket_id]);
    expect(t.is_demo).toBe(true);
    expect(t.property_id).toBeNull();
    expect(t.title).toBe("Arrival check: 9211 Fitzgerald Dr. (test)");
    const cleared = (await one(`SELECT public.clear_test_arrival_checks() AS r`)).r;
    expect(cleared.cleared).toBe(1);
    expect((await one(`SELECT archived_at IS NOT NULL a FROM public.tickets WHERE id=$1`, [r.ticket_id])).a).toBe(true);
  });

  it("the ticket page reads the lock brand and only open Breezeway work orders", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    const c = await one(`SELECT ticket_id FROM public.arrival_checks`);
    await as(COORD);
    const d = (await one(`SELECT public.arrival_check_for_ticket($1) AS d`, [c.ticket_id])).d;
    expect(d.lock_brand).toBe("Yale");
    expect(d.work_orders.map((w) => w.id)).toEqual([501]);
    await as(null);
    expect((await one(`SELECT public.arrival_check_for_ticket($1) AS d`, [c.ticket_id])).d).toBeNull();
  });

  it("the 02 undo puts back the 01 functions exactly", async () => {
    await db.exec(readFileSync(`${DIR}/undo/02_arrival_check_fixes.sql`, "utf8"));
    expect((await one(`SELECT private.arrival_fmt_time('2026-11-20T19:00:00Z', 'America/New_York') AS t`)).t).toBe("2:00 PM");
  });

  it("the undo removes the steps and keeps the records", async () => {
    await setLine();
    await ingest([booking("b1")]);
    await run("2026-11-20T12:00:00Z");
    await db.exec(readFileSync(`${DIR}/undo/01_arrival_check.sql`, "utf8"));
    expect((await one(`SELECT count(*)::int n FROM pg_proc WHERE proname LIKE '%arrival_check%'`)).n).toBeLessThanOrEqual(6);
    expect((await one(`SELECT count(*)::int n FROM public.arrival_checks`)).n).toBe(1);
    expect((await one(`SELECT count(*)::int n FROM cron.jobs`)).n).toBe(0);
    expect((await one(`SELECT enabled FROM public.feature_flags WHERE key='arrival_checks'`)).enabled).toBe(false);
  });
});
