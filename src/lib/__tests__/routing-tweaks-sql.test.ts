import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of the staged routing tweaks (docs/pending/routing-tweaks/),
 * applied on top of routing-by-time parts 1 and 3 the way they will be applied live.
 * Today's helper functions are loaded verbatim from routing-by-time/live-capture/;
 * only tables are stubbed. The schedule is the live saved schedule. Nothing touches
 * the real database.
 */
const BASE = "docs/pending/routing-by-time";
const DIR = "docs/pending/routing-tweaks";
const read = (p: string) => readFileSync(p, "utf8");
const live = (n: string) => read(`${BASE}/live-capture/public.${n}.sql`).trimEnd() + ";\n";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A1 = U(1), A2 = U(2), A3 = U(3), B1 = U(4), B2 = U(5), SUP = U(6), DIR_OPS = U(7), ONCALL = U(8), COVER = U(9);

const LIVE_HELPERS = ["seat_override_at", "seat_on_duty", "seat_eligible_now", "seat_holder_at", "staff_assignable", "oncall_user_for_night", "functional_role_holders"];
const LUNCH = read(`${BASE}/01_lunch_times.sql`);
const ROUTING = read(`${BASE}/03_coordinator_routing.sql`);
const T1 = read(`${DIR}/01_quiet_imports_load.sql`);
const T1_UNDO = read(`${DIR}/01_undo_quiet_imports_load.sql`);
const T2 = read(`${DIR}/02_direct_booking_on_call.sql`);
const T2_UNDO = read(`${DIR}/02_undo_direct_booking_on_call.sql`);
const T3 = read(`${DIR}/03_home_eligible_now.sql`);
const T3_UNDO = read(`${DIR}/03_undo_home_eligible_now.sql`);

const SHIFTS: [string, number[], number, number][] = [
  ["ge_day", [0, 1, 4, 5, 6], 480, 1020],
  ["ge_evening", [0, 1, 2, 3, 6], 780, 1320],
  ["ge_parttime", [2, 3], 480, 780],
  ["ge_parttime", [4, 5], 1020, 1320],
  ["ops_supervisor", [1, 2, 3, 4, 5], 480, 1020],
  ["po_day", [1, 2, 3, 4, 5], 480, 1020],
  ["po_evening", [1, 2, 3, 4, 5], 780, 1320],
];

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
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
INSERT INTO public.coverage_config VALUES (true, 'America/Chicago', 1320, 480);
`;

const ROLES: [string, string, string, string | null, string | null][] = [
  ["ge_day", "Guest Experience Day", "guest_experience", "ge_evening", A1],
  ["ge_evening", "Guest Experience Evening", "guest_experience", "ge_day", A2],
  ["ge_parttime", "Guest Experience Part time", "guest_experience", "ge_day", A3],
  ["po_day", "Property Operations Day", "property_operations", "po_evening", B1],
  ["po_evening", "Property Operations Evening", "property_operations", "po_day", B2],
  ["ops_supervisor", "Operations Supervisor", "leadership", null, SUP],
  ["director_ops", "Director of Operations", "leadership", null, DIR_OPS],
];

async function fresh(tweaks = true) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  for (const n of LIVE_HELPERS) await db.exec(live(n));
  await db.exec(live("auto_assign_ticket"));
  await db.exec(live("direct_booking_on_shift"));
  for (const [code, name, team, backup, holder] of ROLES)
    await db.query("INSERT INTO public.functional_roles(code, name, team, backup_role_code, current_seat_holder) VALUES ($1,$2,$3,$4,$5)", [code, name, team, backup, holder]);
  for (const u of [A1, A2, A3, B1, B2, ONCALL, COVER]) await db.query("INSERT INTO public.user_roles VALUES ($1,'tech')", [u]);
  for (const u of [SUP, DIR_OPS]) await db.query("INSERT INTO public.user_roles VALUES ($1,'manager')", [u]);
  for (const [code, days, s, e] of SHIFTS)
    for (const d of days)
      await db.query("INSERT INTO public.coverage_shifts(role_code, weekday, start_minute, end_minute) VALUES ($1,$2,$3,$4)", [code, d, s, e]);
  const pattern: Record<string, string> = {};
  for (let d = 0; d < 7; d++) pattern[String(d)] = ONCALL;
  await db.query("INSERT INTO public.app_settings VALUES ('oncall_weekday_pattern', $1)", [JSON.stringify(pattern)]);
  await db.exec(LUNCH);
  await db.exec(ROUTING);
  if (tweaks) {
    await db.exec(T1);
    await db.exec(T2);
    await db.exec(T3);
  }
  return db;
}

const at = (day: string, hm: string) => `2026-11-${day} ${hm} America/Chicago`;
// Nov 2026 (Central): Mon 9, Tue 10, Sat 14.
const MON = "09", TUE = "10";

const alerts = async (db: PGlite, when: string) =>
  (await db.query<{ u: string }>("SELECT u FROM public.direct_booking_on_shift($1::timestamptz) u ORDER BY 1", [when])).rows.map((r) => r.u);
const loads = async (db: PGlite, when: string) =>
  Object.fromEntries((await db.query<{ user_id: string; load: number }>("SELECT user_id, load FROM public.coordinators_on_shift($1::timestamptz)", [when])).rows.map((r) => [r.user_id, r.load]));
const pick = async (db: PGlite, team: string, when: string) =>
  (await db.query<{ user_id: string }>("SELECT user_id FROM public.coordinator_for($1, $2::timestamptz)", [team, when])).rows[0]!.user_id;
const give = (db: PGlite, user: string, priority: string, source: string | null = null, status: string | null = null) =>
  db.query("INSERT INTO public.tickets(priority, current_action_owner, assigned_to, external_source, external_status) VALUES ($1,$2,$2,$3,$4)", [priority, user, source, status]);

let db: PGlite;
async function reset() {
  await db.exec("TRUNCATE public.tickets, public.oncall_roster, public.coverage_overrides");
  await db.query("UPDATE public.app_settings SET value = $1 WHERE key = 'oncall_weekday_pattern'", [JSON.stringify(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), ONCALL])))]);
}

describe("part 1: quiet Notion imports never count towards load", () => {
  beforeAll(async () => { db = await fresh(); });
  beforeEach(reset);

  it("an open import assigned to someone adds nothing until it is taken or reopened", async () => {
    await give(db, A1, "p1", "notion", "In progress");
    await give(db, A1, "p2", "notion", null);
    expect((await loads(db, at(MON, "14:30")))[A1]).toBe(0);
    await give(db, A1, "p1", "notion", "reopened_in_resolve"); // taken or reopened: ordinary work
    expect((await loads(db, at(MON, "14:30")))[A1]).toBe(5);
  });

  it("ordinary work still counts exactly as before (Right now 5, Today 3, Routine 1)", async () => {
    await give(db, A2, "p1");
    await give(db, A2, "p2");
    await give(db, A2, "p3");
    expect((await loads(db, at(MON, "14:30")))[A2]).toBe(9);
  });

  it("routing stays fair: imports never push work away from the person who holds them", async () => {
    for (let i = 0; i < 4; i++) await give(db, A1, "p1", "notion", "In progress");
    await give(db, A2, "p3");
    expect(await pick(db, "guest_experience", at(MON, "14:30"))).toBe(A1);
    // Before the tweak the same imports counted 20 and the work went to A2.
    const before = await fresh(false);
    for (let i = 0; i < 4; i++) await give(before, A1, "p1", "notion", "In progress");
    await give(before, A2, "p3");
    expect(await pick(before, "guest_experience", at(MON, "14:30"))).toBe(A2);
  });
});

describe("part 2: overnight a Direct Booking also alerts the person on call", () => {
  beforeAll(async () => { db = await fresh(); });
  beforeEach(reset);

  it("overnight, with no coordinator working: the person on call, the Operations Supervisor and the Director of Operations", async () => {
    expect(await alerts(db, at(MON, "23:00"))).toEqual([SUP, DIR_OPS, ONCALL].sort());
    expect(await alerts(db, at(TUE, "03:00"))).toEqual([SUP, DIR_OPS, ONCALL].sort());
  });

  it("a dated on call entry wins over the weekday pattern, for the night it started", async () => {
    await db.query("INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ($1, '2026-11-09', '2026-11-09')", [COVER]);
    expect(await alerts(db, at(TUE, "03:00"))).toEqual([SUP, DIR_OPS, COVER].sort());
  });

  it("no one on call tonight: the Operations Supervisor and the Director of Operations, as before", async () => {
    await db.exec("UPDATE public.app_settings SET value = '{}' WHERE key = 'oncall_weekday_pattern'");
    expect(await alerts(db, at(MON, "23:00"))).toEqual([SUP, DIR_OPS].sort());
  });

  it("daytime is unchanged: coordinators on shift, and nobody working in the day never adds the on call person", async () => {
    expect(await alerts(db, at(MON, "14:30"))).toEqual([A1, A2].sort());
    for (const role of ["ge_day", "ge_evening", "ge_parttime", "po_day", "po_evening"])
      await db.query("INSERT INTO public.coverage_overrides(role_code, kind, starts_at, ends_at) VALUES ($1,'off',$2::timestamptz - interval '4 hours',$2::timestamptz + interval '4 hours')", [role, at(MON, "10:00")]);
    expect(await alerts(db, at(MON, "10:00"))).toEqual([SUP, DIR_OPS].sort());
  });

  it("ticket routing overnight is unchanged (the on call person)", async () => {
    expect(await pick(db, "guest_experience", at(MON, "23:00"))).toBe(ONCALL);
  });

  it("only the server can run the alert list", async () => {
    for (const role of ["anon", "authenticated"])
      expect((await db.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', 'public.direct_booking_on_shift(timestamptz)', 'EXECUTE') ok`)).rows[0]!.ok).toBe(false);
  });
});

describe("part 3: Home shows an unstarted request to everyone eligible right now", () => {
  beforeAll(async () => {
    db = await fresh();
    // A schedule where ge_day works all day, every day, so "right now" is always on shift.
    await db.exec("DELETE FROM public.coverage_shifts; INSERT INTO public.coverage_shifts(role_code, weekday, start_minute, end_minute) SELECT 'ge_day', d, 0, 1440 FROM generate_series(0, 6) d;");
  });
  const asUser = async (uid: string | null) =>
    (await db.query<{ ok: boolean }>(`SELECT set_config('test.uid', $1, false), public.direct_booking_eligible_now() ok`, [uid ?? ""])).rows[0]!.ok;

  it("says yes only for a person a new request would alert right now", async () => {
    expect(await asUser(A1)).toBe(true);
    expect(await asUser(A2)).toBe(false);
    expect(await asUser(B1)).toBe(false);
    expect(await asUser(null)).toBe(false);
  });

  it("is read only and only signed in people can ask", async () => {
    const fn = (await db.query<{ v: string }>("SELECT provolatile v FROM pg_proc WHERE proname = 'direct_booking_eligible_now'")).rows[0]!.v;
    expect(fn).toBe("s");
    const can = async (r: string) => (await db.query<{ ok: boolean }>(`SELECT has_function_privilege('${r}', 'public.direct_booking_eligible_now()', 'EXECUTE') ok`)).rows[0]!.ok;
    expect(await can("anon")).toBe(false);
    expect(await can("authenticated")).toBe(true);
  });
});

describe("undo", () => {
  it("each undo puts back routing-by-time part 3 exactly and removes the new question", async () => {
    const d = await fresh();
    await d.exec(T3_UNDO);
    await d.exec(T2_UNDO);
    await d.exec(T1_UNDO);
    const ref = await fresh(false);
    const def = async (x: PGlite, sig: string) => (await x.query<{ d: string }>(`SELECT pg_get_functiondef('public.${sig}'::regprocedure) d`)).rows[0]!.d;
    expect(await def(d, "coordinators_on_shift(timestamptz)")).toBe(await def(ref, "coordinators_on_shift(timestamptz)"));
    expect(await def(d, "direct_booking_on_shift(timestamptz)")).toBe(await def(ref, "direct_booking_on_shift(timestamptz)"));
    expect((await d.query("SELECT 1 FROM pg_proc WHERE proname = 'direct_booking_eligible_now'")).rows).toEqual([]);
  });

  it("the undo files hold routing-by-time part 3's definitions word for word", () => {
    const body = (s: string, start: string, end: string) => s.slice(s.indexOf(start), s.indexOf(end, s.indexOf(start)) + end.length);
    const cos = ["CREATE OR REPLACE FUNCTION public.coordinators_on_shift", "TO service_role;"] as const;
    const dbs = ["CREATE OR REPLACE FUNCTION public.direct_booking_on_shift", "TO service_role;"] as const;
    expect(body(T1_UNDO, ...cos)).toBe(body(ROUTING, ...cos));
    expect(body(T2_UNDO, ...dbs)).toBe(body(ROUTING, ...dbs));
  });
});
