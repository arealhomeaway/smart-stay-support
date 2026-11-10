// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/manual-trackers/01_manual_trackers.sql (Build 14; Emily,
 * Nov 10; register BN7, BN8, BN9 with docs/specs/bonus-guide-values.md G), loaded on top of the
 * Build 13 engine. Tables are stubbed with the live column names. Fake people and records only.
 */
const DIR = "docs/pending/manual-trackers";
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const COO = "00000000-0000-4000-8000-0000000000a2";
const CEO = "00000000-0000-4000-8000-0000000000a3";
const DIROPS = "00000000-0000-4000-8000-0000000000b1";
const SUP = "00000000-0000-4000-8000-0000000000b2";
const FIN = "00000000-0000-4000-8000-0000000000b3";
const PC1 = "00000000-0000-4000-8000-0000000000c1";
const PC2 = "00000000-0000-4000-8000-0000000000c2";
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
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${COO}','admin'), ('${CEO}','admin'),
  ('${DIROPS}','manager'), ('${SUP}','manager'), ('${FIN}','manager'), ('${PC1}','tech'), ('${PC2}','tech'), ('${ONB}','onboarding');
CREATE FUNCTION private.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
CREATE TABLE public.functional_roles(code text PRIMARY KEY, name text, active boolean DEFAULT true, current_seat_holder uuid);
INSERT INTO public.functional_roles VALUES ('coo','COO',true,'${COO}'), ('ceo','CEO',true,'${CEO}'),
  ('director_ops','Director of Operations',true,'${DIROPS}'), ('ops_supervisor','Operations Supervisor',true,'${SUP}'),
  ('finance_lead','Finance Lead',true,'${FIN}'), ('po_day','PC day',true,'${PC1}'), ('po_evening','PC evening',true,'${PC2}');
CREATE FUNCTION public.seat_holder_at(_c text, _at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT current_seat_holder FROM public.functional_roles WHERE code = _c $$;
CREATE FUNCTION private.sc_holds(_u uuid, _c text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT _u IS NOT NULL AND public.seat_holder_at(_c) IS NOT DISTINCT FROM _u $$;
CREATE FUNCTION private.sc_is_ops_supervisor(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.sc_holds(_u, 'ops_supervisor') $$;
CREATE FUNCTION public.is_finance_lead(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.sc_holds(_u, 'finance_lead') $$;
CREATE FUNCTION private.refuse_record_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'This record is permanent. Add a new line instead.'; END $$;
CREATE FUNCTION public.add_business_days(_d date, _n integer) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d date := _d; left_n int := abs(_n);
BEGIN WHILE left_n > 0 LOOP d := d + 1; IF extract(isodow FROM d) < 6 THEN left_n := left_n - 1; END IF; END LOOP; RETURN d; END $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text);
INSERT INTO public.profiles VALUES ('${SUP}','Supervisor person'), ('${DIROPS}','Director person'), ('${PC1}','Coordinator one'),
  ('${PC2}','Coordinator two'), ('${COO}','COO person');
CREATE TABLE public.coverage_shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_code text, weekday smallint,
  start_minute int, end_minute int, active boolean DEFAULT true);
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz, external_source text, external_id text, department_code text DEFAULT 'operations', priority text DEFAULT 'p3',
  created_at timestamptz DEFAULT now(), reported_at timestamptz, resolved_at timestamptz,
  response_due_at timestamptz, acknowledged_at timestamptz, action_due_at timestamptz, action_started_at timestamptz, assigned_to uuid);
CREATE TABLE public.routine_controls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text, title text, status text DEFAULT 'due',
  due_at timestamptz, assigned_to uuid, completed_at timestamptz, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.shift_end_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, ended_at timestamptz,
  nothing_to_hand_off boolean DEFAULT false, ticket_ids uuid[], handoff_ids uuid[], is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.scorecard_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), about_user_id uuid, ticket_id uuid, note text,
  details jsonb NOT NULL DEFAULT '{}', refers_to uuid, about_imported_ticket boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.arrival_checks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_label text, check_in_at timestamptz,
  result text, is_test boolean NOT NULL DEFAULT false, late_booking boolean NOT NULL DEFAULT false, cleared_at timestamptz);
CREATE TABLE public.guest_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ownerrez_booking_id text, rating int,
  source text, stay_end date, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text,
  body text, link_path text, email boolean, created_at timestamptz DEFAULT clock_timestamp());
CREATE FUNCTION public.notify_staff(_u uuid, _k text, _t text, _b text, _et text, _eid uuid, _l text, _p text, _a uuid, _e boolean, _d boolean)
  RETURNS uuid LANGUAGE sql AS $$ INSERT INTO public.staff_notifications(user_id, kind, title, body, link_path, email)
    VALUES (_u,_k,_t,_b,_l,_e) RETURNING id $$;
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb, updated_by uuid, updated_at timestamptz DEFAULT now());
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text, entity_type text,
  entity_label text, before_value jsonb, after_value jsonb);
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
const WEEK = "2026-09-14"; // a Monday; the draw covers Sep 7 to Sep 13
const CHECK = { notes_complete: true, guest_communication: true, expenses_tracked: true, handoff_ready: true, proof_attached: true };

// PC1: 12 tickets and 1 routine check that week, plus an imported Notion ticket, a demo ticket and
// an archived ticket that must never be drawn. PC2: 2 tickets.
const seedWork = async () => {
  await db.exec(`
    INSERT INTO public.tickets (title, assigned_to, created_at)
      SELECT 'PC1 ticket ' || i, '${PC1}', '2026-09-08 15:00+00'::timestamptz + (i || ' hours')::interval FROM generate_series(1, 12) i;
    INSERT INTO public.tickets (title, assigned_to, created_at) VALUES
      ('PC2 ticket 1', '${PC2}', '2026-09-09 15:00+00'), ('PC2 ticket 2', '${PC2}', '2026-09-10 15:00+00');
    INSERT INTO public.tickets (title, assigned_to, created_at, external_source) VALUES ('Imported', '${PC1}', '2026-09-09 15:00+00', 'notion');
    INSERT INTO public.tickets (title, assigned_to, created_at, is_demo) VALUES ('Demo', '${PC1}', '2026-09-09 15:00+00', true);
    INSERT INTO public.tickets (title, assigned_to, created_at, archived_at) VALUES ('Archived', '${PC1}', '2026-09-09 15:00+00', now());
    INSERT INTO public.tickets (title, assigned_to, created_at) VALUES ('Before the week', '${PC1}', '2026-09-01 15:00+00');
    INSERT INTO public.routine_controls (kind, title, status, assigned_to, completed_at, due_at)
      VALUES ('touch_base', 'Touch base', 'completed', '${PC1}', '2026-09-09 16:00+00', '2026-09-09 18:00+00');`);
};
const draws = async () => all(`SELECT d.*, t.title FROM public.team_record_draws d LEFT JOIN public.tickets t ON t.id = d.record_id ORDER BY draw_no`);
const review = async (id: string, clean: boolean, checklist = CHECK, note: string | null = null, url: string | null = null) =>
  db.query(`SELECT public.team_records_review($1, $2, $3::jsonb, $4, $5) AS id`, [id, clean, JSON.stringify(checklist), note, url]);

describe("manual trackers (01)", () => {
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(readFileSync("docs/pending/bonus-engine/01_bonus_engine.sql", "utf8"));
    await db.exec(readFileSync(`${DIR}/01_manual_trackers.sql`, "utf8"));
    await as(null);
  });

  it("the Monday draw takes 5 per active coordinator at random, never imported, demo, archived or out of week records", async () => {
    await seedWork();
    const n = (await one(`SELECT private.mt_draw($1::date) AS n`, [WEEK])).n;
    expect(n).toBe(10); // 2 active coordinators x 5
    const rows = await draws();
    expect(new Set(rows.map((r) => r.record_id)).size).toBe(10);
    expect(rows.filter((r) => r.owner_id === PC2).length).toBe(2); // all PC2 had
    expect(rows.some((r) => ["Imported", "Demo", "Archived", "Before the week"].includes(r.title))).toBe(false);
    expect(rows.every((r) => r.drawn_by === "schedule")).toBe(true);
    // Running again for the same week adds nothing.
    expect((await one(`SELECT private.mt_draw($1::date) AS n`, [WEEK])).n).toBe(0);
  });

  it("the draw is random: repeated draws of the same week choose different records", async () => {
    await seedWork();
    const sets = new Set<string>();
    for (let i = 0; i < 6; i++) {
      await db.exec("BEGIN");
      await db.query(`SELECT private.mt_draw($1::date)`, [WEEK]);
      const ids = (await draws()).map((r) => r.record_id).sort().join(",");
      sets.add(ids);
      await db.exec("ROLLBACK");
    }
    expect(sets.size).toBeGreaterThan(1);
  });

  it("a record is never drawn twice, even in a later week", async () => {
    await seedWork();
    await db.query(`SELECT private.mt_draw($1::date)`, [WEEK]);
    const first = (await draws()).map((r) => r.record_id);
    // Move the same work into the next week's window; only the 4 never drawn can come.
    await db.exec(`UPDATE public.tickets SET created_at = created_at + interval '7 days';
                   UPDATE public.routine_controls SET completed_at = completed_at + interval '7 days';`);
    await db.query(`SELECT private.mt_draw('2026-09-21'::date)`);
    const second = (await all(`SELECT record_id FROM public.team_record_draws WHERE week_start = '2026-09-21'`)).map((r) => r.record_id);
    expect(second.length).toBe(3);
    expect(second.some((id) => first.includes(id))).toBe(false);
  });

  it("Clean needs every item, Not clean needs a note and a link; nobody else reviews and nobody picks records", async () => {
    await seedWork();
    await db.query(`SELECT private.mt_draw($1::date)`, [WEEK]);
    const [a, b, c] = await draws();
    await as(SUP);
    expect(await err(`SELECT public.team_records_review($1, true, $2::jsonb, NULL, NULL)`, [a.id, JSON.stringify({ ...CHECK, proof_attached: false })]))
      .toContain("clean only when every item is there");
    expect(await err(`SELECT public.team_records_review($1, false, $2::jsonb, NULL, 'https://x.example/a')`, [a.id, JSON.stringify(CHECK)]))
      .toContain("Add a note");
    expect(await err(`SELECT public.team_records_review($1, false, $2::jsonb, 'Missing proof', NULL)`, [a.id, JSON.stringify(CHECK)]))
      .toContain("Add a link to the evidence");
    await review(a.id, false, { ...CHECK, proof_attached: false }, "Marked done with no photo", "https://files.example/photo");
    await review(b.id, true);
    expect(await err(`SELECT public.team_records_review($1, true, $2::jsonb, NULL, NULL)`, [b.id, JSON.stringify(CHECK)])).toContain("already has a review");
    const fact = await one(`SELECT kind, recorded_by, about_user_id, note, details FROM public.scorecard_records WHERE details->>'draw_id' = $1`, [a.id]);
    expect(fact.kind).toBe("records_check");
    expect(fact.recorded_by).toBe(SUP);
    expect(fact.about_user_id).toBeNull(); // so a coordinator cannot read it before their start date
    expect(fact.details.owner_id).toBe(a.owner_id);
    expect(fact.details.result).toBe("not_clean");
    expect(fact.details.evidence_url).toBe("https://files.example/photo");
    expect(await err(`UPDATE public.team_record_draws SET owner_id = $1`, [PC2])).toContain("permanent");
    for (const who of [PC1, DIROPS, ADMIN, FIN]) {
      await as(who);
      expect(await err(`SELECT public.team_records_review($1, true, $2::jsonb, NULL, NULL)`, [c.id, JSON.stringify(CHECK)])).toContain("Only the Operations Supervisor");
    }
    // There is no function that takes a record of the Supervisor's choosing.
    const fns = (await all(`SELECT proname FROM pg_proc WHERE proname LIKE 'team_records_%'`)).map((r) => r.proname).sort();
    expect(fns).toEqual(["team_records_double_check", "team_records_mine", "team_records_review", "team_records_skip", "team_records_week", "team_records_weeks"]);
  });

  it("nobody reviews their own record", async () => {
    await seedWork();
    await db.query(`SELECT private.mt_draw($1::date)`, [WEEK]);
    const [a] = await draws();
    await db.exec(`UPDATE public.functional_roles SET current_seat_holder = '${a.owner_id}' WHERE code = 'ops_supervisor'`);
    await as(a.owner_id);
    expect(await err(`SELECT public.team_records_review($1, true, $2::jsonb, NULL, NULL)`, [a.id, JSON.stringify(CHECK)])).toContain("their own");
  });

  it("a skip needs a reason and draws another record, the same coordinator first", async () => {
    await seedWork();
    await db.query(`SELECT private.mt_draw($1::date)`, [WEEK]);
    const pc1 = (await draws()).find((r) => r.owner_id === PC1);
    await as(SUP);
    expect(await err(`SELECT public.team_records_skip($1, 'no')`, [pc1.id])).toContain("Write why");
    const res = (await one(`SELECT public.team_records_skip($1, 'The ticket was merged into another') AS r`, [pc1.id])).r;
    const repl = await one(`SELECT * FROM public.team_record_draws WHERE id = $1`, [res.replacement_id]);
    expect(repl.replaces).toBe(pc1.id);
    expect(repl.owner_id).toBe(PC1);
    expect(repl.drawn_by).toBe("skip");
    const week = (await one(`SELECT public.team_records_week($1::date) AS w`, [WEEK])).w;
    expect(week.total).toBe(10);
    expect(week.skipped).toBe(1);
    expect(week.items.find((i) => i.id === pc1.id).status).toBe("skipped");
    expect(await err(`SELECT public.team_records_review($1, true, $2::jsonb, NULL, NULL)`, [pc1.id, JSON.stringify(CHECK)])).toContain("already has a review");
  });

  it("the Director double checks reviews chosen at random, and a Disagree decides the result", async () => {
    await seedWork();
    await db.query(`SELECT private.mt_draw($1::date)`, [WEEK]);
    const rows = await draws();
    await as(SUP);
    for (const r of rows) await review(r.id, true);
    await as(DIROPS);
    const week = (await one(`SELECT public.team_records_week($1::date) AS w`, [WEEK])).w;
    expect(week.picked).toBe(5);
    expect(week.can_check).toBe(true);
    const picked = week.items.filter((i) => i.picked);
    const notPicked = week.items.find((i) => !i.picked);
    expect(await err(`SELECT public.team_records_double_check($1, true, NULL)`, [notPicked.review_id])).toContain("chosen at random");
    expect(await err(`SELECT public.team_records_double_check($1, false, NULL)`, [picked[0].review_id])).toContain("why you disagree");
    await db.query(`SELECT public.team_records_double_check($1, false, 'No closing photo')`, [picked[0].review_id]);
    await db.query(`SELECT public.team_records_double_check($1, true, NULL)`, [picked[1].review_id]);
    expect(await err(`SELECT public.team_records_double_check($1, true, NULL)`, [picked[1].review_id])).toContain("already double checked");
    const after = (await one(`SELECT public.team_records_week($1::date) AS w`, [WEEK])).w;
    expect(after.clean).toBe(9);
    expect(after.not_clean).toBe(1);
    expect(after.items.find((i) => i.review_id === picked[0].review_id).final).toBe("not_clean");
    await as(SUP);
    expect(await err(`SELECT public.team_records_double_check($1, true, NULL)`, [picked[2].review_id])).toContain("Only the Director");
  });

  it("Finance sees weekly totals only; a coordinator sees only their own results, from their start date", async () => {
    await seedWork();
    await db.query(`SELECT private.mt_draw($1::date)`, [WEEK]);
    const rows = await draws();
    await as(SUP);
    const mine = rows.find((r) => r.owner_id === PC1);
    await review(mine.id, false, { ...CHECK, notes_complete: false }, "Notes missing the guest reply", "https://x.example/1");
    await as(FIN);
    const fin = (await one(`SELECT public.team_records_week($1::date) AS w`, [WEEK])).w;
    expect(fin.view).toBe("finance");
    expect(fin.items).toEqual([]);
    expect(fin.not_clean).toBe(1);
    expect(JSON.stringify(fin)).not.toContain("guest reply");
    await as(PC1);
    expect(await err(`SELECT public.team_records_week($1::date)`, [WEEK])).toContain("Only the Operations Supervisor");
    expect(await err(`SELECT public.weekly_scorecard(NULL)`)).toContain("Only the Operations Supervisor");
    const before = (await one(`SELECT public.team_records_mine() AS m`)).m;
    expect(before.started).toBe(false); // coordinators count from Jan 1, 2027
    expect(before.items).toEqual([]);
    await db.exec(`UPDATE public.bonus_plans SET counting_start = '2026-01-01' WHERE code = 'coordinator';
                   UPDATE public.bonus_participants SET eligible_from = '2026-01-01' WHERE plan_code = 'coordinator';`);
    const now = (await one(`SELECT public.team_records_mine() AS m`)).m;
    expect(now.started).toBe(true);
    expect(now.not_clean).toBe(1);
    expect(now.items[0].note).toBe("Notes missing the guest reply");
    await as(PC2);
    expect((await one(`SELECT public.team_records_mine() AS m`)).m.items).toEqual([]);
    await as(ONB);
    expect(await err(`SELECT public.team_records_week($1::date)`, [WEEK])).toContain("Only the Operations Supervisor");
    expect(await err(`SELECT public.coaching_save_session($1, current_date, 'check_in', ARRAY['x'], 'notes', NULL, '[]', NULL)`, [PC1])).toContain("Only the Operations Supervisor");
    for (const who of [ADMIN, COO, CEO, DIROPS, SUP]) {
      await as(who);
      expect((await one(`SELECT public.team_records_week($1::date) AS w`, [WEEK])).w.view).toBe("lead");
    }
  });

  it("a coaching session saves, the month counts it against the setting, and a coordinator sees only their own", async () => {
    await as(SUP);
    expect(await err(`SELECT public.coaching_save_session($1, current_date, 'check_in', ARRAY[]::text[], 'notes here', NULL, '[]', NULL)`, [PC1]))
      .toContain("agenda item");
    expect(await err(`SELECT public.coaching_save_session($1, current_date, 'check_in', ARRAY['Reply times'], 'notes here', NULL,
                        '[{"text":"Shadow a shift","owner":"coordinator"}]', NULL)`, [PC1])).toContain("due date");
    await db.query(`SELECT public.coaching_save_session($1, current_date, 'check_in', ARRAY['Reply times', 'Handoffs'], 'Talked through the week',
                      'Calm with guests', jsonb_build_array(jsonb_build_object('text','Shadow a shift','owner','coordinator','due_on', current_date + 7)),
                      current_date + 30)`, [PC1]);
    let log = (await one(`SELECT public.coaching_log(NULL) AS l`)).l;
    expect(log.required).toBe(2); // 1 for each of the 2 active coordinators
    expect(log.done).toBe(1);
    expect(log.sessions[0].agenda).toEqual(["Reply times", "Handoffs"]);
    expect(log.sessions[0].follow_ups[0].owner).toBe("coordinator");
    const fact = await one(`SELECT kind, about_user_id FROM public.scorecard_records WHERE kind = 'coaching_cycle'`);
    expect(fact).toEqual({ kind: "coaching_cycle", about_user_id: PC1 });
    expect(await err(`SELECT public.manual_tracker_save_settings('coaching_settings', '{"per_month": 2}')`)).toContain("Only the Director");
    await as(DIROPS);
    await db.query(`SELECT public.manual_tracker_save_settings('coaching_settings', $1::jsonb)`,
      [JSON.stringify({ per_month: 1, per_coordinator: { [PC1]: 2 } })]);
    log = (await one(`SELECT public.coaching_log(NULL) AS l`)).l;
    expect(log.required).toBe(3);
    expect(log.coordinators.find((c) => c.user_id === PC1).required).toBe(2);
    expect((await one(`SELECT count(*)::int AS n FROM public.audit_log WHERE action = 'manual_tracker_setting_changed'`)).n).toBe(1);
    await as(PC2);
    const own = (await one(`SELECT public.coaching_log(NULL) AS l`)).l;
    expect(own.view).toBe("coordinator");
    expect(own.sessions).toEqual([]);
    await as(PC1);
    expect((await one(`SELECT public.coaching_log(NULL) AS l`)).l.sessions.length).toBe(1);
  });

  it("the weekly scorecard pre fills the facts, then Submit, Return, resubmit, Reviewed and a correction each add a version", async () => {
    // A Thursday two weeks ago is the first due date, so this week has opened and passed 3 PM.
    const due = (await one(`SELECT (current_date - ((extract(isodow FROM current_date)::int - 4 + 7) % 7) - 14)::date::text AS d`)).d;
    await db.query(`UPDATE public.app_settings SET value = jsonb_build_object('first_due', $1::text) WHERE key = 'weekly_scorecard_settings'`, [due]);
    await db.query(`INSERT INTO public.tickets (title, assigned_to, priority, created_at, acknowledged_at, action_started_at, response_due_at, acknowledged_at)
                    VALUES ('Leak', $1, 'p1', ($2::date - 3)::timestamp + interval '15 hours',
                            ($2::date - 3)::timestamp + interval '15 hours 2 minutes', ($2::date - 3)::timestamp + interval '15 hours 9 minutes',
                            ($2::date - 3)::timestamp + interval '15 hours 3 minutes', NULL)`.replace(", acknowledged_at)", ")").replace(", NULL)", ")"), [PC1, due]);
    await as(SUP);
    const card = (await one(`SELECT public.weekly_scorecard($1::date) AS c`, [due])).c;
    expect(card.opened).toBe(true);
    expect(card.status).toBe("not_submitted");
    const pc1 = card.facts.coordinators.find((c) => c.user_id === PC1);
    expect(pc1.urgent).toEqual({ reply_met: 1, action_met: 0, total: 1 });
    expect(pc1.follow_through.total).toBe(1);
    expect(card.can_edit).toBe(true);
    const manual = { coordinators: { [PC1]: { level: "goal_met", notes: "Good week" } }, wins: "Fast replies", problems: "", requests: "" };
    await db.query(`SELECT public.weekly_scorecard_save_draft($1::date, $2::jsonb)`, [due, JSON.stringify(manual)]);
    const sub = (await one(`SELECT public.weekly_scorecard_submit($1::date, $2::jsonb, NULL) AS s`, [due, JSON.stringify(manual)])).s;
    expect(sub.version).toBe(1);
    expect(sub.status).toBe("late"); // submitted after Thursday 3 PM
    const note = await one(`SELECT user_id, title FROM public.staff_notifications WHERE kind = 'weekly_scorecard_submitted'`);
    expect(note).toEqual({ user_id: DIROPS, title: "Weekly scorecard submitted by the Operations Supervisor. Review it." });
    expect(await err(`SELECT public.weekly_scorecard_save_draft($1::date, '{}')`, [due])).toContain("Start a correction");
    expect(await err(`SELECT public.weekly_scorecard_decide($1::date, true, NULL)`, [due])).toContain("Only the Director");
    await as(DIROPS);
    expect(await err(`SELECT public.weekly_scorecard_decide($1::date, false, NULL)`, [due])).toContain("what to fix");
    await db.query(`SELECT public.weekly_scorecard_decide($1::date, false, 'Add the urgent ticket notes')`, [due]);
    await as(SUP);
    let c2 = (await one(`SELECT public.weekly_scorecard($1::date) AS c`, [due])).c;
    expect(c2.return_note).toBe("Add the urgent ticket notes");
    expect(c2.can_edit).toBe(true);
    await db.query(`SELECT public.weekly_scorecard_submit($1::date, $2::jsonb, NULL)`, [due, JSON.stringify({ ...manual, problems: "Urgent leak" })]);
    await as(DIROPS);
    await db.query(`SELECT public.weekly_scorecard_decide($1::date, true, NULL)`, [due]);
    expect(await err(`SELECT public.weekly_scorecard_decide($1::date, true, NULL)`, [due])).toContain("no new submission");
    await as(SUP);
    expect(await err(`SELECT public.weekly_scorecard_submit($1::date, '{}', NULL)`, [due])).toContain("reason for the correction");
    await db.query(`SELECT public.weekly_scorecard_submit($1::date, $2::jsonb, 'Wrong coordinator note')`, [due, JSON.stringify(manual)]);
    c2 = (await one(`SELECT public.weekly_scorecard($1::date) AS c`, [due])).c;
    expect(c2.events.map((e) => `${e.action}:${e.version}`)).toEqual(["submitted:1", "returned:1", "submitted:2", "reviewed:2", "submitted:3"]);
    expect(c2.events[4].reason).toBe("Wrong coordinator note");
    expect(c2.status).toBe("late");
    await as(FIN);
    const fin = (await one(`SELECT public.weekly_scorecard($1::date) AS c`, [due])).c;
    expect(fin.manual).toBeNull();
    expect(JSON.stringify(fin)).not.toContain("Wrong coordinator note");
    expect(fin.facts.coordinators.length).toBe(2);
  });

  it("On time, Late and Not submitted follow Thursday 3 PM Central", async () => {
    await db.exec(`UPDATE public.app_settings SET value = '{"first_due": "2026-09-03"}' WHERE key = 'weekly_scorecard_settings'`);
    const sub = (due: string, at: string) =>
      db.query(`INSERT INTO public.scorecard_records (kind, recorded_by, recorded_at, details)
                VALUES ('weekly_submission', $1, $2::timestamptz, jsonb_build_object('action','submitted','due_on',$3::text,'version',1))`, [SUP, at, due]);
    await sub("2026-09-03", "2026-09-03 14:59:00-05"); // 2:59 PM Central
    await sub("2026-09-10", "2026-09-10 15:01:00-05"); // 3:01 PM Central
    const st = await all(`SELECT d::date::text AS d, private.mt_weekly_status(d::date) AS s, private.mt_weekly_met(d::date) AS m
                            FROM unnest(ARRAY['2026-09-03','2026-09-10','2026-09-17']::date[]) d`);
    expect(st).toEqual([
      { d: "2026-09-03", s: "on_time", m: true },
      { d: "2026-09-10", s: "late", m: false },
      { d: "2026-09-17", s: "not_submitted", m: false },
    ]);
  });

  it("the Build 13 engine reads the three trackers for the Supervisor's goals", async () => {
    await db.exec(`
      UPDATE public.bonus_plans SET counting_start = '2026-09-01' WHERE code = 'ops_supervisor';
      UPDATE public.bonus_participants SET eligible_from = '2026-09-01';
      INSERT INTO public.bonus_period_amounts (plan_code, period_start, period_end, label, amount_goal_met, amount_strong, amount_exceeds)
      VALUES ('ops_supervisor', '2026-09-01', '2026-09-30', 'Test September', 100, 137.50, 175);
      UPDATE public.app_settings SET value = '{"first_due": "2026-09-03"}' WHERE key = 'weekly_scorecard_settings';`);
    const fact = (kind: string, at: string, details: object, extra = "") =>
      db.query(`INSERT INTO public.scorecard_records (kind, recorded_by, recorded_at, details${extra ? ", about_user_id" : ""})
                VALUES ($1, '${SUP}', $2::timestamptz, $3::jsonb${extra ? `, '${extra}'` : ""}) RETURNING id`, [kind, at, JSON.stringify(details)]);
    // 4 record reviews: 3 clean, 1 not clean; the Director disagrees with one clean one.
    const ids = [];
    for (const [i, result] of ["clean", "clean", "clean", "not_clean"].entries()) {
      ids.push((await fact("records_check", `2026-09-1${i} 15:00+00`, { action: "review", result, owner_id: PC1, label: "r" })).rows[0].id);
    }
    await db.query(`INSERT INTO public.scorecard_records (kind, recorded_by, recorded_at, refers_to, details)
                    VALUES ('records_check_review', $1, '2026-09-20 15:00+00', $2, '{"agree": false}')`, [DIROPS, ids[0]]);
    // A skip never counts.
    await fact("records_check", "2026-09-12 15:00+00", { action: "skip", owner_id: PC1 });
    // Weekly scorecards due Sep 3, 10, 17, 24: on time, on time, late, on time but left Returned.
    for (const [due, at] of [["2026-09-03", "2026-09-03 12:00-05"], ["2026-09-10", "2026-09-10 12:00-05"], ["2026-09-17", "2026-09-17 16:00-05"], ["2026-09-24", "2026-09-24 12:00-05"]]) {
      await fact("weekly_submission", at, { action: "submitted", due_on: due, version: 1 });
    }
    await db.query(`INSERT INTO public.scorecard_records (kind, recorded_by, recorded_at, details)
                    VALUES ('weekly_submission', $1, '2026-09-24 18:00-05', '{"action":"returned","due_on":"2026-09-24","version":1}')`, [DIROPS]);
    // Coaching: both coordinators coached in September.
    await fact("coaching_cycle", "2026-09-15 15:00+00", { session_on: "2026-09-15" }, PC1);
    await fact("coaching_cycle", "2026-09-16 15:00+00", { session_on: "2026-09-16" }, PC2);
    const card = (await one(`SELECT private.bonus_compute('ops_supervisor', $1, '2026-09-01', '2026-10-05 12:00+00') AS c`, [SUP])).c;
    const g = (code: string) => card.goals.find((x) => x.code === code);
    expect(g("team_clean_records")).toMatchObject({ status: "counted", numerator: 2, denominator: 4, value: 50 });
    expect(g("weekly_report")).toMatchObject({ status: "counted", numerator: 2, denominator: 4, value: 50 });
    expect(g("coaching")).toMatchObject({ status: "counted", numerator: 2, denominator: 2, value: 100 });
    expect((await one(`SELECT private.bonus_measure_built('weekly_report') AS b`)).b).toBe(true);
    // The reviewer can no longer type a number over these goals.
    expect(await err(`SELECT public.bonus_enter_measure('ops_supervisor', $1, '2026-09-01', $2, 100, 'note', NULL)`,
      [SUP, (await one(`SELECT id FROM public.bonus_goals WHERE code = 'weekly_report'`)).id])).toBeTruthy();
    // The coordinator's own clean records count the same facts.
    await db.exec(`UPDATE public.bonus_plans SET counting_start = '2026-09-01' WHERE code = 'coordinator';
                   INSERT INTO public.bonus_period_amounts (plan_code, period_start, period_end, label, amount_goal_met, amount_strong, amount_exceeds)
                   VALUES ('coordinator', '2026-09-01', '2026-09-30', 'Test September', 50, 75, 100);`);
    const pc = (await one(`SELECT private.bonus_compute('coordinator', $1, '2026-09-01', '2026-10-05 12:00+00') AS c`, [PC1])).c;
    expect(pc.goals.find((x) => x.code === "clean_records")).toMatchObject({ status: "counted", numerator: 2, denominator: 4 });
  });

  it("Needs you now: the Supervisor's records and scorecard, the Director's review and double checks", async () => {
    const due = (await one(`SELECT (current_date - ((extract(isodow FROM current_date)::int - 4 + 7) % 7))::date::text AS d`)).d;
    await db.query(`UPDATE public.app_settings SET value = jsonb_build_object('first_due', $1::text) WHERE key = 'weekly_scorecard_settings'`, [due]);
    await as(SUP);
    let items = (await one(`SELECT public.trackers_waiting() AS w`)).w;
    expect(items.some((i) => i.kind === "weekly_due")).toBe(true);
    await db.query(`SELECT public.weekly_scorecard_submit($1::date, '{}', NULL)`, [due]);
    await as(DIROPS);
    items = (await one(`SELECT public.trackers_waiting() AS w`)).w;
    expect(items.find((i) => i.kind === "weekly_submitted").title).toBe("Weekly scorecard submitted by the Operations Supervisor. Review it.");
    await as(PC1);
    expect((await one(`SELECT public.trackers_waiting() AS w`)).w).toEqual([]);
  });

  it("the Monday job draws only on Monday from 6 AM Central", async () => {
    await seedWork();
    expect((await one(`SELECT private.mt_sweep('2026-09-14 10:30+00') AS n`)).n).toBe(0); // 5:30 AM Central
    expect((await one(`SELECT private.mt_sweep('2026-09-15 12:05+00') AS n`)).n).toBe(0); // Tuesday
    expect((await one(`SELECT private.mt_sweep('2026-09-14 11:05+00') AS n`)).n).toBe(10); // 6:05 AM Central
    expect((await one(`SELECT private.mt_sweep('2026-09-14 12:05+00') AS n`)).n).toBe(0);
    expect((await one(`SELECT schedule FROM cron.jobs WHERE name = 'team-records-draw'`)).schedule).toBe("5 11,12 * * 1");
  });

  it("screen words in the database messages follow the word rules", async () => {
    const sql = readFileSync(`${DIR}/01_manual_trackers.sql`, "utf8");
    const words = [...sql.matchAll(/'([^']{12,})'/g)].map((m) => m[1]).join("\n");
    expect(words).not.toMatch(/[\u2013\u2014]/);
    expect(words).not.toMatch(/\bseat\b/i);
    expect(words).not.toMatch(/\bP[1-4]\b/);
    expect(words).not.toMatch(/Median|\bHit\b/);
  });

  it("the undo removes everything 01 added and puts back the Build 13 engine", async () => {
    const before = (await one(`SELECT private.bonus_measure_built('weekly_report') AS b`)).b;
    expect(before).toBe(true);
    await db.exec(readFileSync(`${DIR}/undo/01_manual_trackers.sql`, "utf8"));
    expect((await one(`SELECT private.bonus_measure_built('weekly_report') AS b`)).b).toBe(false);
    expect((await one(`SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE 'mt\\_%' OR proname LIKE 'team_records%' OR proname LIKE 'weekly_scorecard%' OR proname LIKE 'coaching_%' OR proname = 'trackers_waiting'`)).n).toBe(0);
    expect((await one(`SELECT count(*)::int AS n FROM pg_tables WHERE tablename IN ('team_record_draws','team_record_check_picks','weekly_scorecard_drafts')`)).n).toBe(0);
    expect((await one(`SELECT count(*)::int AS n FROM cron.jobs WHERE name = 'team-records-draw'`)).n).toBe(0);
    const b13 = readFileSync("docs/pending/bonus-engine/01_bonus_engine.sql", "utf8");
    const def = (await one(`SELECT prosrc FROM pg_proc WHERE proname = 'bonus_facts'`)).prosrc;
    expect(b13).toContain(def.trim().slice(0, 400));
    expect(def).not.toContain("records_check");
  });
});
