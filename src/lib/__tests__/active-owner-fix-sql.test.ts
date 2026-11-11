// Active Owner fix (Nov 11): the staged database change in docs/pending/active-owner-fix, run against an
// isolated PostgreSQL copy built from the live table shapes and the live engine functions captured on
// Nov 11. Nothing here touches the real database.
import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/active-owner-fix";
const read = (p: string) => readFileSync(p, "utf8");
const live = (f: string) => read(`${DIR}/live-capture/${f}.sql`);
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = "98bd6696-4018-4965-b645-0471c5ae3925";
const dirOnb = U(2), pc = U(3), owner1 = U(4), owner2 = U(5), pm = U(6);
const or1 = U(7), or2 = U(8);
const h1 = U(11), h2 = U(12), h3 = U(13), h4 = U(14), h5 = U(15);
const prog1 = U(21), prog2 = U(22);
const stepA = U(31), stepB = U(32), stepC = U(33), stepOps = U(34), stepSend = U(35), stepNone = U(36);

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('test.uid', true),''), nullif(current_setting('request.jwt.claim.sub', true),''))::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE TABLE public.staff(id uuid PRIMARY KEY, is_admin boolean NOT NULL DEFAULT false, onb_director boolean NOT NULL DEFAULT false);
CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION public.is_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION private.is_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION public.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION private.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION private.is_onboarding_leader(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1 AND (onb_director OR is_admin)) $$;
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1 AND is_admin AND $2='admin') $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1 AND onb_director) $$;
CREATE FUNCTION public.is_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.seat_holder(text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT CASE WHEN $1='onboarding_director' THEN '${dirOnb}'::uuid END $$;
CREATE FUNCTION private.actor_label(uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'Admin'::text $$;
CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.active_owner_may_act(boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE FUNCTION private.onboarding_work_locked(uuid[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
`;
const AFTER_SCHEMA = `
CREATE TABLE private.members(program_id uuid, user_id uuid, removed_at timestamptz);
GRANT SELECT ON public.staff, private.members TO authenticated;
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM private.members WHERE program_id=$1 AND user_id=$2 AND removed_at IS NULL) $$;
CREATE FUNCTION private.owner_program_readable(uuid, uuid, boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.is_program_member($2, $1) $$;
CREATE FUNCTION public.format_property_label(jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('primary', $1->>'name') $$;
CREATE TABLE public.tickets(id uuid PRIMARY KEY, property_id uuid, is_demo boolean DEFAULT false);
CREATE TABLE public.onboarding_templates(id uuid PRIMARY KEY, key text, name text);
CREATE TABLE public.onboarding_template_versions(id uuid PRIMARY KEY, template_id uuid, version int, snapshot jsonb);
CREATE TABLE public.onboarding_task_file_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, receiving_task_id uuid, source_task_id uuid, origin text, created_by uuid, UNIQUE(receiving_task_id, source_task_id));
CREATE FUNCTION public.plan_step_applies(jsonb, text, text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION public.project_role_assignee(uuid, text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${pm}'::uuid $$;
CREATE FUNCTION public.plan_due_from_rule(date, int, text) RETURNS date LANGUAGE sql STABLE AS $$ SELECT $1 + coalesce($2,0) $$;
`;
const LIVE = ["ao_central", "ao_add_business_days", "ao_home_stage", "ao_is_editor", "ao_title_key", "ao_card_coverage",
  "ao_live_card_match", "ao_unlock", "ao_task_completed", "ao_guard_owner_item", "ao_process_clocks", "notify_owner_of_review",
  "owner_business_decision_guard", "owner_current_property_for_actor", "append_owner_review_message",
  "manage_owner_review_conversation", "block_owner_message_mutation", "block_demo_owner_notification_delivery",
  "ao_set_home_automation", "ao_preview_home_automation", "ao_card_set_status"];
const TRIGGERS = `
CREATE TRIGGER ao_guard_owner_item BEFORE INSERT ON public.owner_reviews FOR EACH ROW EXECUTE FUNCTION private.ao_guard_owner_item();
CREATE TRIGGER owner_reviews_notify_owner AFTER INSERT OR UPDATE ON public.owner_reviews FOR EACH ROW WHEN ((NOT new.auto_ticket)) EXECUTE FUNCTION notify_owner_of_review();
CREATE TRIGGER block_demo_owner_notification_delivery BEFORE INSERT OR UPDATE ON public.owner_notifications FOR EACH ROW EXECUTE FUNCTION private.block_demo_owner_notification_delivery();
CREATE TRIGGER ao_unlock_on_task_complete AFTER UPDATE OF status ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION private.ao_task_completed();
CREATE TRIGGER owner_business_decision_completion_guard BEFORE INSERT OR UPDATE OF status ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION owner_business_decision_guard();
CREATE TRIGGER owner_request_messages_append_only BEFORE DELETE OR UPDATE ON public.owner_request_messages FOR EACH ROW EXECUTE FUNCTION private.block_owner_message_mutation();
REVOKE ALL ON FUNCTION private.owner_current_property_for_actor(uuid, uuid, uuid) FROM PUBLIC;
GRANT SELECT ON public.ao_home_plan_cards, public.ao_contributions TO authenticated;
ALTER TABLE public.ao_home_plan_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ao_plan_read ON public.ao_home_plan_cards FOR SELECT TO authenticated
  USING (is_internal_staff(auth.uid()) OR private.owner_current_property_for_actor(auth.uid(), property_id, program_id));
CREATE POLICY ao_contrib_read ON public.ao_contributions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_onboarding_director(auth.uid()) OR is_director(auth.uid()) OR private.owner_current_property_for_actor(auth.uid(), property_id, program_id));
`;

let db: PGlite;
const as = async (uid: string | null) => db.query(`SELECT set_config('test.uid', $1, false)`, [uid ?? ""]);
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!;
const n = async (sql: string, p: unknown[] = []) => (await one<{ n: number }>(sql, p)).n;
const central = (dayOffset: number, hhmm: string) =>
  `(((now() AT TIME ZONE 'America/Chicago')::date + ${dayOffset}) + time '${hhmm}') AT TIME ZONE 'America/Chicago'`;
const fingerprint = async () => (await one<{ h: string }>(`SELECT md5(
  coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM public.ao_home_plan_cards t),'') ||
  coalesce((SELECT string_agg(t::text,'|' ORDER BY property_id) FROM public.ao_home_plan_settings t),'') ||
  coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM public.owner_reviews t),'') ||
  coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM public.owner_notifications t),'') ||
  coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_tasks t),'')) h`)).h;
const card = (code: string, o: { stage?: string; lock?: string; links?: string[] } = {}) =>
  db.query(`INSERT INTO public.ao_library_cards(code, title, lane, stage_window, status, lock_rule, linked_template_task_ids, deadline_business_days, why_text)
    VALUES ($1, 'Card ' || $1, 'critical', $2, 'released', $3, $4::uuid[], 3, 'Why')`,
    [code, o.stage ?? "anytime", o.lock ?? "none", `{${o.links?.join(",") ?? ""}}`]);
const task = (id: string, home: string, step: string | null, status = "open", extra: Record<string, unknown> = {}) =>
  db.query(`INSERT INTO public.onboarding_tasks(id, property_id, title, template_task_id, status, assigned_to, completed_at, completed_by, owner_dependency, requires_owner_approval)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, home, (extra.title as string) ?? `Task ${id.slice(-3)}`, step, status, extra.assigned === undefined ? pm : extra.assigned,
     status === "complete" ? new Date().toISOString() : null, status === "complete" ? pm : null,
     extra.dependency ?? null, extra.approval ?? false]);
const outcomes = async (home: string) =>
  (await db.query<{ join_outcome: string; c: number }>(
    "SELECT join_outcome, count(*)::int c FROM public.ao_home_plan_cards WHERE property_id=$1 GROUP BY 1", [home])).rows
    .reduce<Record<string, number>>((m, r) => ({ ...m, [r.join_outcome]: r.c }), {});
const pc_ = (home: string, code: string) => one<{ join_outcome: string; unlocked_at: string | null; deadline_at: string | null; owner_review_id: string | null; covered_reason: string | null }>(
  "SELECT pc.* FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id WHERE pc.property_id=$1 AND c.code=$2", [home, code]);

describe("Active Owner fix, staged SQL on an isolated database", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(read("src/lib/__tests__/fixtures/active-owner-fix-schema.sql"));
    await db.exec(AFTER_SCHEMA);
    for (const f of LIVE) await db.exec(live(f));
    await db.exec(TRIGGERS);
    await db.exec(`
      INSERT INTO public.staff VALUES ('${ADMIN}', true, false), ('${dirOnb}', false, true), ('${pc}', false, false), ('${pm}', false, false);
      INSERT INTO public.profiles(id, full_name) VALUES ('${owner1}', 'Pat Owner'), ('${owner2}', 'Sam Owner');
      INSERT INTO public.property_owners(id, active, source_owner_id) VALUES ('${or1}', true, 'o1'), ('${or2}', true, 'o2');
      INSERT INTO public.properties(id, name, owner_record_id) VALUES ('${h1}','1 First St','${or1}'),('${h2}','2 Second St','${or1}'),
        ('${h3}','3 Third St','${or2}'),('${h4}','4 Fourth St','${or1}'),('${h5}','5 Fifth St','${or1}');
      INSERT INTO public.owner_programs(id, property_id, owner_user_id, status, owner_record_id, notify_email) VALUES
        ('${prog1}','${h1}','${owner1}','active','${or1}', true), ('${prog2}','${h3}','${owner2}','active','${or2}', false);
      INSERT INTO private.members VALUES ('${prog1}','${owner1}',null),('${prog2}','${owner2}',null);
      INSERT INTO public.owner_program_properties(program_id, property_id) VALUES
        ('${prog1}','${h1}'),('${prog1}','${h2}'),('${prog1}','${h4}'),('${prog2}','${h3}'),('${prog2}','${h4}');
      INSERT INTO public.onboarding_projects(property_id, handoff_state) VALUES
        ('${h1}','in_progress'),('${h2}','in_progress'),('${h3}','accepted'),('${h4}','in_progress'),('${h5}','in_progress');`);
    for (let i = 1; i <= 26; i++) await card(`O${String(i).padStart(2, "0")}`);
    await card("L01", { lock: "until_linked_step_done", links: [stepA] });
    await card("D01", { links: [stepB] });
    await card("D02", { links: [stepB] });
    await card("C01", { links: [stepC] });
    for (const code of ["A33", "N10", "A35", "A14", "A56"]) await card(code, { stage: "operations", lock: "until_linked_step_done" });
    for (const home of [h1, h2, h3, h4, h5]) {
      const b = home.slice(-2);
      await task(U(100 + Number(b) * 10 + 1), home, stepA);
      await task(U(100 + Number(b) * 10 + 2), home, stepB);
      await task(U(100 + Number(b) * 10 + 3), home, stepC, "complete");
      await task(U(100 + Number(b) * 10 + 4), home, stepOps);
    }
    await db.exec(read(`${DIR}/02_engine.sql`));
  });
  afterAll(async () => db?.close());

  it("Fix 1: before the grant the plan cards read is refused; after it staff see all and owners only their own homes", async () => {
    await as(ADMIN);
    await db.query("SELECT public.ao_set_home_automation($1, true)", [h1]);
    await db.query("SELECT public.ao_set_home_automation($1, true)", [h3]);
    const readAs = async (uid: string) => {
      await as(uid);
      await db.exec("SET ROLE authenticated");
      try { return (await one<{ c: number }>("SELECT count(*)::int c FROM public.ao_home_plan_cards")).c; }
      finally { await db.exec("RESET ROLE"); }
    };
    await expect(readAs(owner1)).rejects.toThrow(/permission denied for function owner_current_property_for_actor/);
    await db.exec(read(`${DIR}/01_fix1_plan_cards_read.sql`));
    const total = await n("SELECT count(*)::int n FROM public.ao_home_plan_cards");
    expect(total).toBeGreaterThan(0);
    for (const staffer of [ADMIN, dirOnb, pc]) expect(await readAs(staffer)).toBe(total);
    expect(await readAs(owner1)).toBe(await n("SELECT count(*)::int n FROM public.ao_home_plan_cards WHERE program_id=$1", [prog1]));
    expect(await readAs(owner2)).toBe(await n("SELECT count(*)::int n FROM public.ao_home_plan_cards WHERE program_id=$1", [prog2]));
    expect(await readAs(U(99))).toBe(0);
    await as(owner1); await db.exec("SET ROLE authenticated");
    await db.query("SELECT count(*) FROM public.ao_contributions"); // no longer refused
    await db.exec("RESET ROLE");
    await db.exec(read(`${DIR}/01_fix1_plan_cards_read.undo.sql`));
    await expect(readAs(owner1)).rejects.toThrow(/permission denied/);
    await db.exec(read(`${DIR}/01_fix1_plan_cards_read.sql`));
  });

  it("Fix 2 and 5: duplicate Task cards are covered on turn on, finished linked Tasks are covered, a handed off home gets operations cards only", async () => {
    expect(await outcomes(h1)).toEqual({ open: 27, locked: 6, already_covered: 2 });
    expect((await pc_(h1, "D02")).covered_reason).toBe("same_task_other_card");
    expect((await pc_(h1, "C01")).covered_reason).toBe("linked_task_done");
    const ops = await outcomes(h3);
    expect(ops.open ?? 0).toBe(0);
    expect(ops.skipped_passed).toBe(30); // every anytime card
    expect(ops.locked).toBe(5); // operations cards only
  });

  it("Fix 2: a second home gets its own plan with the preview counts, a home in two programs is refused", async () => {
    await as(ADMIN);
    const preview = (await one<{ p: { ready: boolean; outcomes: Record<string, number> } }>(
      "SELECT public.ao_preview_home_automation($1) p", [h2])).p;
    expect(preview.ready).toBe(true);
    const on = (await one<{ r: { outcomes: Record<string, number> } }>("SELECT public.ao_set_home_automation($1, true) r", [h2])).r;
    expect(on.outcomes).toEqual(preview.outcomes);
    expect(await outcomes(h2)).toEqual(preview.outcomes);
    expect(await n("SELECT count(DISTINCT program_id)::int n FROM public.ao_home_plan_cards WHERE property_id=$1", [h2])).toBe(1);
    const p4 = (await one<{ p: { ready: boolean; reason: string } }>("SELECT public.ao_preview_home_automation($1) p", [h4])).p;
    expect(p4).toEqual({ ready: false, reason: "This home is in more than one homeowner program. Ask an Admin to fix it first." });
    await expect(db.query("SELECT public.ao_set_home_automation($1, true)", [h4])).rejects.toThrow(/more than one homeowner program/);
    await as(pc);
    await expect(db.query("SELECT public.ao_set_home_automation($1, true)", [h2])).rejects.toThrow();
  });

  it("Fix 3: 27 open cards queue one plan is ready email, not 27; notify_email off sends nothing", async () => {
    const rows = (await db.query<{ kind: string; email_status: string; title: string; body: string }>(
      "SELECT kind, email_status, title, body FROM public.owner_notifications WHERE program_id=$1", [prog1])).rows;
    expect(rows).toEqual([{ kind: "ao_plan_ready", email_status: "held", title: "Your homeowner plan is ready",
      body: "We added 54 activities to your portal for 1 First St and 2 Second St. Open your portal to see what's next." }]);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE program_id=$1 AND email_status <> 'skipped'", [prog2])).toBe(0);
    const run = (await one<{ r: Record<string, number> }>(`SELECT public.ao_owner_email_run(${central(0, "08:00")}) r`)).r;
    expect(run).toEqual({ plan_ready_sent: 1, plan_ready_waiting: 0, daily_sent: 0 });
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE email_status='pending'")).toBe(1);
  });

  it("Fix 3: unlocks and reminders show at once, then become one 9 AM email, never two in a day", async () => {
    await db.query("UPDATE public.onboarding_tasks SET status='complete', completed_by=$2 WHERE id=$1", [U(100 + 11 * 10 + 1), pm]);
    expect((await pc_(h1, "L01")).unlocked_at).not.toBeNull();
    const rem = (await one<{ t: string }>("SELECT min(reminder_at)::text t FROM public.ao_home_plan_cards WHERE property_id=$1 AND reminder_at IS NOT NULL", [h1])).t;
    await db.query("SELECT public.ao_process_clocks($1::timestamptz + interval '1 minute')", [rem]);
    const held = await n("SELECT count(*)::int n FROM public.owner_notifications WHERE program_id=$1 AND email_status='held'", [prog1]);
    expect(held).toBeGreaterThan(1);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE program_id=$1 AND kind='review_ready' AND email_status='pending'", [prog1])).toBe(0);
    // Same day as the plan is ready email: the cap holds everything.
    expect((await one<{ r: Record<string, number> }>(`SELECT public.ao_owner_email_run(${central(0, "09:05")}) r`)).r.daily_sent).toBe(0);
    expect((await one<{ r: Record<string, number> }>(`SELECT public.ao_owner_email_run(${central(1, "08:55")}) r`)).r.daily_sent).toBe(0);
    expect((await one<{ r: Record<string, number> }>(`SELECT public.ao_owner_email_run(${central(1, "09:00")}) r`)).r.daily_sent).toBe(1);
    expect((await one<{ r: Record<string, number> }>(`SELECT public.ao_owner_email_run(${central(1, "09:10")}) r`)).r.daily_sent).toBe(0);
    const daily = await one<{ title: string; body: string; email_status: string }>("SELECT * FROM public.owner_notifications WHERE kind='ao_daily'");
    expect(daily.title).toBe("Your homeowner plan today");
    expect(daily.email_status).toBe("pending");
    expect(daily.body).toContain("1 First St\n- ");
    expect(daily.body).not.toMatch(/hour|invest|pay/i);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE email_status='held'")).toBe(0);
    expect(await n("SELECT count(*)::int n FROM public.ao_daily_email_items")).toBe(held);
  });

  it("Fix 3: the daily time is a setting only an Admin changes", async () => {
    await as(pc);
    await expect(db.query("SELECT public.set_owner_digest_time('10:00')")).rejects.toThrow(/Only an Admin/);
    await as(ADMIN);
    expect((await one<{ t: string }>("SELECT public.set_owner_digest_time('10:00') t")).t).toBe("10:00");
    expect(await n("SELECT count(*)::int n FROM public.audit_log WHERE entity_label='owner_digest_time'")).toBe(1);
    await db.query("SELECT public.set_owner_digest_time('09:00')");
  });

  it("Fix 4: the Active Owner label follows enrollment and cannot be changed by hand", async () => {
    await db.exec(read(`${DIR}/04_active_owner_label.sql`));
    const labelled = async (home: string) =>
      n(`SELECT count(*)::int n FROM public.property_label_assignments a JOIN public.property_labels l ON l.id=a.label_id
         WHERE l.system_key='active_owner' AND a.property_id=$1 AND a.removed_at IS NULL`, [home]);
    for (const home of [h1, h2, h3, h4]) expect(await labelled(home)).toBe(1);
    expect(await labelled(h5)).toBe(0);
    // New enrollment: plan starts by itself and the label is added.
    await as(ADMIN);
    const before = await n("SELECT count(*)::int n FROM public.owner_notifications WHERE kind='ao_plan_ready'");
    await db.query("INSERT INTO public.owner_program_properties(program_id, property_id) VALUES ($1,$2)", [prog1, h5]);
    expect(await labelled(h5)).toBe(1);
    expect((await one<{ automated: boolean }>("SELECT automated FROM public.ao_home_plan_settings WHERE property_id=$1", [h5])).automated).toBe(true);
    expect((await outcomes(h5)).open).toBe(27);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE kind='ao_plan_ready'")).toBe(before + 1);
    // Leaving the program removes the label (who and when recorded); cards stay.
    await db.query("UPDATE public.owner_program_properties SET inclusion_status='excluded' WHERE program_id=$1 AND property_id=$2", [prog1, h5]);
    expect(await labelled(h5)).toBe(0);
    expect(await n("SELECT count(*)::int n FROM public.property_label_events WHERE property_id=$1 AND action='removed' AND actor_id=$2", [h5, ADMIN])).toBe(1);
    expect((await outcomes(h5)).open).toBe(27);
    await expect(db.query(`UPDATE public.property_label_assignments SET removed_at=now() WHERE property_id=$1 AND removed_at IS NULL
      AND label_id=(SELECT id FROM public.property_labels WHERE system_key='active_owner')`, [h1])).rejects.toThrow(/cannot be added or removed by hand/);
    await expect(db.query("UPDATE public.property_labels SET name='Owner' WHERE system_key='active_owner'")).rejects.toThrow(/cannot be renamed/);
  });

  it("Fix 4: Start plans for enrolled homes previews without writing, blocks on a problem home, then starts all or none", async () => {
    await as(pc);
    await expect(db.query("SELECT public.ao_preview_enrolled_homes()")).rejects.toThrow(/Only an Admin/);
    await as(ADMIN);
    const fp = await fingerprint();
    const p = (await one<{ p: { homes: { home: string; reason: string | null }[]; blocked: boolean; token: string } }>("SELECT public.ao_preview_enrolled_homes() p")).p;
    expect(await fingerprint()).toBe(fp);
    expect(p.homes.map((h) => [h.home, h.reason])).toEqual([["4 Fourth St", "This home is in more than one homeowner program. Ask an Admin to fix it first."]]);
    expect(p.blocked).toBe(true);
    await expect(db.query("SELECT public.ao_start_enrolled_homes($1)", [p.token])).rejects.toThrow(/cannot start/);
    expect(await fingerprint()).toBe(fp);
    await db.query("UPDATE public.owner_program_properties SET archived_at=now() WHERE program_id=$1 AND property_id=$2", [prog2, h4]);
    expect(await n("SELECT count(*)::int n FROM public.ao_home_plan_settings WHERE property_id=$1", [h4])).toBe(0); // never on its own
    const q = (await one<{ p: { homes: { open: number; locked: number; already_covered: number; skipped: number }[]; blocked: boolean; token: string } }>("SELECT public.ao_preview_enrolled_homes() p")).p;
    expect(q.blocked).toBe(false);
    expect(q.homes[0]).toMatchObject({ open: 27, locked: 6, already_covered: 2, skipped: 0 });
    await expect(db.query("SELECT public.ao_start_enrolled_homes('stale')")).rejects.toThrow(/Preview again/);
    expect((await one<{ r: { started: number } }>("SELECT public.ao_start_enrolled_homes($1) r", [q.token])).r.started).toBe(1);
    expect(await outcomes(h4)).toEqual({ open: 27, locked: 6, already_covered: 2 });
  });

  it("Fix 6: accepting a handoff opens A33 and N10, keeps onboarding cards open with their deadlines, A35 and A14 unchanged", async () => {
    const o01 = await pc_(h1, "O01");
    await db.query("UPDATE public.onboarding_projects SET handoff_state='accepted' WHERE property_id=$1", [h1]);
    for (const code of ["A33", "N10"]) {
      const c = await pc_(h1, code);
      expect(c.unlocked_at).not.toBeNull();
      expect((await one<{ status: string }>("SELECT status FROM public.owner_reviews WHERE id=$1", [c.owner_review_id])).status).toBe("awaiting_owner");
    }
    for (const code of ["A35", "A14"]) expect((await pc_(h1, code)).unlocked_at).toBeNull();
    const after = await pc_(h1, "O01");
    expect(String(after.deadline_at)).toBe(String(o01.deadline_at));
    expect((await one<{ status: string }>("SELECT status FROM public.owner_reviews WHERE id=$1", [after.owner_review_id])).status).toBe("awaiting_owner");
    const live = await one<{ title: string; email_status: string }>("SELECT * FROM public.owner_notifications WHERE kind='ao_home_live'");
    expect(live.title).toBe("Your home is live: new activities are in your portal.");
    // The owner already had an Active Owner email today, so this one waits for the next daily email.
    expect(["pending", "held"]).toContain(live.email_status);
    expect(await n("SELECT count(*)::int n FROM public.ao_owner_email_days WHERE owner_key=$1 AND day=(now() AT TIME ZONE 'America/Chicago')::date", [owner1])).toBe(1);
  });

  it("Fix 6: A56 is retired, kept, with history", async () => {
    await as(null);
    await db.exec(read(`${DIR}/03_retire_a56.sql`));
    const c = await one<{ status: string; retired_at: string | null }>("SELECT * FROM public.ao_library_cards WHERE code='A56'");
    expect(c.status).toBe("retired");
    expect(await n("SELECT count(*)::int n FROM public.ao_library_card_history h JOIN public.ao_library_cards c ON c.id=h.card_id WHERE c.code='A56' AND h.changed_by=$1", [ADMIN])).toBe(1);
    await db.exec(read(`${DIR}/03_retire_a56.sql`)); // a repeat changes nothing
    expect(await n("SELECT count(*)::int n FROM public.ao_library_card_history h JOIN public.ao_library_cards c ON c.id=h.card_id WHERE c.code='A56'")).toBe(1);
  });

  it("Fix 7: sending to the owner completes the Task; the owner and the PM talk it through in the same item", async () => {
    const sendTask = U(901);
    await task(sendTask, h1, stepSend, "open", { dependency: "business_decision", approval: true, title: "Share the design" });
    await expect(db.query("UPDATE public.onboarding_tasks SET status='complete' WHERE id=$1", [sendTask])).rejects.toThrow(/homeowner decision is required/);
    await as(pc);
    await expect(db.query("SELECT public.send_task_to_owner_item($1, 'Please review the design PDF')", [sendTask])).rejects.toThrow(/Only the person on this task/);
    await as(pm);
    const sent = (await one<{ r: { sent: boolean; review_id: string; completed: boolean } }>(
      "SELECT public.send_task_to_owner_item($1, 'Please review the design PDF', (now() AT TIME ZONE 'America/Chicago')::date + 3) r", [sendTask])).r;
    expect(sent.sent && sent.completed).toBe(true);
    const t = await one<{ status: string; completed_by: string; evidence_note: string }>("SELECT * FROM public.onboarding_tasks WHERE id=$1", [sendTask]);
    expect(t).toMatchObject({ status: "complete", completed_by: pm, evidence_note: "Sent to the homeowner in their portal: Please review the design PDF" });
    const rid = sent.review_id;
    // The owner writes back (a real owner account, not View as).
    await as(owner2);
    await expect(db.query("SELECT public.owner_item_reply($1, 'Hi')", [rid])).rejects.toThrow(/not available/);
    await as(owner1);
    await db.query("SELECT public.owner_item_reply($1, 'Love it, can the sofa be blue?')", [rid]);
    const note = await one<{ user_id: string; email_status: string; title: string }>("SELECT * FROM public.staff_notifications WHERE kind='owner_item_message'");
    expect(note).toMatchObject({ user_id: pm, email_status: "pending", title: "The homeowner wrote back: Share the design" });
    await as(pm);
    expect((await db.query<{ why: string }>("SELECT * FROM public.my_owner_item_needs()")).rows.map((r) => r.why)).toEqual(["The homeowner wrote back"]);
    await db.query("SELECT public.manage_owner_review_conversation($1, 'reply', 'Yes, blue works.')", [rid]);
    await as(owner1);
    expect((await db.query<{ author_type: string; body: string }>("SELECT author_type, body FROM public.owner_item_thread($1)", [rid])).rows)
      .toEqual([{ author_type: "homeowner", body: "Love it, can the sofa be blue?" }, { author_type: "staff", body: "Yes, blue works." }]);
    const detail = (await one<{ d: { conversation: boolean; open: boolean; messages: { author_name: string }[] } }>("SELECT public.owner_item_detail($1) d", [rid])).d;
    expect(detail.conversation && detail.open).toBe(true);
    expect(detail.messages.map((m) => m.author_name)).toEqual(["Pat Owner", "ARHA team"]);
    await as(pm);
    expect((await db.query("SELECT * FROM public.my_owner_item_needs()")).rows).toHaveLength(0);
    await db.query("SELECT public.manage_owner_review_conversation($1, 'resolve')", [rid]);
    const closed = await one<{ status: string; closed_at: string | null }>("SELECT * FROM public.owner_reviews WHERE id=$1", [rid]);
    expect(closed.status).toBe("closed");
    expect(closed.closed_at).not.toBeNull();
    expect(await n("SELECT count(*)::int n FROM public.audit_log WHERE action='owner_item_resolved' AND actor_id=$1", [pm])).toBe(1);
    await as(owner1);
    await db.query("SELECT public.owner_item_reply($1, 'One more thing')", [rid]);
    expect((await one<{ status: string }>("SELECT status FROM public.owner_reviews WHERE id=$1", [rid])).status).toBe("awaiting_owner");
    expect(await n("SELECT count(*)::int n FROM public.staff_notifications WHERE kind='owner_item_message'")).toBe(2);
    expect(await n("SELECT count(*)::int n FROM public.owner_request_messages WHERE review_id=$1 AND event='reopened'", [rid])).toBe(1);
  });

  it("Fix 7: no assignee tells the Director of Onboarding; no answer by the deadline gives one follow up", async () => {
    const t2 = U(902);
    await task(t2, h1, stepNone, "open", { assigned: null, title: "Share the estimate" });
    await as(dirOnb);
    const rid = (await one<{ r: { review_id: string } }>("SELECT public.send_task_to_owner_item($1, 'Please look at the estimate') r", [t2])).r.review_id;
    await as(owner1);
    await db.query("SELECT public.owner_item_reply($1, 'Looks fine')", [rid]);
    expect((await one<{ user_id: string }>("SELECT user_id FROM public.staff_notifications WHERE entity_id=$1", [rid])).user_id).toBe(dirOnb);
    const t3 = U(903);
    await task(t3, h1, null, "open", { title: "Share the paint colors" });
    await as(pm);
    const r3 = (await one<{ r: { review_id: string } }>("SELECT public.send_task_to_owner_item($1, 'Pick a paint color') r", [t3])).r.review_id;
    await db.query("UPDATE public.owner_reviews SET respond_by = (now() AT TIME ZONE 'America/Chicago')::date - 1 WHERE id=$1", [r3]);
    const needs = (await db.query<{ review_id: string; why: string }>("SELECT * FROM public.my_owner_item_needs()")).rows.filter((r) => r.review_id === r3);
    expect(needs.map((r) => r.why)).toEqual(["No answer from the homeowner yet"]);
  });

  it("adds no anon executable function and keeps the switch signature", async () => {
    const anon = await n(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
      WHERE ns.nspname IN ('public','private') AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname IN ('ao_owner_email_run','ao_preview_enrolled_homes','ao_start_enrolled_homes','send_task_to_owner_item','owner_item_reply','owner_item_thread','my_owner_item_needs','set_owner_digest_time')`);
    expect(anon).toBe(0);
    expect((await one<{ ok: boolean }>("SELECT has_function_privilege('authenticated','public.ao_owner_email_run(timestamptz)','EXECUTE') ok")).ok).toBe(false);
  });
  it("the undo files put the switch, preview and decision rule back exactly and remove everything new", async () => {
    const def = async (f: string) => (await one<{ d: string }>(`SELECT pg_get_functiondef('${f}'::regprocedure) d`)).d;
    await as(null);
    await db.exec(read(`${DIR}/04_active_owner_label.undo.sql`));
    await db.exec(read(`${DIR}/03_retire_a56.undo.sql`));
    await db.exec(read(`${DIR}/02_engine.undo.sql`));
    await db.exec(read(`${DIR}/01_fix1_plan_cards_read.undo.sql`));
    const strip = (t: string) => t.replace(/;\s*$/, "").trim();
    expect(strip(await def("public.ao_set_home_automation(uuid,boolean,uuid[])"))).toBe(strip(live("ao_set_home_automation")));
    expect(strip(await def("public.ao_preview_home_automation(uuid,uuid[])"))).toBe(strip(live("ao_preview_home_automation")));
    expect(strip(await def("public.owner_business_decision_guard()"))).toBe(strip(live("owner_business_decision_guard")));
    expect(await n(`SELECT count(*)::int n FROM pg_proc WHERE proname IN ('ao_home_program','ao_plan_outcomes','ao_owner_email_run','send_task_to_owner_item','owner_item_reply','ao_label_sync')`)).toBe(0);
    expect(await n(`SELECT count(*)::int n FROM pg_class WHERE relname IN ('ao_owner_email_days','ao_plan_ready_notices','ao_daily_email_items','owner_item_task_sends')`)).toBe(0);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE email_status='held'")).toBe(0);
    expect((await one<{ status: string }>("SELECT status FROM public.ao_library_cards WHERE code='A56'")).status).toBe("released");
  });
});
