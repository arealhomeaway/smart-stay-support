import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/direct-bookings-overnight/ (Emily, Nov 8, 2026;
 * register D2). Built the way it is live: routing-by-time parts 1 and 3, then the routing
 * tweaks, then this folder. Helpers are the live captures; only tables are stubbed. People
 * mirror the live schedule today: Guest Experience Day and Part time unheld, Guest Experience
 * Evening, Property Operations Day and Evening held. Nothing touches the real database.
 */
const BASE = "docs/pending/routing-by-time";
const TWEAKS = "docs/pending/routing-tweaks";
const DIR = "docs/pending/direct-bookings-overnight";
const read = (p: string) => readFileSync(p, "utf8");
const liveRouting = (n: string) => read(`${BASE}/live-capture/public.${n}.sql`).trimEnd() + ";\n";
const liveHere = (n: string) => read(`${DIR}/live-capture/public.${n}.sql`);
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const GE_EVE = U(2), PO_DAY = U(4), PO_EVE = U(5), SUP = U(6), DIR_OPS = U(7), ONCALL = U(8);
const STAGED = read(`${DIR}/01_overnight_queue.sql`);
const UNDO = read(`${DIR}/01_undo_overnight_queue.sql`);

const SHIFTS: [string, number[], number, number][] = [
  ["ge_day", [0, 1, 4, 5, 6], 480, 1020],
  ["ge_evening", [0, 1, 2, 3, 6], 780, 1320],
  ["ge_parttime", [2, 3], 480, 780],
  ["ge_parttime", [4, 5], 1020, 1320],
  ["ops_supervisor", [1, 2, 3, 4, 5], 480, 1020],
  ["po_day", [1, 2, 3, 4, 5], 480, 1020],
  ["po_evening", [1, 2, 3, 4, 5], 780, 1320],
];
const ROLES: [string, string, string, string | null, string | null][] = [
  ["ge_day", "Guest Experience Day", "guest_experience", "ge_evening", null],
  ["ge_evening", "Guest Experience Evening", "guest_experience", "ge_day", GE_EVE],
  ["ge_parttime", "Guest Experience Part time", "guest_experience", "ge_day", null],
  ["po_day", "Property Operations Day", "property_operations", "po_evening", PO_DAY],
  ["po_evening", "Property Operations Evening", "property_operations", "po_day", PO_EVE],
  ["ops_supervisor", "Operations Supervisor", "leadership", null, SUP],
  ["director_ops", "Director of Operations", "leadership", null, DIR_OPS],
];

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA cron;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE TABLE cron.jobs(name text PRIMARY KEY, schedule text, command text);
CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS
  $$ INSERT INTO cron.jobs VALUES (n, s, c) ON CONFLICT (name) DO UPDATE SET schedule = excluded.schedule, command = excluded.command RETURNING 1::bigint $$;
CREATE TABLE public.escalations_run(at timestamptz DEFAULT clock_timestamp());
CREATE FUNCTION public.escalate_direct_booking_approvals() RETURNS integer LANGUAGE sql AS $$ INSERT INTO public.escalations_run DEFAULT VALUES RETURNING 0 $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE TABLE public.coverage_config(id boolean PRIMARY KEY DEFAULT true, timezone text, after_hours_start_minute int, after_hours_end_minute int);
CREATE TABLE public.work_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, team text, functional_role_code text, pending_approval boolean DEFAULT false, active boolean DEFAULT true, sort_order int);
CREATE TABLE public.functional_roles(code text PRIMARY KEY, name text, team text, backup_role_code text, current_seat_holder uuid, active boolean DEFAULT true, available boolean DEFAULT true, lunch_coverage text);
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
CREATE TABLE public.coverage_shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_code text NOT NULL, weekday smallint NOT NULL, start_minute int NOT NULL, end_minute int NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.coverage_overrides(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_code text, kind text, user_id uuid, starts_at timestamptz, ends_at timestamptz, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.oncall_roster(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, starts_on date, ends_on date, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb);
CREATE TABLE public.tickets(id serial PRIMARY KEY, status text DEFAULT 'open', priority text DEFAULT 'p3', work_type_id uuid, functional_role_code text,
  current_action_owner uuid, assigned_to uuid, assignment_source text, assignment_note text, archived_at timestamptz, is_demo boolean DEFAULT false,
  external_source text, external_status text, created_at timestamptz DEFAULT now());
CREATE TABLE public.leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text, partner_name text, company text, subject text,
  owned_by uuid, assigned_to uuid, started_at timestamptz, outcome text, reply_sent_at timestamptz, is_demo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text,
  entity_type text, entity_id uuid, link_path text, priority text, is_demo boolean, created_at timestamptz DEFAULT now());
INSERT INTO public.coverage_config VALUES (true, 'America/Chicago', 1320, 480);
`;

async function fresh(staged = true) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  for (const n of ["seat_override_at", "seat_on_duty", "seat_eligible_now", "seat_holder_at", "staff_assignable", "oncall_user_for_night", "functional_role_holders"])
    await db.exec(liveRouting(n));
  await db.exec(liveRouting("auto_assign_ticket"));
  await db.exec(liveRouting("direct_booking_on_shift"));
  for (const [code, name, team, backup, holder] of ROLES)
    await db.query("INSERT INTO public.functional_roles(code, name, team, backup_role_code, current_seat_holder) VALUES ($1,$2,$3,$4,$5)", [code, name, team, backup, holder]);
  for (const u of [GE_EVE, PO_DAY, PO_EVE, ONCALL]) await db.query("INSERT INTO public.user_roles VALUES ($1,'tech')", [u]);
  for (const u of [SUP, DIR_OPS]) await db.query("INSERT INTO public.user_roles VALUES ($1,'manager')", [u]);
  for (const [code, days, s, e] of SHIFTS)
    for (const d of days)
      await db.query("INSERT INTO public.coverage_shifts(role_code, weekday, start_minute, end_minute) VALUES ($1,$2,$3,$4)", [code, d, s, e]);
  await db.query("INSERT INTO public.app_settings VALUES ('oncall_weekday_pattern', $1)", [JSON.stringify(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), ONCALL])))]);
  await db.exec(read(`${BASE}/01_lunch_times.sql`));
  await db.exec(read(`${BASE}/03_coordinator_routing.sql`));
  for (const f of ["01_quiet_imports_load.sql", "02_direct_booking_on_call.sql", "03_home_eligible_now.sql"]) await db.exec(read(`${TWEAKS}/${f}`));
  // Live Direct Booking alert pieces, exactly as captured today.
  await db.exec(liveHere("direct_booking_notify"));
  await db.exec(liveHere("direct_booking_alert_new"));
  await db.exec("CREATE TRIGGER direct_booking_alert_new_trg AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.direct_booking_alert_new()");
  await db.exec("SELECT cron.schedule('direct-booking-approval-escalation', '20 seconds', $$SELECT public.escalate_direct_booking_approvals()$$)");
  if (staged) await db.exec(STAGED);
  return db;
}

const at = (day: string, hm: string) => `2026-11-${day} ${hm} America/Chicago`;
// Nov 2026 (Central): Sun 8, Mon 9, Wed 11, Sun 15.
const iso = async (db: PGlite, when: string) => (await db.query<{ t: string }>("SELECT $1::timestamptz::text t", [when])).rows[0]!.t;
const alerts = async (db: PGlite, when: string) =>
  (await db.query<{ u: string }>("SELECT u FROM public.direct_booking_on_shift($1::timestamptz) u ORDER BY 1", [when])).rows.map((r) => r.u);
const until = async (db: PGlite, when: string) =>
  (await db.query<{ t: string | null }>("SELECT public.direct_booking_overnight_until($1::timestamptz)::text t", [when])).rows[0]!.t;
const release = async (db: PGlite, when: string) =>
  (await db.query<{ n: number }>("SELECT public.release_overnight_direct_bookings($1::timestamptz) n", [when])).rows[0]!.n;
const notified = async (db: PGlite, lead: string) =>
  (await db.query<{ user_id: string }>("SELECT user_id FROM public.staff_notifications WHERE entity_id = $1 AND kind = 'direct_booking_new' ORDER BY 1", [lead])).rows.map((r) => r.user_id);

/** A request that arrived at `when` (the hold mark is the one the trigger computes for that moment). */
async function overnightRequest(db: PGlite, when: string) {
  const id = (await db.query<{ id: string }>("INSERT INTO public.leads(kind, partner_name, created_at) VALUES ('direct_booking', 'Practice partner', $1) RETURNING id", [when])).rows[0]!.id;
  await db.query("UPDATE public.leads SET overnight_until = public.direct_booking_overnight_until($2::timestamptz) WHERE id = $1", [id, when]);
  await db.exec("DELETE FROM public.staff_notifications"); // the insert itself ran at the test's real clock
  return id;
}

let db: PGlite;

describe("overnight: nobody is alerted and the request waits for the morning", () => {
  beforeAll(async () => { db = await fresh(); });
  beforeEach(async () => { await db.exec("TRUNCATE public.leads, public.staff_notifications, public.oncall_roster, public.coverage_overrides"); });

  it("the overnight window ends at 8:00 AM the next morning, Central", async () => {
    expect(await until(db, at("08", "23:00"))).toBe(await iso(db, at("09", "08:00")));
    expect(await until(db, at("09", "03:00"))).toBe(await iso(db, at("09", "08:00")));
    expect(await until(db, at("09", "22:00"))).toBe(await iso(db, at("10", "08:00")));
    expect(await until(db, at("09", "07:59"))).toBe(await iso(db, at("09", "08:00")));
    expect(await until(db, at("09", "08:00"))).toBeNull();
    expect(await until(db, at("09", "21:59"))).toBeNull();
  });

  it("a request at 11 PM alerts nobody: not on call, not the Supervisor, not the Director", async () => {
    expect(await alerts(db, at("08", "23:00"))).toEqual([]);
    expect(await alerts(db, at("09", "02:00"))).toEqual([]);
    const id = await overnightRequest(db, at("08", "23:00"));
    expect(await release(db, at("09", "02:00"))).toBe(0);
    expect(await release(db, at("09", "07:59"))).toBe(0);
    expect(await notified(db, id)).toEqual([]);
    const row = (await db.query<{ owned_by: string | null; overnight_until: string }>("SELECT owned_by, overnight_until::text FROM public.leads WHERE id = $1", [id])).rows[0]!;
    expect(row).toEqual({ owned_by: null, overnight_until: await iso(db, at("09", "08:00")) });
  });

  it("the real insert path: arriving inside the window marks it and the alert trigger alerts nobody", async () => {
    // Move the saved window so it covers this test's real clock; the trigger reads now().
    const m = (await db.query<{ m: number }>("SELECT (EXTRACT(hour FROM now() AT TIME ZONE 'America/Chicago')*60 + EXTRACT(minute FROM now() AT TIME ZONE 'America/Chicago'))::int m")).rows[0]!.m;
    await db.query("UPDATE public.coverage_config SET after_hours_start_minute = $1, after_hours_end_minute = $2", [(m + 1439) % 1440, (m + 2) % 1440]);
    try {
      const id = (await db.query<{ id: string }>("INSERT INTO public.leads(kind, partner_name) VALUES ('direct_booking', 'Practice partner') RETURNING id")).rows[0]!.id;
      expect(await notified(db, id)).toEqual([]);
      expect((await db.query<{ held: boolean }>("SELECT overnight_until > now() held FROM public.leads WHERE id = $1", [id])).rows[0]!.held).toBe(true);
    } finally {
      await db.exec("UPDATE public.coverage_config SET after_hours_start_minute = 1320, after_hours_end_minute = 480");
    }
  });

  it("at 8:00 AM Monday it alerts the Property Operations weekday coordinator, once", async () => {
    const id = await overnightRequest(db, at("08", "23:00"));
    expect(await release(db, at("09", "08:00"))).toBe(1);
    expect(await notified(db, id)).toEqual([PO_DAY]);
    expect(await release(db, at("09", "08:00:20"))).toBe(0);
    expect(await notified(db, id)).toEqual([PO_DAY]);
    const text = (await db.query<{ title: string; body: string; priority: string }>("SELECT title, body, priority FROM public.staff_notifications WHERE entity_id = $1", [id])).rows[0]!;
    expect(text).toEqual({ title: "New direct booking request", body: "Practice partner wrote overnight and is waiting. Press Start to own it and reply within 3 minutes.", priority: "high" });
  });

  it("someone who pressed Start overnight is never re-alerted in the morning", async () => {
    const id = await overnightRequest(db, at("08", "23:00"));
    await db.query("UPDATE public.leads SET owned_by = $2, started_at = $3 WHERE id = $1", [id, SUP, at("09", "02:00")]);
    expect(await release(db, at("09", "08:00"))).toBe(0);
    expect(await notified(db, id)).toEqual([]);
  });

  it("Sunday morning with nobody working: the Supervisor and the Director at 8:00", async () => {
    const id = await overnightRequest(db, at("14", "23:30")); // Saturday night
    expect(await release(db, at("15", "08:00"))).toBe(1);
    expect(await notified(db, id)).toEqual([SUP, DIR_OPS].sort());
  });

  it("the 20 second job keeps its name and cadence and runs the Director check first", async () => {
    const job = (await db.query<{ schedule: string; command: string }>("SELECT schedule, command FROM cron.jobs WHERE name = 'direct-booking-approval-escalation'")).rows[0]!;
    expect(job.schedule).toBe("20 seconds");
    expect(job.command).toBe("SELECT public.escalate_direct_booking_approvals(); SELECT public.release_overnight_direct_bookings();");
    await db.exec("TRUNCATE public.escalations_run");
    await db.exec(job.command);
    expect((await db.query("SELECT 1 FROM public.escalations_run")).rows.length).toBe(1);
  });

  it("a failure in the morning check never stops the Director check", async () => {
    await db.exec("ALTER TABLE public.staff_notifications RENAME TO staff_notifications_x");
    try {
      await overnightRequest(db, at("08", "23:00")).catch(() => null);
      await db.exec("TRUNCATE public.escalations_run");
      await db.exec("SELECT public.escalate_direct_booking_approvals(); SELECT public.release_overnight_direct_bookings();");
      expect((await db.query("SELECT 1 FROM public.escalations_run")).rows.length).toBe(1);
    } finally {
      await db.exec("ALTER TABLE public.staff_notifications_x RENAME TO staff_notifications");
    }
  });
});

describe("daytime: exactly as before", () => {
  it("every daytime minute alerts the same people as today's live rule", async () => {
    const before = await fresh(false);
    const after = await fresh();
    for (const day of ["08", "09", "10", "11", "12", "13", "14"])
      for (let m = 480; m < 1320; m += 15) {
        const when = at(day, `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
        expect(await alerts(after, when)).toEqual(await alerts(before, when));
      }
  });

  it("Wednesday 2 PM: the Guest Experience evening coordinator; Sunday 9 AM: the Supervisor and the Director", async () => {
    const d = await fresh();
    expect(await alerts(d, at("11", "14:00"))).toEqual([GE_EVE]);
    expect(await until(d, at("11", "14:00"))).toBeNull();
    expect(await alerts(d, at("15", "09:00"))).toEqual([SUP, DIR_OPS].sort());
  });

  it("a daytime request is not held and alerts at once through the unchanged trigger", async () => {
    const d = await fresh();
    await d.exec("UPDATE public.coverage_config SET after_hours_start_minute = NULL, after_hours_end_minute = NULL"); // no window: always daytime
    const id = (await d.query<{ id: string }>("INSERT INTO public.leads(kind, partner_name) VALUES ('direct_booking', 'Day partner') RETURNING id")).rows[0]!.id;
    expect((await d.query<{ h: string | null }>("SELECT overnight_until h FROM public.leads WHERE id = $1", [id])).rows[0]!.h).toBeNull();
    expect((await notified(d, id)).length).toBeGreaterThan(0);
  });

  it("ticket routing is untouched: the staged file never redefines a ticket function", () => {
    for (const fn of ["auto_assign_ticket", "coordinator_for", "coordinators_on_shift", "ticket_route_at", "oncall_user_for_night", "direct_booking_alert_new", "direct_booking_notify", "direct_booking_eligible_now", "escalate_direct_booking_approvals", "start_direct_booking"])
      expect(STAGED).not.toContain(`FUNCTION public.${fn}(`);
  });
});

describe("undo", () => {
  it("puts back today's live rule, the original job and removes the hold", async () => {
    const d = await fresh();
    await d.exec(UNDO);
    const ref = await fresh(false);
    const def = async (x: PGlite) => (await x.query<{ d: string }>("SELECT pg_get_functiondef('public.direct_booking_on_shift(timestamptz)'::regprocedure) d")).rows[0]!.d;
    expect(await def(d)).toBe(await def(ref));
    expect((await d.query<{ command: string }>("SELECT command FROM cron.jobs")).rows[0]!.command).toBe("SELECT public.escalate_direct_booking_approvals()");
    expect((await d.query("SELECT 1 FROM pg_proc WHERE proname IN ('release_overnight_direct_bookings','direct_booking_hold_overnight','direct_booking_overnight_until')")).rows).toEqual([]);
    expect(await alerts(d, at("08", "23:00"))).toEqual(await alerts(ref, at("08", "23:00")));
  });

  it("the live capture matches today's applied rule word for word", () => {
    const body = (s: string) => s.slice(s.indexOf("CREATE OR REPLACE FUNCTION public.direct_booking_on_shift"), s.indexOf("$function$;", s.indexOf("CREATE OR REPLACE FUNCTION public.direct_booking_on_shift")) + 11);
    expect(body(liveHere("direct_booking_on_shift"))).toBe(body(read(`${TWEAKS}/02_direct_booking_on_call.sql`)));
  });
});
