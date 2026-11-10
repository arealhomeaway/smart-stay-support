// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/email-intake-safety. Tables are
 * stubbed. Nothing touches the real database.
 */
const DIR = "docs/pending/email-intake-safety";
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const COORD = "00000000-0000-4000-8000-0000000000c1";
const OLD_LINE = "2026-09-01T23:20:20Z";
const OLD_COMMAND = `select net.http_post(url := 'https://example/api/public/sync/mailbox', headers := '{"apikey": "public"}'::jsonb)`;

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA cron; CREATE SCHEMA net;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech');
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${COORD}','tech');
CREATE FUNCTION private.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
CREATE FUNCTION private.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u) $$;
CREATE FUNCTION private.is_supervisor(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role::text IN ('admin','manager')) $$;
CREATE FUNCTION private.sc_is_ops_supervisor(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.feature_flags(key text PRIMARY KEY, label text NOT NULL, enabled boolean NOT NULL DEFAULT false,
  updated_by uuid, updated_at timestamptz DEFAULT now());
INSERT INTO public.feature_flags(key, label, enabled) VALUES ('email_intake','Email intake', false), ('work_map','Work map', false);
CREATE TABLE public.integration_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system text NOT NULL, direction text NOT NULL,
  operation text NOT NULL, external_id text, entity_type text, entity_id uuid, status text NOT NULL DEFAULT 'pending',
  error_message text, request_payload jsonb, previous_value jsonb, resolved_by uuid, resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.integration_events(system, direction, operation, external_id, status)
  VALUES ('outlook_inbox','inbound','processing_checkpoint','${OLD_LINE}','checkpoint');
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, is_demo boolean NOT NULL DEFAULT false,
  external_source text, archived_at timestamptz, archived_by uuid, archive_reason text, created_at timestamptz DEFAULT now());
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid, kind text,
  event_type text, body text, internal boolean, is_demo boolean);
CREATE FUNCTION public.archive_ticket(_ticket_id uuid, _reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $f$
DECLARE _me uuid := auth.uid(); _t record; _why text := btrim(coalesce(_reason, ''));
BEGIN
  IF _me IS NULL OR NOT (private.is_supervisor(_me) OR private.sc_is_ops_supervisor(_me)) THEN
    RAISE EXCEPTION 'Only an Admin or a Supervisor can archive a ticket.'; END IF;
  IF length(_why) < 3 OR length(_why) > 500 THEN RAISE EXCEPTION 'Give a short reason for archiving.'; END IF;
  SELECT id, archived_at, is_demo INTO _t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This ticket was not found.'; END IF;
  IF _t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This ticket is already archived.'; END IF;
  UPDATE public.tickets SET archived_at = now(), archived_by = _me, archive_reason = _why WHERE id = _ticket_id;
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
  VALUES (_ticket_id, _me, 'status', 'archived', 'Archived. Reason: ' || _why, true, coalesce(_t.is_demo, false));
  RETURN jsonb_build_object('ticket_id', _ticket_id, 'archived', true);
END $f$;
CREATE TABLE public.leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), is_demo boolean NOT NULL DEFAULT false, source_detail jsonb,
  outcome text, outcome_at timestamptz, outcome_by uuid, not_booked_reason text, not_booked_note text, stage text DEFAULT 'new',
  lost_at timestamptz, lost_note text, updated_at timestamptz);
CREATE TABLE public.lead_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid, channel text, outcome text, note text,
  to_stage text, actor_id uuid);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, entity_type text,
  entity_id uuid, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE cron.job(jobid bigserial PRIMARY KEY, jobname text, schedule text, command text, active boolean);
INSERT INTO cron.job(jobname, schedule, command, active) VALUES ('resolve-mailbox-sync','*/10 * * * *', $c$${OLD_COMMAND}$c$, false);
CREATE FUNCTION cron.alter_job(job_id bigint, schedule text DEFAULT NULL, command text DEFAULT NULL, database text DEFAULT NULL,
  username text DEFAULT NULL, active boolean DEFAULT NULL) RETURNS void LANGUAGE sql AS $f$
  UPDATE cron.job SET schedule = coalesce(alter_job.schedule, cron.job.schedule), command = coalesce(alter_job.command, cron.job.command),
    active = coalesce(alter_job.active, cron.job.active) WHERE jobid = alter_job.job_id $f$;
`;

let db: PGlite;
const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];
const as = async (uid: string | null) => {
  await db.exec("DELETE FROM public.me");
  if (uid) await db.exec(`INSERT INTO public.me VALUES ('${uid}')`);
};
const line = async () =>
  (await one(`SELECT external_id FROM public.integration_events WHERE operation='processing_checkpoint'`)).external_id;
const err = async (sql: string) => {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(`${DIR}/01-schema.sql`, "utf8"));
});

describe("1 and 2: the switch is real and turning it on sets the start line", () => {
  it("a direct change to the switch is refused (no other way to turn it on)", async () => {
    await as(ADMIN);
    expect(await err(`UPDATE public.feature_flags SET enabled = true WHERE key = 'email_intake'`)).toContain(
      "can only be turned on or off with its own switch",
    );
    expect((await one(`SELECT enabled FROM public.feature_flags WHERE key='email_intake'`)).enabled).toBe(false);
    // Other switches are untouched by the guard.
    expect(await err(`UPDATE public.feature_flags SET enabled = true WHERE key = 'work_map'`)).toBeNull();
  });

  it("only an Admin can turn it on", async () => {
    await as(COORD);
    expect(await err(`SELECT public.set_email_intake(true)`)).toContain("Only an Admin");
    expect(await line()).toBe(OLD_LINE);
  });

  it("turning on moves the start line to that moment and records who and when", async () => {
    await as(ADMIN);
    const before = Date.now();
    const r = (await one(`SELECT public.set_email_intake(true) AS r`)).r;
    expect(r.enabled).toBe(true);
    expect(r.changed).toBe(true);
    const moved = await line();
    expect(new Date(moved).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(moved).getTime()).toBeGreaterThan(new Date(OLD_LINE).getTime());
    expect(moved).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    const flag = await one(`SELECT enabled, updated_by FROM public.feature_flags WHERE key='email_intake'`);
    expect(flag).toEqual({ enabled: true, updated_by: ADMIN });
    const audit = await one(
      `SELECT status, resolved_by, resolved_at IS NOT NULL AS stamped, previous_value, request_payload
         FROM public.integration_events WHERE operation='email_intake_switch'`,
    );
    expect(audit.status).toBe("on");
    expect(audit.resolved_by).toBe(ADMIN);
    expect(audit.stamped).toBe(true);
    expect(audit.previous_value).toEqual({ enabled: false, start_line: OLD_LINE });
    expect(audit.request_payload.start_line).toBe(moved);
  });

  it("turning off leaves the line where it is and is recorded", async () => {
    await as(ADMIN);
    await db.exec(`SELECT public.set_email_intake(true)`);
    const onLine = await line();
    await db.exec(`SELECT public.set_email_intake(false)`);
    expect(await line()).toBe(onLine);
    expect((await one(`SELECT enabled FROM public.feature_flags WHERE key='email_intake'`)).enabled).toBe(false);
    const rows = (await db.query(`SELECT status FROM public.integration_events WHERE operation='email_intake_switch' ORDER BY created_at, status DESC`)).rows;
    expect(rows.map((x) => x.status).sort()).toEqual(["off", "on"]);
  });

  it("the line only moves forward", async () => {
    await db.exec(`UPDATE public.integration_events SET external_id='2099-01-01T00:00:00Z' WHERE operation='processing_checkpoint'`);
    await as(ADMIN);
    await db.exec(`SELECT public.set_email_intake(true)`);
    expect(await line()).toBe("2099-01-01T00:00:00Z");
  });

  it("asking for the state it is already in changes nothing", async () => {
    await as(ADMIN);
    const r = (await one(`SELECT public.set_email_intake(false) AS r`)).r;
    expect(r.changed).toBe(false);
    expect(await line()).toBe(OLD_LINE);
    expect((await one(`SELECT count(*)::int n FROM public.integration_events WHERE operation='email_intake_switch'`)).n).toBe(0);
  });
});

describe("4: the timed sweep job", () => {
  it("runs every minute with the private scheduler token, stays off, and calls nothing while the switch is off", async () => {
    const job = await one(`SELECT schedule, command, active FROM cron.job WHERE jobname='resolve-mailbox-sync'`);
    expect(job.schedule).toBe("* * * * *");
    expect(job.active).toBe(false);
    expect(job.command).toContain("x-cron-secret");
    expect(job.command).toContain("private.cleaner_cron_token");
    expect(job.command).not.toContain("apikey");
    expect(job.command).toContain("WHERE EXISTS (SELECT 1 FROM public.feature_flags WHERE key = 'email_intake' AND enabled)");
  });

  it("the panel can read the job state (staff only)", async () => {
    await as(COORD);
    expect((await one(`SELECT public.email_intake_sweep_job() AS j`)).j).toEqual({ active: false, schedule: "* * * * *" });
    await as(null);
    expect((await one(`SELECT public.email_intake_sweep_job() AS j`)).j).toBeNull();
  });

  it("undo puts the old job back exactly and removes what was added", async () => {
    await db.exec(readFileSync(`${DIR}/undo.sql`, "utf8"));
    const job = await one(`SELECT schedule, command, active FROM cron.job WHERE jobname='resolve-mailbox-sync'`);
    expect(job).toEqual({ schedule: "*/10 * * * *", command: OLD_COMMAND, active: false });
    expect((await one(`SELECT count(*)::int n FROM pg_proc WHERE proname IN ('set_email_intake','clear_email_intake_test_records','email_intake_sweep_job','prefix_email_test_alert','guard_email_intake_switch')`)).n).toBe(0);
    expect(await err(`UPDATE public.feature_flags SET enabled = false WHERE key = 'email_intake'`)).toBeNull();
  });
});

describe("5: test records", () => {
  it("alerts about an email test record start with Test; other alerts are unchanged", async () => {
    const testLead = (await one(`INSERT INTO public.leads(is_demo, source_detail) VALUES (true, '{"origin":"outlook","email_test":true}') RETURNING id`)).id;
    const demoLead = (await one(`INSERT INTO public.leads(is_demo, source_detail) VALUES (true, '{"origin":"manual"}') RETURNING id`)).id;
    const testTicket = (await one(`INSERT INTO public.tickets(is_demo, external_source) VALUES (true, 'email') RETURNING id`)).id;
    const liveTicket = (await one(`INSERT INTO public.tickets(is_demo, external_source) VALUES (false, 'email') RETURNING id`)).id;
    const add = (type: string, id: string, demo: boolean, title: string) =>
      one(`INSERT INTO public.staff_notifications(user_id, title, entity_type, entity_id, is_demo) VALUES ($1,$2,$3,$4,$5) RETURNING title`, [COORD, title, type, id, demo]);
    expect((await add("lead", testLead, true, "New direct booking request")).title).toBe("Test: New direct booking request");
    expect((await add("lead", demoLead, true, "New direct booking request")).title).toBe("New direct booking request");
    expect((await add("ticket", testTicket, true, "#12 AC not cooling")).title).toBe("Test: #12 AC not cooling");
    expect((await add("ticket", liveTicket, false, "#13 AC not cooling")).title).toBe("#13 AC not cooling");
    expect((await add("lead", testLead, true, "Test: already marked")).title).toBe("Test: already marked");
  });

  it("Clear test records archives each test Ticket and closes each test request, with counts and history", async () => {
    const t1 = (await one(`INSERT INTO public.tickets(is_demo, external_source) VALUES (true, 'email') RETURNING id`)).id;
    const t2 = (await one(`INSERT INTO public.tickets(is_demo, external_source) VALUES (true, 'email') RETURNING id`)).id;
    const demoOther = (await one(`INSERT INTO public.tickets(is_demo, external_source) VALUES (true, null) RETURNING id`)).id;
    const live = (await one(`INSERT INTO public.tickets(is_demo, external_source) VALUES (false, 'email') RETURNING id`)).id;
    const l1 = (await one(`INSERT INTO public.leads(is_demo, source_detail) VALUES (true, '{"email_test":true}') RETURNING id`)).id;
    const liveLead = (await one(`INSERT INTO public.leads(is_demo, source_detail) VALUES (false, '{"origin":"outlook"}') RETURNING id`)).id;

    await as(COORD);
    expect(await err(`SELECT public.clear_email_intake_test_records()`)).toContain("Only an Admin");

    await as(ADMIN);
    const r = (await one(`SELECT public.clear_email_intake_test_records() AS r`)).r;
    expect(r).toEqual({ tickets: 2, requests: 1 });
    for (const id of [t1, t2]) {
      const t = await one(`SELECT archived_at IS NOT NULL a, archived_by, archive_reason FROM public.tickets WHERE id=$1`, [id]);
      expect(t).toEqual({ a: true, archived_by: ADMIN, archive_reason: "Email intake test" });
    }
    for (const id of [demoOther, live]) {
      expect((await one(`SELECT archived_at FROM public.tickets WHERE id=$1`, [id])).archived_at).toBeNull();
    }
    const lead = await one(`SELECT outcome, not_booked_reason, not_booked_note, outcome_by, stage FROM public.leads WHERE id=$1`, [l1]);
    expect(lead).toEqual({ outcome: "not_booked", not_booked_reason: "Other", not_booked_note: "Email intake test", outcome_by: ADMIN, stage: "lost" });
    expect((await one(`SELECT outcome FROM public.leads WHERE id=$1`, [liveLead])).outcome).toBeNull();
    expect((await one(`SELECT count(*)::int n FROM public.lead_activity WHERE lead_id=$1 AND actor_id=$2`, [l1, ADMIN])).n).toBe(1);
    const hist = await one(`SELECT resolved_by, request_payload FROM public.integration_events WHERE operation='test_records_cleared'`);
    expect(hist).toEqual({ resolved_by: ADMIN, request_payload: { tickets: 2, requests: 1 } });

    // A second press finds nothing left.
    expect((await one(`SELECT public.clear_email_intake_test_records() AS r`)).r).toEqual({ tickets: 0, requests: 0 });
  });
});

describe("6: the Sep 1 claim", () => {
  it("the data step marks only that processing claim skipped, and undo puts it back", async () => {
    await db.exec(`INSERT INTO public.integration_events(id, system, direction, operation, external_id, status)
      VALUES ('8fbaabe8-805d-4f0d-a1c7-95660ab999b9','outlook_inbox','inbound','mailbox_message','AAMk-sep1','processing'),
             (gen_random_uuid(),'outlook_inbox','inbound','mailbox_message','AAMk-other','processing')`);
    await db.exec(readFileSync(`${DIR}/02-data.sql`, "utf8"));
    const rows = (await db.query(`SELECT external_id, status FROM public.integration_events WHERE operation='mailbox_message' ORDER BY external_id`)).rows;
    expect(rows).toEqual([{ external_id: "AAMk-other", status: "processing" }, { external_id: "AAMk-sep1", status: "skipped" }]);
    await db.exec(readFileSync(`${DIR}/undo.sql`, "utf8"));
    expect((await one(`SELECT status, error_message FROM public.integration_events WHERE external_id='AAMk-sep1'`))).toEqual({ status: "processing", error_message: null });
  });
});
