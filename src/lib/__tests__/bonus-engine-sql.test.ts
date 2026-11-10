// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/bonus-engine/01_bonus_engine.sql (Build 13; Emily,
 * Nov 10; register BN5, BN6, BN11; values from docs/specs/bonus-guide-values.md). Tables are
 * stubbed with the live column names. Fake people and records only.
 */
const DIR = "docs/pending/bonus-engine";
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const COO = "00000000-0000-4000-8000-0000000000a2";
const CEO = "00000000-0000-4000-8000-0000000000a3";
const DIROPS = "00000000-0000-4000-8000-0000000000b1";
const SUP = "00000000-0000-4000-8000-0000000000b2";
const FIN = "00000000-0000-4000-8000-0000000000b3";
const PC1 = "00000000-0000-4000-8000-0000000000c1";
const PC2 = "00000000-0000-4000-8000-0000000000c2";
const OTHER = "00000000-0000-4000-8000-0000000000c3";
const ONB = "00000000-0000-4000-8000-0000000000d1";

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA cron;
CREATE TABLE cron.jobs(name text PRIMARY KEY, schedule text, command text);
CREATE FUNCTION cron.schedule(_n text, _s text, _c text) RETURNS bigint LANGUAGE sql AS
  $$ INSERT INTO cron.jobs VALUES (_n, _s, _c) ON CONFLICT (name) DO UPDATE SET schedule = EXCLUDED.schedule RETURNING 1::bigint $$;
CREATE FUNCTION cron.unschedule(_n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.jobs WHERE name = _n RETURNING true $$;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${COO}','admin'), ('${COO}','tech'), ('${CEO}','admin'),
  ('${DIROPS}','manager'), ('${SUP}','manager'), ('${FIN}','manager'), ('${PC1}','tech'), ('${PC2}','tech'),
  ('${OTHER}','tech'), ('${ONB}','onboarding');
CREATE FUNCTION private.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
CREATE TABLE public.functional_roles(code text PRIMARY KEY, name text, active boolean DEFAULT true, current_seat_holder uuid);
INSERT INTO public.functional_roles VALUES ('coo','COO',true,'${COO}'), ('ceo','CEO',true,'${CEO}'),
  ('director_ops','Director of Operations',true,'${DIROPS}'), ('ops_supervisor','Operations Supervisor',true,'${SUP}'),
  ('finance_lead','Finance Lead',true,'${FIN}'), ('po_day','PC day',true,'${PC1}'), ('po_evening','PC evening',true,'${PC2}'),
  ('ge_day','GE day',true,NULL);
CREATE FUNCTION public.seat_holder_at(_c text, _at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT current_seat_holder FROM public.functional_roles WHERE code = _c $$;
CREATE FUNCTION private.sc_holds(_u uuid, _c text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT _u IS NOT NULL AND public.seat_holder_at(_c) IS NOT DISTINCT FROM _u $$;
CREATE FUNCTION public.is_finance_lead(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.sc_holds(_u, 'finance_lead') $$;
CREATE FUNCTION public.add_business_days(_d date, _n integer) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d date := _d; left_n int := abs(_n); step int := CASE WHEN _n < 0 THEN -1 ELSE 1 END;
BEGIN
  WHILE left_n > 0 LOOP d := d + step; IF extract(isodow FROM d) < 6 THEN left_n := left_n - 1; END IF; END LOOP;
  RETURN d;
END $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text);
INSERT INTO public.profiles VALUES ('${SUP}','Supervisor person'), ('${DIROPS}','Director person'), ('${PC1}','Coordinator one'),
  ('${PC2}','Coordinator two'), ('${COO}','COO person');
CREATE TABLE public.coverage_shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_code text, weekday smallint,
  start_minute int, end_minute int, active boolean DEFAULT true);
INSERT INTO public.coverage_shifts(role_code, weekday, start_minute, end_minute)
  SELECT 'ops_supervisor', d, 480, 1020 FROM generate_series(1,5) d;
INSERT INTO public.coverage_shifts(role_code, weekday, start_minute, end_minute)
  SELECT 'po_day', d, 480, 1020 FROM generate_series(1,5) d;
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz, external_source text, external_id text, department_code text DEFAULT 'operations',
  response_due_at timestamptz, acknowledged_at timestamptz, action_due_at timestamptz, action_started_at timestamptz, assigned_to uuid);
CREATE TABLE public.routine_controls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text, status text DEFAULT 'due',
  due_at timestamptz, assigned_to uuid, completed_at timestamptz, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.shift_end_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, ended_at timestamptz,
  nothing_to_hand_off boolean DEFAULT false, ticket_ids uuid[], handoff_ids uuid[], is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.scorecard_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), about_user_id uuid, details jsonb NOT NULL DEFAULT '{}',
  refers_to uuid, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.arrival_checks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_label text, check_in_at timestamptz,
  result text, is_test boolean NOT NULL DEFAULT false, late_booking boolean NOT NULL DEFAULT false, cleared_at timestamptz);
CREATE TABLE public.guest_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ownerrez_booking_id text, rating int,
  source text, stay_end date, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text,
  body text, link_path text, email boolean, created_at timestamptz DEFAULT clock_timestamp());
CREATE FUNCTION public.notify_staff(_u uuid, _k text, _t text, _b text, _et text, _eid uuid, _l text, _p text, _a uuid, _e boolean, _d boolean)
  RETURNS uuid LANGUAGE sql AS $$ INSERT INTO public.staff_notifications(user_id, kind, title, body, link_path, email)
    VALUES (_u,_k,_t,_b,_l,_e) RETURNING id $$;
`;

let db: PGlite;
const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];
const all = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
const as = async (uid: string | null) => {
  await db.exec("DELETE FROM public.me");
  if (uid) await db.exec(`INSERT INTO public.me VALUES ('${uid}')`);
};
const err = async (sql: string, params: unknown[] = []) => {
  try {
    await db.query(sql, params);
  } catch (e) {
    return String((e as Error).message);
  }
  return "";
};
const compute = async (plan: string, user: string, start: string, now: string) =>
  (await one(`SELECT private.bonus_compute($1, $2, $3::date, $4::timestamptz) AS c`, [plan, user, start, now])).c;
const goal = (card, code: string) => card.goals.find((g) => g.code === code);
const goalId = async (plan: string, code: string) =>
  (await one(`SELECT id FROM public.bonus_goals WHERE plan_code=$1 AND code=$2`, [plan, code])).id;
// Test settings: a closed September 2026 period for the Supervisor and the Director, so the
// verify chain can run today. The real plans start counting on Nov 16.
const pastPeriods = async () => {
  await db.exec(`
    UPDATE public.bonus_plans SET counting_start = '2026-09-01' WHERE code IN ('ops_supervisor', 'director_ops', 'coordinator');
    UPDATE public.bonus_participants SET eligible_from = '2026-09-01';
    INSERT INTO public.bonus_period_amounts (plan_code, period_start, period_end, label, amount_goal_met, amount_strong, amount_exceeds)
    VALUES ('ops_supervisor', '2026-09-01', '2026-09-30', 'Test September', 100, 137.50, 175),
           ('director_ops', '2026-09-01', '2026-09-30', 'Test September', 750, 937.50, 1125),
           ('coordinator', '2026-09-01', '2026-09-30', 'Test September', 50, 75, 100);`);
};
// Director goals counted by the reviewer and priorities, so at least 3 goals count.
const directorThreeGoals = async (start: string, vendorValue: number) => {
  await as(COO);
  await db.query(`SELECT public.bonus_enter_measure('director_ops', $1, $2::date, $3, 100, 'From the fix plan list', NULL)`,
    [DIROPS, start, await goalId("director_ops", "guest_issues_fixed")]);
  await db.query(`SELECT public.bonus_enter_measure('director_ops', $1, $2::date, $3, $4, 'Coverage count', 'https://example.com/sheet')`,
    [DIROPS, start, await goalId("director_ops", "vendor_coverage"), vendorValue]);
  await db.query(`SELECT public.bonus_save_priority(NULL, $1, $2::date, 'Vendor bench', 100, 'result_agreed', $3::date, 'Agreed result')`,
    [DIROPS, start, start]);
};

describe("bonus engine (01)", () => {
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(readFileSync(`${DIR}/01_bonus_engine.sql`, "utf8"));
    await as(null);
  });

  it("seeds every number from the bonus guides", async () => {
    const plans = await all(`SELECT code, period_kind, counting_start::text, amount_goal_met::text m, amount_strong::text s, amount_exceeds::text e
                               FROM public.bonus_plans ORDER BY position`);
    expect(plans).toEqual([
      { code: "ops_supervisor", period_kind: "monthly", counting_start: "2026-11-16", m: "100.00", s: "137.50", e: "175.00" },
      { code: "director_ops", period_kind: "quarterly", counting_start: "2026-11-16", m: "750.00", s: "937.50", e: "1125.00" },
      { code: "coordinator", period_kind: "monthly", counting_start: "2027-01-01", m: "50.00", s: "75.00", e: "100.00" },
    ]);
    const first = await all(`SELECT plan_code, period_start::text, period_end::text, amount_goal_met::text m, amount_strong::text s,
                                    amount_exceeds::text e FROM public.bonus_period_amounts ORDER BY plan_code`);
    expect(first).toEqual([
      { plan_code: "director_ops", period_start: "2026-11-09", period_end: "2026-12-31", m: "434.43", s: "543.03", e: "651.64" },
      { plan_code: "ops_supervisor", period_start: "2026-11-09", period_end: "2026-11-30", m: "73.33", s: "100.83", e: "128.33" },
    ]);
    const shares = await all(`SELECT plan_code, sum(share)::int total, count(*)::int n FROM public.bonus_goals GROUP BY 1 ORDER BY 1`);
    expect(shares).toEqual([
      { plan_code: "coordinator", total: 100, n: 5 },
      { plan_code: "director_ops", total: 100, n: 6 },
      { plan_code: "ops_supervisor", total: 100, n: 5 },
    ]);
    const pc = await all(`SELECT code, share::int, threshold_met::float m, threshold_strong::float s, threshold_exceeds::float e
                            FROM public.bonus_goals WHERE plan_code='coordinator' ORDER BY position`);
    expect(pc).toEqual([
      { code: "follow_through", share: 30, m: 95, s: 96.5, e: 98 },
      { code: "clean_records", share: 25, m: 90, s: 92.5, e: 95 },
      { code: "shift_handoffs", share: 20, m: 95, s: 97.5, e: 100 },
      { code: "team_duties", share: 15, m: 95, s: 97.5, e: 100 },
      { code: "homes_ready", share: 10, m: 95, s: 96.5, e: 98 },
    ]);
    const finance = await one(`SELECT active, share::int FROM public.bonus_goals WHERE code='finance_packets'`);
    expect(finance).toEqual({ active: false, share: 10 });
    const rating = await all(`SELECT applies_from::text a, threshold_met::float m, threshold_exceeds::float e FROM public.bonus_goal_thresholds ORDER BY 1`);
    expect(rating).toEqual([
      { a: "2026-11-09", m: 4.81, e: 4.85 },
      { a: "2027-01-01", m: 4.85, e: 4.9 },
      { a: "2027-04-01", m: 4.91, e: 4.95 },
    ]);
    const people = await all(`SELECT user_id, plan_code, eligible_from::text e FROM public.bonus_participants ORDER BY plan_code, user_id`);
    expect(people).toEqual([
      { user_id: PC1, plan_code: "coordinator", e: "2027-01-01" },
      { user_id: PC2, plan_code: "coordinator", e: "2027-01-10" },
      { user_id: DIROPS, plan_code: "director_ops", e: "2026-11-16" },
      { user_id: SUP, plan_code: "ops_supervisor", e: "2026-11-16" },
    ]);
    expect((await one(`SELECT schedule FROM cron.jobs WHERE name='bonus-periods'`)).schedule).toBe("17 * * * *");
  });

  it("periods: the first Supervisor and Director periods, then months and quarters, and the Pays on line", async () => {
    const p = async (plan: string, day: string) =>
      await one(`SELECT period_start::text s, period_end::text e, label, amount_goal_met::text m FROM private.bonus_period($1, $2::date)`, [plan, day]);
    expect(await p("ops_supervisor", "2026-11-20")).toEqual({ s: "2026-11-09", e: "2026-11-30", label: "November 2026", m: "73.33" });
    expect(await p("ops_supervisor", "2026-12-03")).toEqual({ s: "2026-12-01", e: "2026-12-31", label: "December 2026", m: "100.00" });
    expect(await p("director_ops", "2026-12-20")).toEqual({ s: "2026-11-09", e: "2026-12-31", label: "Pilot, Nov 9 to Dec 31, 2026", m: "434.43" });
    expect(await p("director_ops", "2027-02-10")).toEqual({ s: "2027-01-01", e: "2027-03-31", label: "Q1 2027", m: "750.00" });
    expect(await p("coordinator", "2026-12-15")).toBeUndefined();
    expect((await one(`SELECT private.bonus_pays_on('2026-11-30') t`)).t).toBe("The last payday in December 2026");
    expect((await one(`SELECT private.bonus_pays_on('2026-12-31') t`)).t).toBe("The last payday in January 2027");
  });

  it("a goal at 94, 95, 96.5 and 98 percent lands at Below goal, Goal met, Strong and Exceeds with the right dollars", async () => {
    await pastPeriods();
    await as(COO);
    const vendor = await goalId("director_ops", "vendor_coverage");
    await db.query(`SELECT public.bonus_save_goal($1, 'director_ops', 'Vendor coverage', 15, 'percent', 95, 96.5, 98, 'reviewer', true, NULL, 'Test targets')`, [vendor]);
    const cases = [
      [94, "below", "0.00"],
      [95, "goal_met", "225.00"],
      [96.5, "strong", "281.25"],
      [98, "exceeds", "337.50"],
    ];
    await directorThreeGoals("2026-09-01", 94);
    for (const [value, level, dollars] of cases) {
      await as(COO);
      await db.query(`SELECT public.bonus_enter_measure('director_ops', $1, '2026-09-01', $2, $3, 'Coverage count', NULL)`, [DIROPS, vendor, value]);
      const c = await compute("director_ops", DIROPS, "2026-09-01", "2026-10-05T12:00:00Z");
      const g = goal(c, "vendor_coverage");
      expect(g.level).toBe(level);
      // Counted goals: issues 15, priorities 20, vendor 15 = 50; vendor moves to 30 percent of the bonus.
      expect(Number(g.effective_share)).toBe(30);
      expect(Number(g.dollars).toFixed(2)).toBe(dollars);
    }
    const c = await compute("director_ops", DIROPS, "2026-09-01", "2026-10-05T12:00:00Z");
    // Issues 100 (exceeds) 30% of 1125 = 337.50; priorities 100 points (exceeds) 40% = 450; vendor exceeds 337.50.
    expect(Number(c.total)).toBe(1125);
    expect(goal(c, "finance_packets").status).toBe("inactive");
    expect(goal(c, "guest_rating").status).toBe("not_enough");
  });

  it("a goal with no facts shows Not enough data yet, and fewer than 3 measurable goals pay the full Goal met amount", async () => {
    await pastPeriods();
    const c = await compute("ops_supervisor", SUP, "2026-09-01", "2026-10-05T12:00:00Z");
    expect(goal(c, "team_follow_through").status).toBe("no_data");
    expect(goal(c, "team_clean_records").status).toBe("not_tracked");
    expect(goal(c, "weekly_report").status).toBe("not_tracked");
    expect(c.fewer_than_three).toBe(true);
    expect(Number(c.total)).toBe(100);
  });

  it("counting starts on Nov 16: earlier facts, imports, demo and test records never count", async () => {
    await db.exec(`
      INSERT INTO public.tickets(title, response_due_at, acknowledged_at, assigned_to) VALUES
        ('Before the start', '2026-11-12T15:00:00Z', NULL, '${PC1}'),
        ('Counted on time', '2026-11-17T15:00:00Z', '2026-11-17T14:59:00Z', '${PC1}'),
        ('Counted late', '2026-11-18T15:00:00Z', '2026-11-18T15:10:00Z', '${PC2}');
      INSERT INTO public.tickets(title, response_due_at, external_source, assigned_to) VALUES ('Imported', '2026-11-17T15:00:00Z', 'notion', '${PC1}');
      INSERT INTO public.tickets(title, response_due_at, is_demo, assigned_to) VALUES ('Demo', '2026-11-17T15:00:00Z', true, '${PC1}');
      INSERT INTO public.tickets(title, response_due_at, archived_at) VALUES ('Archived', '2026-11-17T15:00:00Z', now());
      INSERT INTO public.arrival_checks(home_label, check_in_at, result, is_test) VALUES ('Test home', '2026-11-17T21:00:00Z', 'missed', true);
      INSERT INTO public.arrival_checks(home_label, check_in_at, result) VALUES ('Real home', '2026-11-17T21:00:00Z', 'on_time');`);
    const c = await compute("ops_supervisor", SUP, "2026-11-09", "2026-12-02T12:00:00Z");
    const g = goal(c, "team_follow_through");
    expect(g.denominator).toBe(2);
    expect(g.numerator).toBe(1);
    expect(Number(g.value)).toBe(50);
    expect(g.facts.map((f) => f.label).sort()).toEqual(["Counted late: first reply", "Counted on time: first reply"]);
    expect(c.counting_from).toBe("2026-11-16");
    // The coordinator team score counts the real home only.
    await db.exec(`UPDATE public.bonus_participants SET eligible_from = '2026-11-01' WHERE plan_code = 'coordinator';
                   UPDATE public.bonus_plans SET counting_start = '2026-11-01' WHERE code = 'coordinator';`);
    const pc = await compute("coordinator", PC1, "2026-11-01", "2026-12-02T12:00:00Z");
    expect(goal(pc, "homes_ready").denominator).toBe(1);
    expect(Number(goal(pc, "homes_ready").value)).toBe(100);
    // The same team score for every coordinator.
    const pc2 = await compute("coordinator", PC2, "2026-11-01", "2026-12-02T12:00:00Z");
    expect(goal(pc2, "homes_ready").value).toEqual(goal(pc, "homes_ready").value);
    // Personal follow through is each coordinator's own tickets.
    expect(goal(pc, "follow_through").denominator).toBe(1);
    expect(goal(pc2, "follow_through").numerator).toBe(0);
  });

  it("queue checks: three windows per scheduled shift, only Team Queue opens count", async () => {
    // Mon Nov 16 2026: shift 8 AM to 5 PM Central = 14:00Z to 23:00Z; midpoint 18:30Z.
    await db.exec(`INSERT INTO public.scorecard_records(kind, recorded_by, recorded_at, details) VALUES
      ('queue_sweep', '${SUP}', '2026-11-16T14:10:00Z', '{"source":"team_queue"}'),
      ('queue_sweep', '${SUP}', '2026-11-16T18:40:00Z', '{"source":"team_queue"}'),
      ('queue_sweep', '${SUP}', '2026-11-16T22:50:00Z', '{"source":"supervisor_check"}')`);
    const c = await compute("ops_supervisor", SUP, "2026-11-09", "2026-11-17T00:00:00Z");
    const g = goal(c, "queue_checks");
    expect(g.denominator).toBe(3);
    expect(g.numerator).toBe(2);
  });

  it("the reviewer excuses a record with a reason, only the COO approves it, and it is logged", async () => {
    await pastPeriods();
    await db.exec(`INSERT INTO public.tickets(title, response_due_at, acknowledged_at, assigned_to) VALUES
      ('Met', '2026-09-10T15:00:00Z', '2026-09-10T14:00:00Z', '${PC1}'),
      ('Missed in an outage', '2026-09-11T15:00:00Z', NULL, '${PC1}')`);
    const before = goal(await compute("ops_supervisor", SUP, "2026-09-01", "2026-10-05T12:00:00Z"), "team_follow_through");
    expect(Number(before.value)).toBe(50);
    const key = before.facts.find((f) => !f.met).key;
    const gid = await goalId("ops_supervisor", "team_follow_through");
    await as(SUP);
    expect(await err(`SELECT public.bonus_request_adjustment('ops_supervisor', $1, '2026-09-01', $2, 'excused', $3, 'Outage all day')`, [SUP, gid, key]))
      .toContain("Only this person's reviewer");
    await as(DIROPS);
    expect(await err(`SELECT public.bonus_request_adjustment('ops_supervisor', $1, '2026-09-01', $2, 'excused', $3, '')`, [SUP, gid, key]))
      .toContain("Write the reason");
    const id = (await one(`SELECT public.bonus_request_adjustment('ops_supervisor', $1, '2026-09-01', $2, 'excused', $3, 'Outage all day') id`, [SUP, gid, key])).id;
    expect((await all(`SELECT title FROM public.staff_notifications WHERE user_id=$1`, [COO])).length).toBe(1);
    // Waiting for the COO: still counted.
    expect(Number(goal(await compute("ops_supervisor", SUP, "2026-09-01", "2026-10-05T12:00:00Z"), "team_follow_through").value)).toBe(50);
    expect(await err(`SELECT public.bonus_decide_adjustment($1, true, NULL)`, [id])).toContain("Only the COO");
    await as(COO);
    await db.query(`SELECT public.bonus_decide_adjustment($1, true, 'Agreed')`, [id]);
    const after = goal(await compute("ops_supervisor", SUP, "2026-09-01", "2026-10-05T12:00:00Z"), "team_follow_through");
    expect(Number(after.value)).toBe(100);
    expect(after.facts.find((f) => f.key === key).excused).toBe(true);
    const row = await one(`SELECT reason, requested_by, decision, decided_by FROM public.bonus_adjustments WHERE id=$1`, [id]);
    expect(row).toEqual({ reason: "Outage all day", requested_by: DIROPS, decision: "approved", decided_by: COO });
  });

  it("a system problem the COO approves counts at Goal met or the actual level, whichever is higher", async () => {
    await pastPeriods();
    await db.exec(`INSERT INTO public.tickets(title, response_due_at, acknowledged_at) VALUES
      ('Missed', '2026-09-10T15:00:00Z', NULL), ('Met', '2026-09-11T15:00:00Z', '2026-09-11T14:00:00Z')`);
    const gid = await goalId("ops_supervisor", "team_follow_through");
    await as(DIROPS);
    const id = (await one(`SELECT public.bonus_request_adjustment('ops_supervisor', $1, '2026-09-01', $2, 'system_problem', NULL, 'Clock did not start') id`, [SUP, gid])).id;
    await as(COO);
    await db.query(`SELECT public.bonus_decide_adjustment($1, true, NULL)`, [id]);
    const g = goal(await compute("ops_supervisor", SUP, "2026-09-01", "2026-10-05T12:00:00Z"), "team_follow_through");
    expect(Number(g.value)).toBe(50);
    expect(g.level).toBe("goal_met");
    expect(g.system_problem).toBe(true);
  });

  it("the verify chain: the Director verifies the Supervisor, the COO the Director, the Supervisor the coordinators; nobody their own", async () => {
    await pastPeriods();
    await as(SUP);
    expect(await err(`SELECT public.bonus_verify('ops_supervisor', $1, '2026-09-01')`, [SUP])).toContain("Nobody verifies their own");
    await as(COO);
    expect(await err(`SELECT public.bonus_verify('ops_supervisor', $1, '2026-09-01')`, [SUP])).toContain("Only this person's reviewer");
    await as(DIROPS);
    const v = (await one(`SELECT public.bonus_verify('ops_supervisor', $1, '2026-09-01') v`, [SUP])).v;
    expect(Number(v.total)).toBe(100);
    expect(await err(`SELECT public.bonus_verify('ops_supervisor', $1, '2026-09-01')`, [SUP])).toContain("already verified");
    expect((await one(`SELECT title, email FROM public.staff_notifications WHERE user_id=$1 AND kind='bonus_verified'`, [SUP])))
      .toEqual({ title: "Your bonus for Test September is verified", email: true });
    // Locked: entries need a reopen with a reason, which keeps the old values in history.
    expect(await err(`SELECT public.bonus_enter_measure('ops_supervisor', $1, '2026-09-01', $2, 90, 'Late entry', NULL)`,
      [SUP, await goalId("ops_supervisor", "weekly_report")])).toContain("Reopen it");
    expect(await err(`SELECT public.bonus_reopen('ops_supervisor', $1, '2026-09-01', '')`, [SUP])).toContain("Write why");
    await db.query(`SELECT public.bonus_reopen('ops_supervisor', $1, '2026-09-01', 'Weekly report was found')`, [SUP]);
    const hist = await all(`SELECT action, version, reason, total::text FROM public.bonus_period_history ORDER BY done_at`);
    expect(hist).toEqual([
      { action: "verified", version: 1, reason: null, total: "100.00" },
      { action: "reopened", version: 1, reason: "Weekly report was found", total: "100.00" },
    ]);
    expect(await err(`UPDATE public.bonus_period_history SET reason = 'x'`)).toContain("kept as it was written");
    // The Director's plan: the COO verifies; reviewer goals must be entered first.
    await as(DIROPS);
    expect(await err(`SELECT public.bonus_verify('director_ops', $1, '2026-09-01')`, [DIROPS])).toContain("Nobody verifies their own");
    await as(COO);
    expect(await err(`SELECT public.bonus_verify('director_ops', $1, '2026-09-01')`, [DIROPS])).toContain("Enter Guest issues fixed on time, Vendor coverage");
    await directorThreeGoals("2026-09-01", 80);
    await as(COO);
    expect(Number((await one(`SELECT public.bonus_verify('director_ops', $1, '2026-09-01') v`, [DIROPS])).v.total)).toBeGreaterThan(0);
    // Coordinators: the Supervisor verifies.
    await as(DIROPS);
    expect(await err(`SELECT public.bonus_verify('coordinator', $1, '2026-09-01')`, [PC1])).toContain("Only this person's reviewer");
    await as(SUP);
    expect(Number((await one(`SELECT public.bonus_verify('coordinator', $1, '2026-09-01') v`, [PC1])).v.total)).toBe(50);
  });

  it("a period that has not ended cannot be verified", async () => {
    await as(DIROPS);
    expect(await err(`SELECT public.bonus_verify('ops_supervisor', $1, '2027-12-01')`, [SUP])).toContain("not found");
    await db.exec(`INSERT INTO public.bonus_period_amounts (plan_code, period_start, period_end, label, amount_goal_met, amount_strong, amount_exceeds)
                   VALUES ('ops_supervisor', '2099-01-01', '2099-01-31', 'Future', 1, 2, 3)`);
    expect(await err(`SELECT public.bonus_verify('ops_supervisor', $1, '2099-01-01')`, [SUP])).toContain("has not ended yet");
  });

  it("Finance sees nothing until Verified, then the amounts; the CSV fields come from the same rows", async () => {
    await pastPeriods();
    await db.exec(`SELECT private.bonus_sweep('2026-10-01T15:00:00Z')`);
    await as(FIN);
    let rows = (await one(`SELECT public.bonus_payouts() r`)).r;
    const sup = rows.find((r) => r.plan === "ops_supervisor");
    expect(sup.status).toBe("ready");
    expect(sup.total).toBeNull();
    expect(sup.goals).toEqual([]);
    expect(await err(`SELECT public.bonus_scorecard('ops_supervisor', $1, '2026-09-01')`, [SUP])).toContain("cannot see this bonus");
    expect(await err(`SELECT * FROM public.bonus_save_plan('ops_supervisor', '2026-11-16', 1, 2, 3, NULL)`)).toContain("Only the COO, the CEO or Admin");
    await as(DIROPS);
    await db.query(`SELECT public.bonus_verify('ops_supervisor', $1, '2026-09-01')`, [SUP]);
    expect(await err(`SELECT public.bonus_payouts()`)).toContain("Only Finance");
    await as(FIN);
    rows = (await one(`SELECT public.bonus_payouts() r`)).r;
    const verified = rows.find((r) => r.plan === "ops_supervisor");
    expect(verified.status).toBe("verified");
    expect(Number(verified.total)).toBe(100);
    expect(verified.verified_by).toBe("Director person");
    expect(verified.goals.map((g) => g.name)).toEqual([
      "Team on time follow through", "Queue checks", "Team clean records", "Monthly coaching", "Weekly report on time",
    ]);
    expect(verified.pays_on).toBe("The last payday in October 2026");
  });

  it("each role sees only what it should", async () => {
    await pastPeriods();
    const can = async (who: string | null, plan: string, user: string) => {
      await as(who);
      return (await err(`SELECT public.bonus_scorecard($1, $2, '2026-09-01')`, [plan, user])) === "";
    };
    // Own, reviewer, leaders.
    expect(await can(SUP, "ops_supervisor", SUP)).toBe(true);
    expect(await can(DIROPS, "ops_supervisor", SUP)).toBe(true);
    expect(await can(COO, "ops_supervisor", SUP)).toBe(true);
    expect(await can(CEO, "ops_supervisor", SUP)).toBe(true);
    expect(await can(ADMIN, "ops_supervisor", SUP)).toBe(true);
    expect(await can(DIROPS, "director_ops", DIROPS)).toBe(true);
    expect(await can(SUP, "coordinator", PC1)).toBe(true);
    // Outside the chain.
    expect(await can(SUP, "director_ops", DIROPS)).toBe(false);
    expect(await can(DIROPS, "coordinator", PC1)).toBe(false);
    expect(await can(PC1, "ops_supervisor", SUP)).toBe(false);
    expect(await can(PC1, "coordinator", PC2)).toBe(false);
    expect(await can(OTHER, "coordinator", PC1)).toBe(false);
    expect(await can(ONB, "ops_supervisor", SUP)).toBe(false);
    expect(await can(FIN, "coordinator", PC1)).toBe(false);
    expect(await can(null, "ops_supervisor", SUP)).toBe(false);
    // A coordinator sees nothing until their start date (test settings moved it to Sep 1).
    expect(await can(PC1, "coordinator", PC1)).toBe(true);
    await db.exec(`UPDATE public.bonus_participants SET eligible_from = '2099-01-01' WHERE user_id = '${PC1}'`);
    expect(await can(PC1, "coordinator", PC1)).toBe(false);
    await as(PC1);
    expect((await one(`SELECT public.bonus_my_plans() p`)).p).toEqual([]);
    // Lists: the reviewer's people and leaders' everyone.
    await as(SUP);
    expect((await one(`SELECT public.bonus_people() p`)).p.map((x) => x.user_id).sort()).toEqual([PC1, PC2].sort());
    await as(DIROPS);
    expect((await one(`SELECT public.bonus_people() p`)).p.map((x) => x.user_id)).toEqual([SUP]);
    await as(COO);
    expect((await one(`SELECT public.bonus_people() p`)).p.length).toBe(4);
    // Direct reads of the tables: leaders only.
    await db.exec(`GRANT USAGE ON SCHEMA public, private TO authenticated; GRANT SELECT ON public.me, public.user_roles, public.functional_roles TO authenticated;`);
    for (const [who, n] of [[COO, 4], [SUP, 0], [FIN, 0]]) {
      await as(who);
      await db.exec(`SET ROLE authenticated`);
      expect((await one(`SELECT count(*)::int n FROM public.bonus_participants`)).n).toBe(n);
      await db.exec(`RESET ROLE`);
    }
  });

  it("the period close item, email and one reminder after 2 days", async () => {
    // Dec 1 2026: November closed for the Supervisor; the Director's pilot has not.
    let r = (await one(`SELECT private.bonus_sweep('2026-12-01T15:00:00Z') r`)).r;
    expect(r).toEqual({ ready: 1, reminded: 0 });
    const n = await all(`SELECT user_id, kind, title, email, link_path FROM public.staff_notifications`);
    expect(n).toEqual([{ user_id: DIROPS, kind: "bonus_ready", title: "November 2026 is ready to verify for Operations Supervisor", email: true, link_path: "/bonus-verify" }]);
    await as(DIROPS);
    expect((await one(`SELECT public.bonus_my_reviews() r`)).r.map((x) => x.label)).toEqual(["November 2026"]);
    await as(SUP);
    expect((await one(`SELECT public.bonus_my_reviews() r`)).r).toEqual([]);
    r = (await one(`SELECT private.bonus_sweep('2026-12-01T16:00:00Z') r`)).r;
    expect(r).toEqual({ ready: 0, reminded: 0 });
    r = (await one(`SELECT private.bonus_sweep('2026-12-03T16:00:00Z') r`)).r;
    expect(r).toEqual({ ready: 0, reminded: 1 });
    r = (await one(`SELECT private.bonus_sweep('2026-12-04T16:00:00Z') r`)).r;
    expect(r).toEqual({ ready: 0, reminded: 0 });
    expect((await all(`SELECT title FROM public.staff_notifications WHERE kind='bonus_ready_reminder'`)).map((x) => x.title))
      .toEqual(["Reminder: November 2026 is ready to verify for Operations Supervisor"]);
    // Jan 1 2027: the pilot closes, so the COO gets the Director's.
    await db.exec(`SELECT private.bonus_sweep('2027-01-01T15:00:00Z')`);
    expect((await one(`SELECT title FROM public.staff_notifications WHERE user_id=$1`, [COO])).title)
      .toBe("Pilot, Nov 9 to Dec 31, 2026 is ready to verify for Director of Operations");
  });

  it("the person raises a question within 3 business days of receiving the scorecard", async () => {
    await pastPeriods();
    await as(SUP);
    expect(await err(`SELECT public.bonus_raise_question('ops_supervisor', '2026-09-01', 'Why is coaching low?')`)).toContain("once your bonus is verified");
    await as(DIROPS);
    await db.query(`SELECT public.bonus_verify('ops_supervisor', $1, '2026-09-01')`, [SUP]);
    await as(SUP);
    const card = (await one(`SELECT public.bonus_scorecard('ops_supervisor', $1, '2026-09-01') c`, [SUP])).c;
    expect(card.can_raise_question).toBe(true);
    expect(card.status).toBe("verified");
    await db.query(`SELECT public.bonus_raise_question('ops_supervisor', '2026-09-01', 'Why is coaching low?')`);
    // The Director (reviewer) and the COO (settles Supervisor questions) are told.
    expect((await all(`SELECT user_id FROM public.staff_notifications WHERE kind='bonus_question' ORDER BY user_id`)).map((x) => x.user_id))
      .toEqual([COO, DIROPS].sort());
    await db.exec(`UPDATE public.bonus_periods SET verified_at = '2026-10-01T15:00:00Z'`);
    expect(await err(`SELECT public.bonus_raise_question('ops_supervisor', '2026-09-01', 'Another question')`)).toContain("3 business days");
    // Thu Oct 1 + 3 business days = Tue Oct 6, open to the end of that day Central.
    expect((await one(`SELECT private.bonus_question_closes('2026-10-01T15:00:00Z')::text t`)).t).toBe("2026-10-07 05:00:00+00");
  });

  it("settings: only the COO, the CEO and Admin change them, every change keeps who, when and the old value", async () => {
    await as(SUP);
    expect(await err(`SELECT public.bonus_save_plan('ops_supervisor', '2026-11-16', 1, 2, 3, NULL)`)).toContain("Only the COO, the CEO or Admin");
    expect(await err(`SELECT public.bonus_settings()`)).toContain("Only the COO, the CEO or Admin");
    await as(CEO);
    await db.query(`SELECT public.bonus_save_plan('ops_supervisor', '2026-11-16', 110, 140, 180, 'New amounts')`);
    const h = await all(`SELECT field, old_value, new_value, changed_by FROM public.bonus_settings_history WHERE area='plan' ORDER BY field`);
    expect(h).toEqual([
      { field: "amount_exceeds", old_value: 175, new_value: 180, changed_by: CEO },
      { field: "amount_goal_met", old_value: 100, new_value: 110, changed_by: CEO },
      { field: "amount_strong", old_value: 137.5, new_value: 140, changed_by: CEO },
    ]);
    expect(await err(`SELECT public.bonus_save_plan('ops_supervisor', '2026-11-16', 110, 100, 180, NULL)`)).toContain("must rise");
    const newGoal = (await one(`SELECT public.bonus_save_goal(NULL, 'director_ops', 'Q1 project', 0, 'points', 80, 90, 100, 'reviewer', true, NULL, NULL) id`)).id;
    expect((await one(`SELECT source, measure_key FROM public.bonus_goals WHERE id=$1`, [newGoal]))).toEqual({ source: "reviewer", measure_key: null });
    expect(await err(`SELECT public.bonus_save_goal(NULL, 'director_ops', 'Auto goal', 0, 'points', 80, 90, 100, 'automatic', true, NULL, NULL)`))
      .toContain("entered by the reviewer");
    await as(ADMIN);
    await db.query(`SELECT public.bonus_save_participant($1, 'coordinator', '2027-02-01', true, 'Started later')`, [PC1]);
    expect((await one(`SELECT old_value, new_value FROM public.bonus_settings_history WHERE area='person' AND field='eligible_from'`)))
      .toEqual({ old_value: "2027-01-01", new_value: "2027-02-01" });
    const s = (await one(`SELECT public.bonus_settings() s`)).s;
    expect(s.plans.length).toBe(3);
    expect(s.history.length).toBeGreaterThan(3);
    expect(await err(`DELETE FROM public.bonus_settings_history`)).toContain("kept as it was written");
  });

  it("quarterly priorities count only once accepted, used 30 days and with an agreed result", async () => {
    await as(COO);
    const start = "2026-11-09";
    await db.query(`SELECT public.bonus_save_priority(NULL, $1, $2::date, 'Counted', 60, 'result_agreed', '2026-11-20', 'Done')`, [DIROPS, start]);
    await db.query(`SELECT public.bonus_save_priority(NULL, $1, $2::date, 'Too late', 25, 'result_agreed', '2026-12-15', 'Done')`, [DIROPS, start]);
    await db.query(`SELECT public.bonus_save_priority(NULL, $1, $2::date, 'Still in use', 15, 'in_use', '2026-11-20', NULL)`, [DIROPS, start]);
    expect(await err(`SELECT public.bonus_save_priority(NULL, $1, $2::date, 'No result', 10, 'result_agreed', '2026-11-20', '')`, [DIROPS, start]))
      .toContain("agreed result");
    const g = goal(await compute("director_ops", DIROPS, start, "2027-01-02T12:00:00Z"), "quarterly_priorities");
    expect(Number(g.value)).toBe(60);
    expect(g.level).toBe("below");
  });

  it("guest rating: a survey and a public review on one stay are averaged, and fewer than 30 stays is not counted", async () => {
    await db.exec(`INSERT INTO public.guest_feedback(ownerrez_booking_id, rating, source, stay_end) VALUES
      ('b1', 5, 'resolve_survey', '2026-11-20'), ('b1', 4, 'ownerrez', '2026-11-20'), ('b2', 5, 'ownerrez', '2026-11-21'),
      ('b3', 3, 'ownerrez', '2026-11-12')`);
    let g = goal(await compute("director_ops", DIROPS, "2026-11-09", "2027-01-02T12:00:00Z"), "guest_rating");
    expect(g.status).toBe("not_enough");
    expect(g.denominator).toBe(2);
    expect(g.facts.map((f) => Number(f.score)).sort()).toEqual([4.5, 5]);
    await db.exec(`INSERT INTO public.guest_feedback(ownerrez_booking_id, rating, source, stay_end)
                   SELECT 'x' || n, 5, 'ownerrez', '2026-12-01' FROM generate_series(1, 28) n`);
    g = goal(await compute("director_ops", DIROPS, "2026-11-09", "2027-01-02T12:00:00Z"), "guest_rating");
    expect(g.status).toBe("counted");
    expect(Number(g.value)).toBeCloseTo((4.5 + 5 + 28 * 5) / 30, 3);
    expect(g.level).toBe("exceeds");
  });

  it("the maximum is never more than the Exceeds amount", async () => {
    await pastPeriods();
    await db.exec(`UPDATE public.bonus_goals SET share = 60 WHERE code IN ('guest_issues_fixed', 'vendor_coverage') AND plan_code = 'director_ops'`);
    await directorThreeGoals("2026-09-01", 100);
    const c = await compute("director_ops", DIROPS, "2026-09-01", "2026-10-05T12:00:00Z");
    expect(Number(c.total)).toBe(1125);
  });

  it("the undo removes everything 01 added", async () => {
    await db.exec(readFileSync(`${DIR}/undo/01_bonus_engine.sql`, "utf8"));
    expect((await one(`SELECT count(*)::int n FROM pg_tables WHERE tablename LIKE 'bonus_%'`)).n).toBe(0);
    expect((await one(`SELECT count(*)::int n FROM pg_proc WHERE proname LIKE 'bonus_%'`)).n).toBe(0);
    expect((await one(`SELECT count(*)::int n FROM cron.jobs`)).n).toBe(0);
  });

  it("screen words in the database messages follow the word rules", async () => {
    const sql = readFileSync(`${DIR}/01_bonus_engine.sql`, "utf8");
    const messages = [...sql.matchAll(/RAISE EXCEPTION '([^']*(?:''[^']*)*)'/g), ...sql.matchAll(/notify_staff\([^,]+, '[a-z_]+', '([^']+)'/g)].map((m) => m[1]);
    expect(messages.length).toBeGreaterThan(30);
    for (const m of messages) {
      expect(m).not.toMatch(/\bseat\b|\u2014|\u2013|\bP[1-4]\b|\bmedian\b|\bhit\b/i);
    }
  });
});
