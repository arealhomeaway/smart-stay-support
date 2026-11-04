import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of the pending app ticket routing change
 * (docs/pending/team-coverage-pass-a/01). The live seat rule functions are
 * reproduced verbatim; only tables are stubbed. Nothing touches the real
 * database.
 */
const DIR = "docs/pending/team-coverage-pass-a";
const read = (p: string) => readFileSync(p, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const holder = U(1), backupHolder = U(2), sup = U(3), cover = U(4), oncall = U(5), oncall2 = U(6);
let db: PGlite;

const LIVE_HELPERS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE TABLE public.coverage_config(id boolean PRIMARY KEY DEFAULT true, timezone text, after_hours_start_minute int, after_hours_end_minute int);
CREATE TABLE public.work_types(id uuid PRIMARY KEY, pending_approval boolean DEFAULT false, functional_role_code text);
CREATE TABLE public.functional_roles(code text PRIMARY KEY, name text, backup_role_code text, current_seat_holder uuid, active boolean DEFAULT true, available boolean DEFAULT true);
CREATE TABLE public.coverage_shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_code text, weekday int, start_minute int, end_minute int, active boolean DEFAULT true);
CREATE TABLE public.coverage_overrides(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_code text, kind text, user_id uuid, starts_at timestamptz, ends_at timestamptz, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.oncall_roster(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, starts_on date, ends_on date, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.tickets(id serial PRIMARY KEY, status text DEFAULT 'new', work_type_id uuid, functional_role_code text, current_action_owner uuid, assigned_to uuid, assignment_source text, assignment_note text);
CREATE OR REPLACE FUNCTION public.staff_assignable(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role::text IN ('admin','manager','onboarding','tech')) $f$;
CREATE OR REPLACE FUNCTION public.seat_on_duty(_role_code text, _at timestamp with time zone DEFAULT now()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.coverage_shifts c WHERE c.role_code = _role_code AND c.active) THEN true
  ELSE EXISTS (SELECT 1 FROM public.coverage_shifts c WHERE c.role_code = _role_code AND c.active
    AND c.weekday = EXTRACT(dow FROM (_at AT TIME ZONE 'America/Chicago'))::int
    AND (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60 + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int) >= c.start_minute
    AND (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60 + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int) < c.end_minute) END $f$;
CREATE OR REPLACE FUNCTION public.seat_override_at(_role_code text, _at timestamp with time zone DEFAULT now()) RETURNS TABLE(kind text, user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT o.kind, o.user_id FROM public.coverage_overrides o WHERE o.role_code = _role_code AND _at >= o.starts_at AND _at < o.ends_at ORDER BY o.created_at DESC LIMIT 1 $f$;
CREATE OR REPLACE FUNCTION public.seat_eligible_now(_role_code text, _at timestamp with time zone DEFAULT now()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT CASE WHEN (SELECT kind FROM public.seat_override_at(_role_code, _at)) = 'off' THEN false
    WHEN (SELECT kind FROM public.seat_override_at(_role_code, _at)) = 'cover' THEN true
    WHEN NOT COALESCE((SELECT r.available FROM public.functional_roles r WHERE r.code = _role_code), true) THEN false
    ELSE public.seat_on_duty(_role_code, _at) END $f$;
CREATE OR REPLACE FUNCTION public.seat_holder_at(_role_code text, _at timestamp with time zone DEFAULT now()) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT COALESCE((SELECT o.user_id FROM public.seat_override_at(_role_code, _at) o WHERE o.kind = 'cover'),
    (SELECT r.current_seat_holder FROM public.functional_roles r WHERE r.code = _role_code)) $f$;
`;

const LIVE = read(`${DIR}/live-capture/public.auto_assign_ticket.sql`) + ";";
const NEW = read(`${DIR}/01_auto_assign_ticket_overrides.sql`);
const UNDO = read(`${DIR}/01_undo_auto_assign_ticket_overrides.sql`);

async function reset(overnight: boolean) {
  await db.exec(`TRUNCATE public.coverage_overrides, public.oncall_roster, public.tickets, public.coverage_shifts;
    UPDATE public.functional_roles SET available = true, active = true;`);
  // Every minute of every weekday is "on duty", so only overrides and availability decide.
  for (const code of ["ge_day", "po_day", "ops_supervisor"])
    for (let d = 0; d < 7; d++)
      await db.query("INSERT INTO public.coverage_shifts(role_code, weekday, start_minute, end_minute) VALUES ($1,$2,0,1440)", [code, d]);
  // Put the after-hours window around (or away from) the current Central minute.
  const now = (await db.query<{ m: number }>(`SELECT (EXTRACT(hour FROM now() AT TIME ZONE 'America/Chicago')*60 + EXTRACT(minute FROM now() AT TIME ZONE 'America/Chicago'))::int m`)).rows[0]!.m;
  const start = overnight ? now : (now + 120) % 1440;
  const end = overnight ? (now + 60) % 1440 : (now + 180) % 1440;
  await db.query("UPDATE public.coverage_config SET after_hours_start_minute=$1, after_hours_end_minute=$2", [start, end]);
}

const route = async (role = "ge_day") => {
  const r = await db.query<{ assigned_to: string | null; assignment_note: string }>(
    "INSERT INTO public.tickets(functional_role_code) VALUES ($1) RETURNING assigned_to, assignment_note", [role]);
  return r.rows[0]!;
};
const off = (role: string) => db.query(`INSERT INTO public.coverage_overrides(role_code, kind, starts_at, ends_at) VALUES ($1,'off', now() - interval '1 hour', now() + interval '1 hour')`, [role]);
const coverBy = (role: string, user: string) => db.query(`INSERT INTO public.coverage_overrides(role_code, kind, user_id, starts_at, ends_at) VALUES ($1,'cover',$2, now() - interval '1 hour', now() + interval '1 hour')`, [role, user]);
const useFn = (sql: string) => db.exec(sql);

describe("App ticket routing honors coverage overrides (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(LIVE_HELPERS);
    await db.exec(`INSERT INTO public.coverage_config(timezone) VALUES ('America/Chicago');
      INSERT INTO public.functional_roles(code, name, backup_role_code, current_seat_holder) VALUES
        ('ge_day','Guest Experience day','po_day','${holder}'), ('po_day','Property Operations day',NULL,'${backupHolder}'),
        ('ops_supervisor','Operations Supervisor',NULL,'${sup}');
      INSERT INTO public.user_roles VALUES ('${holder}','tech'),('${backupHolder}','tech'),('${sup}','manager'),('${cover}','tech'),('${oncall}','tech'),('${oncall2}','tech');`);
    await db.exec(LIVE);
    await db.exec("CREATE TRIGGER t BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.auto_assign_ticket()");
  });

  it("no overrides and every seat available: same assignee as today (regression)", async () => {
    await useFn(LIVE);
    await reset(false);
    const before = await route();
    await useFn(NEW);
    await reset(false);
    const after = await route();
    expect(before.assigned_to).toBe(holder);
    expect(after.assigned_to).toBe(before.assigned_to);
    expect(after.assignment_note).toBe(before.assignment_note);
  });

  it("off override sends the ticket to the backup seat", async () => {
    await useFn(NEW);
    await reset(false);
    await off("ge_day");
    expect((await route()).assigned_to).toBe(backupHolder);
  });

  it("today's live rule ignored the off override (the bug being fixed)", async () => {
    await useFn(LIVE);
    await reset(false);
    await off("ge_day");
    expect((await route()).assigned_to).toBe(holder);
  });

  it("cover override sends the ticket to the cover person", async () => {
    await useFn(NEW);
    await reset(false);
    await coverBy("ge_day", cover);
    const r = await route();
    expect(r.assigned_to).toBe(cover);
    expect(r.assignment_note).toContain("covering");
  });

  it("unavailable seat is skipped; unavailable backup falls to the Supervisor", async () => {
    await useFn(NEW);
    await reset(false);
    await db.exec("UPDATE public.functional_roles SET available=false WHERE code='ge_day'");
    expect((await route()).assigned_to).toBe(backupHolder);
    await db.exec("UPDATE public.functional_roles SET available=false WHERE code='po_day'");
    expect((await route()).assigned_to).toBe(sup);
  });

  it("overnight on-call is unchanged with one roster entry", async () => {
    for (const fn of [LIVE, NEW]) {
      await useFn(fn);
      await reset(true);
      await db.query(`INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ($1, (now() AT TIME ZONE 'America/Chicago')::date - 1, (now() AT TIME ZONE 'America/Chicago')::date + 1)`, [oncall]);
      await off("ge_day");
      expect((await route()).assigned_to).toBe(oncall);
    }
  });

  it("a single-night on-call entry wins over the weekly rotation", async () => {
    await useFn(NEW);
    await reset(true);
    await db.query(`INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ($1, (now() AT TIME ZONE 'America/Chicago')::date - 1, (now() AT TIME ZONE 'America/Chicago')::date)`, [oncall2]);
    await db.query(`INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ($1, (now() AT TIME ZONE 'America/Chicago')::date - 3, (now() AT TIME ZONE 'America/Chicago')::date + 3)`, [oncall]);
    expect((await route()).assigned_to).toBe(oncall2);
  });

  it("undo restores the exact live definition and privileges stay service-only", async () => {
    await useFn(NEW);
    await useFn(UNDO);
    const def = (await db.query<{ d: string }>("SELECT pg_get_functiondef('public.auto_assign_ticket'::regproc) d")).rows[0]!.d;
    await useFn(LIVE);
    const live = (await db.query<{ d: string }>("SELECT pg_get_functiondef('public.auto_assign_ticket'::regproc) d")).rows[0]!.d;
    expect(def).toBe(live);
    await useFn(NEW);
    const acl = (await db.query<{ a: boolean; p: boolean }>(
      "SELECT has_function_privilege('anon','public.auto_assign_ticket()','EXECUTE') a, has_function_privilege('authenticated','public.auto_assign_ticket()','EXECUTE') p")).rows[0]!;
    expect(acl.a).toBe(false);
    expect(acl.p).toBe(false);
  });
});
