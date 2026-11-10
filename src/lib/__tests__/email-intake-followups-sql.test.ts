// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/email-intake-followups (register E1 (e), one switch).
 * The safety batch (01-schema.sql) is applied first, exactly as it is live, then the follow up.
 * Tables are stubbed. Nothing touches the real database.
 */
const SAFETY = "docs/pending/email-intake-safety";
const DIR = "docs/pending/email-intake-followups";
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const COORD = "00000000-0000-4000-8000-0000000000c1";
const OLD_LINE = "2026-09-01T23:20:20Z";

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
INSERT INTO public.feature_flags(key, label, enabled) VALUES ('email_intake','Email intake', false);
CREATE TABLE public.integration_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system text NOT NULL, direction text NOT NULL,
  operation text NOT NULL, external_id text, entity_type text, entity_id uuid, status text NOT NULL DEFAULT 'pending',
  error_message text, request_payload jsonb, previous_value jsonb, resolved_by uuid, resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO public.integration_events(system, direction, operation, external_id, status)
  VALUES ('outlook_inbox','inbound','processing_checkpoint','${OLD_LINE}','checkpoint');
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, is_demo boolean NOT NULL DEFAULT false,
  external_source text, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE FUNCTION public.archive_ticket(_ticket_id uuid, _reason text) RETURNS jsonb LANGUAGE sql AS $f$ SELECT '{}'::jsonb $f$;
CREATE TABLE public.leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), is_demo boolean NOT NULL DEFAULT false, source_detail jsonb,
  outcome text, outcome_at timestamptz, outcome_by uuid, not_booked_reason text, not_booked_note text, stage text DEFAULT 'new',
  lost_at timestamptz, lost_note text, updated_at timestamptz);
CREATE TABLE public.lead_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid, channel text, outcome text, note text,
  to_stage text, actor_id uuid);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, entity_type text,
  entity_id uuid, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE cron.job(jobid bigserial PRIMARY KEY, jobname text, schedule text, command text, active boolean);
INSERT INTO cron.job(jobname, schedule, command, active) VALUES ('resolve-mailbox-sync','*/10 * * * *', 'select 1', false);
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
const state = async () => ({
  enabled: (await one(`SELECT enabled FROM public.feature_flags WHERE key='email_intake'`)).enabled,
  timed: (await one(`SELECT active FROM cron.job WHERE jobname='resolve-mailbox-sync'`))?.active ?? null,
});
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
  await db.exec(readFileSync(`${SAFETY}/01-schema.sql`, "utf8"));
  await db.exec(readFileSync(`${DIR}/01-one-switch.sql`, "utf8"));
});

describe("E1 (e): one switch starts and stops the timed check", () => {
  it("starts off: the switch and the timed check are both off", async () => {
    expect(await state()).toEqual({ enabled: false, timed: false });
  });

  it("turning email intake on starts the timed check in the same step", async () => {
    await as(ADMIN);
    const r = (await one(`SELECT public.set_email_intake(true) AS r`)).r;
    expect(r).toMatchObject({ enabled: true, changed: true, timed_check: true });
    expect(await state()).toEqual({ enabled: true, timed: true });
    // The start line still moves forward, as the safety batch built it.
    const moved = (await one(`SELECT external_id FROM public.integration_events WHERE operation='processing_checkpoint'`)).external_id;
    expect(new Date(moved).getTime()).toBeGreaterThan(new Date(OLD_LINE).getTime());
    const audit = await one(`SELECT status, resolved_by, previous_value, request_payload FROM public.integration_events WHERE operation='email_intake_switch'`);
    expect(audit.status).toBe("on");
    expect(audit.resolved_by).toBe(ADMIN);
    expect(audit.previous_value).toEqual({ enabled: false, start_line: OLD_LINE, timed_check: false });
    expect(audit.request_payload).toEqual({ enabled: true, start_line: moved, timed_check: true });
  });

  it("turning it off stops the timed check in the same step and leaves the start line", async () => {
    await as(ADMIN);
    await db.exec(`SELECT public.set_email_intake(true)`);
    const onLine = (await one(`SELECT external_id FROM public.integration_events WHERE operation='processing_checkpoint'`)).external_id;
    const r = (await one(`SELECT public.set_email_intake(false) AS r`)).r;
    expect(r).toMatchObject({ enabled: false, changed: true, timed_check: false });
    expect(await state()).toEqual({ enabled: false, timed: false });
    expect((await one(`SELECT external_id FROM public.integration_events WHERE operation='processing_checkpoint'`)).external_id).toBe(onLine);
  });

  it("a coordinator is refused and neither the switch nor the timed check moves", async () => {
    await as(COORD);
    expect(await err(`SELECT public.set_email_intake(true)`)).toContain("Only an Admin");
    expect(await state()).toEqual({ enabled: false, timed: false });
  });

  it("never on without its timed check: a missing timed check refuses and changes nothing", async () => {
    await db.exec(`DELETE FROM cron.job WHERE jobname='resolve-mailbox-sync'`);
    await as(ADMIN);
    expect(await err(`SELECT public.set_email_intake(true)`)).toContain("timed check was not found");
    expect((await one(`SELECT enabled FROM public.feature_flags WHERE key='email_intake'`)).enabled).toBe(false);
    expect((await one(`SELECT external_id FROM public.integration_events WHERE operation='processing_checkpoint'`)).external_id).toBe(OLD_LINE);
    expect((await one(`SELECT count(*)::int n FROM public.integration_events WHERE operation='email_intake_switch'`)).n).toBe(0);
  });

  it("a failure inside the step leaves no half on state", async () => {
    // The timed check cannot be changed: the whole step is undone, switch included.
    await db.exec(`CREATE OR REPLACE FUNCTION cron.alter_job(job_id bigint, schedule text DEFAULT NULL, command text DEFAULT NULL,
      database text DEFAULT NULL, username text DEFAULT NULL, active boolean DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS
      $f$ BEGIN RAISE EXCEPTION 'scheduler unavailable'; END $f$`);
    await as(ADMIN);
    expect(await err(`SELECT public.set_email_intake(true)`)).toContain("scheduler unavailable");
    expect(await state()).toEqual({ enabled: false, timed: false });
    expect((await one(`SELECT external_id FROM public.integration_events WHERE operation='processing_checkpoint'`)).external_id).toBe(OLD_LINE);
  });

  it("a timed check left out of step is matched to the switch, and that is recorded", async () => {
    await db.exec(`UPDATE cron.job SET active = true WHERE jobname='resolve-mailbox-sync'`);
    await as(ADMIN);
    const r = (await one(`SELECT public.set_email_intake(false) AS r`)).r;
    expect(r).toMatchObject({ enabled: false, changed: false, timed_check: false });
    expect(await state()).toEqual({ enabled: false, timed: false });
    const fix = await one(`SELECT status, request_payload FROM public.integration_events WHERE operation='email_intake_timed_check'`);
    expect(fix).toEqual({ status: "off", request_payload: { timed_check: false, reason: "matched to the switch" } });
    expect((await one(`SELECT count(*)::int n FROM public.integration_events WHERE operation='email_intake_switch'`)).n).toBe(0);
  });

  it("asking for the state it is already in, in step, changes nothing", async () => {
    await as(ADMIN);
    const r = (await one(`SELECT public.set_email_intake(false) AS r`)).r;
    expect(r).toMatchObject({ enabled: false, changed: false });
    expect((await one(`SELECT count(*)::int n FROM public.integration_events WHERE operation IN ('email_intake_switch','email_intake_timed_check')`)).n).toBe(0);
  });

  it("the switch still cannot be flipped directly", async () => {
    expect(await err(`UPDATE public.feature_flags SET enabled = true WHERE key = 'email_intake'`)).toContain(
      "can only be turned on or off with its own switch",
    );
  });

  it("undo puts the safety batch version back: on no longer starts the timed check", async () => {
    await db.exec(readFileSync(`${DIR}/undo.sql`, "utf8"));
    await as(ADMIN);
    const r = (await one(`SELECT public.set_email_intake(true) AS r`)).r;
    expect(r.timed_check).toBeUndefined();
    expect(await state()).toEqual({ enabled: true, timed: false });
  });
});
