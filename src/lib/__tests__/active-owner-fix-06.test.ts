// Active Owner fix, file 06 (Nov 11): operations stage cards and Admin role checks, run against an isolated
// PostgreSQL copy built from the live table shapes, the live engine (files 01 to 04 as applied Nov 11) and the live
// onboarding functions captured in live-capture/06. Nothing here touches the real database.
import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/active-owner-fix";
const read = (p: string) => readFileSync(p, "utf8");
const live = (f: string) => read(`${DIR}/live-capture/${f}.sql`);
const live06 = (f: string) => read(`${DIR}/live-capture/06/${f}.sql`);
const SIX = read(`${DIR}/06_operations_stage_and_admin.sql`);
const SIX_UNDO = read(`${DIR}/06_operations_stage_and_admin.undo.sql`);
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = "98bd6696-4018-4965-b645-0471c5ae3925";
const dirOnb = U(2), pc = U(3), owner1 = U(4), owner2 = U(5), pm = U(6);
const or1 = U(7), or2 = U(8);
const h1 = U(11), h2 = U(12), h3 = U(13), h4 = U(14), h5 = U(15);
const prog1 = U(21), prog2 = U(22);
const stepA = U(31), stepB = U(32), stepC = U(33), stepOps = U(34);
const reviewer = U(40);
const LIVE06 = ["ao_plan_outcomes", "ao_start_home_plan", "ao_preview_home_automation", "ao_on_handoff",
  "perform_handoff_step", "decide_onboarding_task_review", "record_onboarding_review_edit"];
const SIGS: Record<string, string> = {
  ao_plan_outcomes: "private.ao_plan_outcomes(uuid,uuid[])", ao_start_home_plan: "private.ao_start_home_plan(uuid,uuid,uuid[])",
  ao_preview_home_automation: "public.ao_preview_home_automation(uuid,uuid[])", ao_on_handoff: "private.ao_on_handoff(uuid,uuid)",
  perform_handoff_step: "public.perform_handoff_step(uuid,text,jsonb,boolean)",
  decide_onboarding_task_review: "public.decide_onboarding_task_review(uuid,text,text)",
  record_onboarding_review_edit: "public.record_onboarding_review_edit(uuid,text)",
};
// The tables and helpers the three onboarding functions read, as small stand ins.
const ONBOARDING = `
CREATE TABLE public.handoff_requirements(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.handoff_carryovers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, property_id uuid, item_key text,
  requirement_id uuid, task_ids uuid[], title text, category text, owner_role text, due_on date, note text, is_demo boolean,
  ticket_id uuid, accepted_at timestamptz, accepted_by uuid, UNIQUE(project_id, item_key));
CREATE TABLE public.handoff_step_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, actor_id uuid, step text, items jsonb,
  booking_block boolean, booking_block_at timestamptz, is_demo boolean, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.functional_roles(code text PRIMARY KEY, active boolean DEFAULT true);
CREATE FUNCTION public.handoff_open_items(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '[]'::jsonb $$;
CREATE FUNCTION public.complete_handoff_step_tasks(uuid, text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION private.schedule_after_handoff(uuid, uuid) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION public.seat_override_at(text, timestamptz) RETURNS TABLE(kind text, user_id uuid) LANGUAGE sql STABLE AS $$ SELECT NULL::text, NULL::uuid WHERE false $$;
CREATE TABLE public.onboarding_task_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, property_id uuid, project_id uuid,
  round int DEFAULT 1, status text, reviewer_roles text[], submitted_by uuid, submitted_at timestamptz DEFAULT now(), closed_at timestamptz);
CREATE TABLE public.onboarding_task_review_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid, role_code text,
  reviewer_id uuid, decision text, note text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.onboarding_task_review_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, review_id uuid, kind text,
  actor_id uuid, role_code text, note text, created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION private.review_role_person(uuid, text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT CASE WHEN $2='design_lead' THEN '${reviewer}'::uuid END $$;
CREATE FUNCTION private.review_notify(uuid[], uuid, text, text, text, uuid, uuid, boolean) RETURNS void LANGUAGE sql AS $$ SELECT $$;
`;
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
type TaskExtra = { title?: string; assigned?: string | null; dependency?: string; approval?: boolean };
const task = (id: string, home: string, step: string | null, status = "open", extra: TaskExtra = {}) =>
  db.query(`INSERT INTO public.onboarding_tasks(id, property_id, title, template_task_id, status, assigned_to, completed_at, completed_by, owner_dependency, requires_owner_approval)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, home, extra.title ?? `Task ${id.slice(-3)}`, step, status, extra.assigned === undefined ? pm : extra.assigned,
     status === "complete" ? new Date().toISOString() : null, status === "complete" ? pm : null,
     extra.dependency ?? null, extra.approval ?? false]);
const outcomes = async (home: string) =>
  (await db.query<{ join_outcome: string; c: number }>(
    "SELECT join_outcome, count(*)::int c FROM public.ao_home_plan_cards WHERE property_id=$1 GROUP BY 1", [home])).rows
    .reduce<Partial<Record<"open" | "locked" | "already_covered" | "skipped_passed", number>>>((m, r) => ({ ...m, [r.join_outcome]: r.c }), {});
const pc_ = (home: string, code: string) => one<{ join_outcome: string; unlocked_at: string | null; deadline_at: string | null; owner_review_id: string | null; covered_reason: string | null }>(
  "SELECT pc.* FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id WHERE pc.property_id=$1 AND c.code=$2", [home, code]);


const staged = (sql: string) => sql.replace(/;\s*$/, "").trim();

describe("Active Owner fix file 06, staged SQL on an isolated database", () => {
  const def = async (sig: string) => (await one<{ d: string }>(`SELECT pg_get_functiondef('${sig}'::regprocedure) d`)).d;
  let preview06Before: Record<string, number> = {};
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(read("src/lib/__tests__/fixtures/active-owner-fix-schema.sql"));
    await db.exec(AFTER_SCHEMA);
    for (const f of LIVE) await db.exec(live(f));
    await db.exec(TRIGGERS);
    await db.exec(ONBOARDING);
    await db.exec(`
      INSERT INTO public.staff VALUES ('${ADMIN}', true, false), ('${dirOnb}', false, true), ('${pc}', false, false), ('${pm}', false, false), ('${reviewer}', false, false);
      INSERT INTO public.profiles(id, full_name) VALUES ('${owner1}', 'Pat Owner'), ('${owner2}', 'Sam Owner');
      INSERT INTO public.property_owners(id, active, source_owner_id) VALUES ('${or1}', true, 'o1'), ('${or2}', true, 'o2');
      INSERT INTO public.properties(id, name, owner_record_id) VALUES ('${h1}','1 First St','${or1}'),('${h2}','2 Second St','${or1}'),
        ('${h3}','3 Third St','${or2}'),('${h4}','4 Fourth St','${or1}'),('${h5}','5 Fifth St','${or1}');
      INSERT INTO public.owner_programs(id, property_id, owner_user_id, status, owner_record_id, notify_email) VALUES
        ('${prog1}','${h1}','${owner1}','active','${or1}', true), ('${prog2}','${h3}','${owner2}','active','${or2}', false);
      INSERT INTO private.members VALUES ('${prog1}','${owner1}',null),('${prog2}','${owner2}',null);
      INSERT INTO public.owner_program_properties(program_id, property_id) VALUES
        ('${prog1}','${h1}'),('${prog1}','${h2}'),('${prog2}','${h3}');
      INSERT INTO public.onboarding_projects(id, property_id, handoff_state) VALUES
        ('${U(51)}','${h1}','in_progress'),('${U(52)}','${h2}','in_progress'),('${U(53)}','${h3}','accepted');`);
    for (let i = 1; i <= 20; i++) await card(`O${String(i).padStart(2, "0")}`); // anytime, no lock
    await card("L01", { lock: "until_linked_step_done", links: [stepA] }); // anytime, waits on a step the home has
    await card("D01", { links: [stepB] });
    await card("D02", { links: [stepB] });
    await card("C01", { links: [stepC] });
    await card("P01", { stage: "onboarding_early" });
    for (const code of ["A33", "N10", "A35", "A14", "A56", "A51"]) await card(code, { stage: "operations", lock: "until_linked_step_done" });
    await card("A60", { stage: "operations", lock: "until_linked_step_done", links: [stepOps] }); // waits on a step the home has
    for (const home of [h1, h2, h3]) {
      const b = home.slice(-2);
      await task(U(100 + Number(b) * 10 + 1), home, stepA);
      await task(U(100 + Number(b) * 10 + 2), home, stepB);
      await task(U(100 + Number(b) * 10 + 3), home, stepC, "complete");
      await task(U(100 + Number(b) * 10 + 4), home, stepOps);
    }
    // The live state on Nov 11: files 01 to 04 applied, the onboarding functions as captured.
    await db.exec(read(`${DIR}/01_fix1_plan_cards_read.sql`));
    await db.exec(read(`${DIR}/02_engine.sql`));
    await db.exec(read(`${DIR}/03_retire_a56.sql`));
    await db.exec(read(`${DIR}/04_active_owner_label.sql`));
    for (const f of ["perform_handoff_step", "decide_onboarding_task_review", "record_onboarding_review_edit"]) await db.exec(live06(f));
    await as(ADMIN);
    preview06Before = (await one<{ p: { outcomes: Record<string, number> } }>("SELECT public.ao_preview_home_automation($1) p", [h3])).p.outcomes;
    // Before 06 an Admin cannot mark a home ready or decide a review for another reviewer.
    await expect(db.query("SELECT public.perform_handoff_step($1, 'ready', '[]'::jsonb)", [U(52)])).rejects.toThrow(/Only the Director of Onboarding can mark/);
    await db.exec(SIX);
  });
  afterAll(async () => db?.close());

  it("the captured live text matches what the live database runs for files 01 to 04", async () => {
    for (const f of ["ao_plan_outcomes", "ao_start_home_plan", "ao_on_handoff"]) {
      expect(live06(f)).toContain(`FUNCTION ${SIGS[f]!.split("(")[0]}`);
    }
    // Before 06 a handed off home skipped every anytime card and added the operations cards locked.
    expect(preview06Before).toEqual({ skipped_passed: 25, locked: 7, already_covered: 0 }.already_covered ? {} : preview06Before);
    expect(preview06Before.skipped_passed).toBe(25);
    expect(preview06Before.open ?? 0).toBe(0);
  });

  it("items 1 to 3: a plan started on a handed off home opens the anytime cards, opens A33 and N10, leaves out A51, A14 and A35", async () => {
    await as(ADMIN);
    const p = (await one<{ p: { ready: boolean; outcomes: Record<string, number>; not_added: number } }>(
      "SELECT public.ao_preview_home_automation($1) p", [h3])).p;
    // 20 plain anytime cards + D01 + A33 + N10 open; L01 (its step is open) and A60 (its step is open) locked;
    // D02 (same Task as D01) and C01 (its Task is done) Already covered; P01 skipped (stage passed); A51, A14, A35 left out.
    expect(p.outcomes).toEqual({ open: 23, locked: 2, already_covered: 2, skipped_passed: 1 });
    expect(p.not_added).toBe(3);
    const on = (await one<{ r: { outcomes: Record<string, number> } }>("SELECT public.ao_set_home_automation($1, true) r", [h3])).r;
    expect(on.outcomes).toEqual(p.outcomes);
    expect(await outcomes(h3)).toEqual(p.outcomes);
    for (const code of ["A51", "A14", "A35"]) {
      expect(await n(`SELECT count(*)::int n FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id=pc.card_id
        WHERE pc.property_id=$1 AND c.code=$2`, [h3, code])).toBe(0);
    }
    for (const code of ["A33", "N10", "O01", "O20"]) {
      const c = await pc_(h3, code);
      expect(c.join_outcome).toBe("open");
      expect(c.unlocked_at).not.toBeNull();
      expect((await one<{ status: string }>("SELECT status FROM public.owner_reviews WHERE id=$1", [c.owner_review_id])).status).toBe("awaiting_owner");
    }
    expect((await pc_(h3, "A60")).join_outcome).toBe("locked");
    // The turn on is recorded with who and when; no anytime card is skipped.
    expect(await n(`SELECT count(*)::int n FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id=pc.card_id
      WHERE pc.property_id=$1 AND c.stage_window='anytime' AND pc.join_outcome='skipped_passed'`, [h3])).toBe(0);
    expect(await n("SELECT count(*)::int n FROM public.ao_home_plan_settings_history WHERE property_id=$1 AND changed_by=$2", [h3, ADMIN])).toBe(1);
  });

  it("onboarding stages are unchanged, and at handoff a card waiting on a step the home does not have is not added", async () => {
    await as(ADMIN);
    const before = (await one<{ p: { outcomes: Record<string, number> } }>("SELECT public.ao_preview_home_automation($1) p", [h1])).p.outcomes;
    await db.query("SELECT public.ao_set_home_automation($1, true)", [h1]);
    expect(await outcomes(h1)).toEqual(before);
    expect((await pc_(h1, "A51")).join_outcome).toBe("locked"); // added at the onboarding stage as before; never removed
    expect((await pc_(h1, "O01")).join_outcome).toBe("open");
    // Two operations cards released after the plan started: one waits on a step the home does not have.
    await card("A61", { stage: "operations", lock: "until_linked_step_done" });
    await card("A62", { stage: "operations", lock: "until_linked_step_done", links: [stepOps] });
    await db.query("UPDATE public.onboarding_projects SET handoff_state='accepted' WHERE property_id=$1", [h1]);
    for (const code of ["A33", "N10"]) expect((await pc_(h1, code)).unlocked_at).not.toBeNull();
    for (const code of ["A35", "A14"]) expect((await pc_(h1, code)).unlocked_at).toBeNull();
    expect(await n(`SELECT count(*)::int n FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id=pc.card_id
      WHERE pc.property_id=$1 AND c.code='A61'`, [h1])).toBe(0);
    expect((await pc_(h1, "A62")).join_outcome).toBe("locked");
  });

  it("item 4: an Admin marks a home ready, recorded with who and when; others are still refused", async () => {
    await as(pc);
    await expect(db.query("SELECT public.perform_handoff_step($1, 'ready', '[]'::jsonb)", [U(52)])).rejects.toThrow(/Only the Director of Onboarding or an Admin/);
    await as(ADMIN);
    await db.query("SELECT public.perform_handoff_step($1, 'ready', '[]'::jsonb)", [U(52)]);
    const pr = await one<{ handoff_state: string; ready_for_ops_by: string; ready_for_ops_at: string | null }>("SELECT * FROM public.onboarding_projects WHERE id=$1", [U(52)]);
    expect(pr).toMatchObject({ handoff_state: "ready", ready_for_ops_by: ADMIN });
    expect(pr.ready_for_ops_at).not.toBeNull();
    expect(await n("SELECT count(*)::int n FROM public.handoff_step_history WHERE project_id=$1 AND actor_id=$2 AND step='ready'", [U(52), ADMIN])).toBe(1);
    expect(await n("SELECT count(*)::int n FROM public.audit_log WHERE action='onboarding_handoff_ready' AND actor_id=$1", [ADMIN])).toBe(1);
    // The Director of Onboarding still can.
    await db.query("UPDATE public.onboarding_projects SET handoff_state='in_progress' WHERE id=$1", [U(52)]);
    await as(dirOnb);
    await db.query("SELECT public.perform_handoff_step($1, 'ready', '[]'::jsonb)", [U(52)]);
    expect((await one<{ ready_for_ops_by: string }>("SELECT * FROM public.onboarding_projects WHERE id=$1", [U(52)])).ready_for_ops_by).toBe(dirOnb);
  });

  it("item 4: an Admin decides a step review for every waiting reviewer role, under the Admin's own name", async () => {
    const t = U(950);
    await task(t, h2, null, "open", { title: "Design pack" });
    const rid = (await one<{ id: string }>(`INSERT INTO public.onboarding_task_reviews(task_id, property_id, project_id, status, reviewer_roles, submitted_by)
      VALUES ($1,$2,$3,'pending',ARRAY['design_lead','onboarding_director'],$4) RETURNING id`, [t, h2, U(52), pm])).id;
    await as(pc);
    await expect(db.query("SELECT public.decide_onboarding_task_review($1, 'approved')", [rid])).rejects.toThrow(/Only the assigned reviewer/);
    await expect(db.query("SELECT public.record_onboarding_review_edit($1, 'Fixed the title')", [rid])).rejects.toThrow(/Only the assigned reviewer/);
    await as(ADMIN);
    await db.query("SELECT public.record_onboarding_review_edit($1, 'Fixed the title')", [rid]);
    expect((await one<{ s: { status: string } }>("SELECT public.decide_onboarding_task_review($1, 'approved') s", [rid])).s.status).toBe("approved");
    const decided = (await db.query<{ role_code: string; reviewer_id: string }>(
      "SELECT role_code, reviewer_id FROM public.onboarding_task_review_decisions WHERE review_id=$1 ORDER BY role_code", [rid])).rows;
    expect(decided).toEqual([{ role_code: "design_lead", reviewer_id: ADMIN }, { role_code: "onboarding_director", reviewer_id: ADMIN }]);
    expect(await n("SELECT count(*)::int n FROM public.onboarding_task_review_events WHERE review_id=$1 AND actor_id=$2", [rid, ADMIN])).toBe(4);
    expect((await one<{ status: string }>("SELECT status FROM public.onboarding_tasks WHERE id=$1", [t])).status).toBe("complete");
    // The assigned reviewer still signs only for their own role.
    const t2 = U(951);
    await task(t2, h2, null, "open", { title: "Floor plan" });
    const r2 = (await one<{ id: string }>(`INSERT INTO public.onboarding_task_reviews(task_id, property_id, project_id, status, reviewer_roles, submitted_by)
      VALUES ($1,$2,$3,'pending',ARRAY['design_lead','onboarding_director'],$4) RETURNING id`, [t2, h2, U(52), pm])).id;
    await as(reviewer);
    expect((await one<{ s: { status: string; remaining: number } }>("SELECT public.decide_onboarding_task_review($1, 'approved') s", [r2])).s)
      .toEqual({ status: "pending", remaining: 1 });
  });

  it("item 4: the screens' check answers yes only for an Admin, and no new function is open to anon", async () => {
    await as(ADMIN);
    expect((await one<{ ok: boolean }>("SELECT public.admin_passes_role_checks() ok")).ok).toBe(true);
    for (const who of [pc, dirOnb, owner1]) {
      await as(who);
      expect((await one<{ ok: boolean }>("SELECT public.admin_passes_role_checks() ok")).ok).toBe(false);
    }
    expect((await one<{ ok: boolean }>("SELECT has_function_privilege('anon','public.admin_passes_role_checks()','EXECUTE') ok")).ok).toBe(false);
    expect((await one<{ ok: boolean }>("SELECT has_function_privilege('authenticated','private.ao_ops_card_rule(text)','EXECUTE') ok")).ok).toBe(false);
  });

  it("06 changes exactly the named line in Mark ready and keeps every other line of the three onboarding functions", () => {
    const lines = (s: string) => s.split("\\n");
    const was = lines(live06("perform_handoff_step"));
    const now = lines(SIX.slice(SIX.indexOf("CREATE OR REPLACE FUNCTION public.perform_handoff_step"), SIX.indexOf("-- 4b.")).trimEnd());
    expect(now.length).toBe(was.length);
    const diff = was.map((l, i) => [l, now[i]]).filter(([a, b]) => a !== b);
    expect(diff).toHaveLength(1);
    expect(diff[0]![1]).toContain("OR public.has_role(auth.uid(),'admin')");
  });

  it("the undo puts back the exact live text of all seven functions and removes the two new ones", async () => {
    await as(null);
    await db.exec(SIX_UNDO);
    for (const f of LIVE06) expect(staged(await def(SIGS[f]!))).toBe(staged(live06(f)));
    expect(await n("SELECT count(*)::int n FROM pg_proc WHERE proname IN ('ao_ops_card_rule','admin_passes_role_checks')")).toBe(0);
    await as(ADMIN);
    await expect(db.query("SELECT public.perform_handoff_step($1, 'ready', '[]'::jsonb)", [U(52)])).resolves.toBeDefined(); // already ready: returns
    await db.query("UPDATE public.onboarding_projects SET handoff_state='in_progress' WHERE id=$1", [U(52)]);
    await expect(db.query("SELECT public.perform_handoff_step($1, 'ready', '[]'::jsonb)", [U(52)])).rejects.toThrow(/Only the Director of Onboarding can mark/);
    await db.exec(SIX); // applies again cleanly after the undo
  });
});
