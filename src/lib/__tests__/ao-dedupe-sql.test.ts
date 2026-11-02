import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = U(1), staffer = U(2), owner = U(3);
const home = U(10), home2 = U(12), prog = U(20), prog2 = U(22);
const stepA = U(30), taskA = U(31), stepB = U(33), taskB = U(34), stepC = U(35), taskC = U(36), task2A = U(37);
const cA = U(40), cB = U(41), cMap = U(42), cTwin = U(43), cOpen = U(44);
let db: PGlite;

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true),'')::uuid $$;
CREATE TABLE public.staff(id uuid PRIMARY KEY, is_admin boolean NOT NULL DEFAULT false);
CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1 AND is_admin AND $2='admin') $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.after_handoff_plan_editor() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.has_role(auth.uid(),'admin') $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY, property_id uuid, owner_user_id uuid, status text, is_demo boolean NOT NULL DEFAULT false, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_program_properties(program_id uuid, property_id uuid, archived_at timestamptz, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid NOT NULL, property_id uuid, phase text NOT NULL DEFAULT 'onboarding', stage text NOT NULL DEFAULT 'x', title text NOT NULL, recommendation text, status text NOT NULL DEFAULT 'prepared', source_type text, owner_action_type text, onboarding_task_id uuid, template_id uuid, is_demo boolean, created_by uuid, task_type text, available_from timestamptz, respond_by date, responded_at timestamptz, closed_at timestamptz, outcome text, archived_at timestamptz, updated_at timestamptz, created_at timestamptz DEFAULT clock_timestamp());
CREATE UNIQUE INDEX owner_reviews_onboarding_task_uniq ON public.owner_reviews(onboarding_task_id) WHERE onboarding_task_id IS NOT NULL;
CREATE TABLE public.work_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, property_id uuid, source_table text, source_task_id uuid, linked_task_id uuid, library_template_id uuid, title text, status text NOT NULL DEFAULT 'open', retired_at timestamptz, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, handoff_state text DEFAULT 'in_progress', ops_accepted_at timestamptz, completed_at timestamptz, ready_for_ops_at timestamptz, planned_closing_on date, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_templates(id uuid PRIMARY KEY, name text);
CREATE TABLE public.onboarding_template_tasks(id uuid PRIMARY KEY, template_id uuid, title text);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY, property_id uuid, template_task_id uuid, status text, assigned_to uuid, completed_by uuid, archived_at timestamptz, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.owner_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid, review_id uuid);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
CREATE TABLE public.email_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.after_handoff_plan_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, source_kind text NOT NULL DEFAULT 'template', template_id uuid, library_id uuid, send_after_days int NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0, notes text, created_by uuid, created_at timestamptz DEFAULT now(), updated_by uuid, updated_at timestamptz DEFAULT now());
CREATE TABLE public.after_handoff_plan_events(id bigserial PRIMARY KEY, plan_item_id uuid, actor_id uuid, action text, old_value jsonb, new_value jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.after_handoff_schedule(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid, property_id uuid, project_id uuid, plan_item_id uuid, title text, source_kind text, template_id uuid, library_id uuid, send_on date, last_changed_by uuid, UNIQUE(property_id, plan_item_id));
CREATE TABLE public.after_handoff_schedule_events(id bigserial PRIMARY KEY, schedule_id uuid, property_id uuid, project_id uuid, actor_id uuid, action text, new_value jsonb, note text);
INSERT INTO public.onboarding_templates VALUES ('c6f0cab5-4cbc-4531-b471-780ccc051bb2','ARHA Onboarding — Full Plan'),('84f3a777-44a8-430a-af7e-8f18dc9a7dae','ARHA Onboarding - Standard');
INSERT INTO public.onboarding_template_tasks VALUES ('${stepA}','84f3a777-44a8-430a-af7e-8f18dc9a7dae','Share the estimate'),('${stepB}','84f3a777-44a8-430a-af7e-8f18dc9a7dae','Send the agreement'),('${stepC}','84f3a777-44a8-430a-af7e-8f18dc9a7dae','Hold the call');
`;

const as = async (uid: string | null) => db.query(`SELECT set_config('test.uid', $1, false)`, [uid ?? ""]);
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!;
const n = async (sql: string, p: unknown[] = []) => (await one<{ n: number }>(sql, p)).n;
const fingerprint = async () =>
  (await one<{ h: string }>(`SELECT md5(
    (SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_templates t) ||
    (SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_template_tasks t) ||
    (SELECT string_agg(t::text,'|' ORDER BY id) FROM public.onboarding_tasks t)) h`)).h;
const anonDefinerSet = async () =>
  (await one<{ s: string }>(`SELECT coalesce(string_agg(p.oid::regprocedure::text, ',' ORDER BY 1),'') s FROM pg_proc p
     JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE p.prosecdef AND ns.nspname IN ('public','private')
     AND has_function_privilege('anon', p.oid, 'EXECUTE')`)).s;
const card = (id: string, code: string, title: string, links: string[], lock = "until_linked_step_done") =>
  db.query(`INSERT INTO public.ao_library_cards(id, code, title, lane, stage_window, status, lock_rule, linked_template_task_ids, deadline_business_days, why_text)
    VALUES ($1,$2,$3,'critical','anytime','released',$4,$5::uuid[],3,'Why')`, [id, code, title, lock, `{${links.join(",")}}`]);
const plan = (prop: string, c: string) =>
  one<{ join_outcome: string; covered_reason: string | null; covered_source: string | null; covered_item_id: string | null; owner_review_id: string | null }>(
    "SELECT * FROM public.ao_home_plan_cards WHERE property_id=$1 AND card_id=$2", [prop, c]);

describe("Active Owner card de-duplication (isolated PostgreSQL)", () => {
  let fpBefore = "", anonBefore = "", liveDefs = "";
  const defs = async () => (await one<{ s: string }>(`SELECT string_agg(pg_get_functiondef(p.oid) || coalesce(p.proacl::text,''), '#' ORDER BY p.proname) s FROM pg_proc p
     WHERE p.proname IN ('ao_set_home_automation','ao_preview_home_automation','schedule_after_handoff')`)).s;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(read("docs/pending/ao-engine/01_engine_foundation.sql"));
    await db.exec(read("docs/pending/ao-engine/02_engine_rpcs.sql"));
    await db.exec(read("docs/pending/ao-engine/03_screen_reads.sql"));
    // Live versions of the three replaced functions (captured from the live database).
    for (const f of ["public.ao_preview_home_automation", "public.ao_set_home_automation", "private.schedule_after_handoff"])
      await db.exec(read(`docs/pending/ao-dedupe/live-capture/${f}.sql`) + ";");
    await db.exec(`REVOKE ALL ON FUNCTION private.schedule_after_handoff(uuid,uuid) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION private.schedule_after_handoff(uuid,uuid) TO service_role;`);
    await db.exec(`INSERT INTO public.staff VALUES ('${admin}', true), ('${staffer}', false);
      INSERT INTO public.properties VALUES ('${home}', false), ('${home2}', false);
      INSERT INTO public.owner_programs(id, property_id, owner_user_id, status) VALUES ('${prog}','${home}','${owner}','active'),('${prog2}','${home2}','${owner}','active');
      INSERT INTO public.onboarding_projects(property_id) VALUES ('${home}'),('${home2}');
      INSERT INTO public.onboarding_tasks(id, property_id, template_task_id, status) VALUES
        ('${taskA}','${home}','${stepA}','open'),('${taskB}','${home}','${stepB}','open'),('${taskC}','${home}','${stepC}','open'),
        ('${task2A}','${home2}','${stepA}','open');`);
    await card(cA, "A27", "Authorize the make-ready estimate", [stepA]);
    await card(cTwin, "A28", "Respond to invoices", [stepA]); // same Task as A27
    await card(cB, "A39", "Sign the agreement", [stepB]);
    await card(cMap, "A57", "Document the planning call", []);
    await card(cOpen, "N01", "Plan winter readiness", [], "none");
    liveDefs = await defs();
    fpBefore = await fingerprint();
    anonBefore = await anonDefinerSet();
    await db.exec(read("docs/pending/ao-dedupe/01_dedupe.sql"));
  });
  afterAll(async () => db?.close());

  it("seeds only suggestions: 24 map entries and 26 step-link suggestions, none confirmed", async () => {
    expect(await n("SELECT count(*)::int n FROM public.ao_card_item_map WHERE status='suggested'")).toBe(24);
    expect(await n("SELECT count(*)::int n FROM public.ao_card_item_map WHERE status<>'suggested'")).toBe(0);
    expect(await n("SELECT count(DISTINCT card_code)::int n FROM public.ao_card_step_link_suggestions WHERE status='suggested'")).toBe(26);
  });

  it("no anon or PUBLIC execute on new functions; anon set unchanged", async () => {
    expect(await anonDefinerSet()).toBe(anonBefore);
    const acls = (await db.query<{ acl: string | null }>(`SELECT proacl::text acl FROM pg_proc WHERE proname IN
      ('ao_title_key','ao_card_coverage','ao_live_card_match','ao_guard_owner_item','ao_confirm_one_off','ao_card_item_map_decide','ao_step_link_decide','after_handoff_plan_set_coverage')`)).rows;
    expect(acls.length).toBe(8);
    for (const { acl } of acls) {
      expect(acl).not.toBeNull();
      expect(acl!.includes("anon=")).toBe(false);
      expect(/(^|[{,])=X/.test(acl!)).toBe(false);
    }
  });

  it("preview lists covered cards and why; suggested map entries do not count", async () => {
    await as(admin);
    const mapItem = await one<{ id: string }>(`INSERT INTO public.owner_reviews(program_id, property_id, title) VALUES ($1,$2,'Owner readiness call notes') RETURNING id`, [prog, home]);
    await db.query(`INSERT INTO public.owner_reviews(program_id, property_id, title, onboarding_task_id) VALUES ($1,$2,'Agreement sent',$3)`, [prog, home, taskB]);
    let pv = await one<{ r: { covered: { code: string; reason: string }[] } }>("SELECT public.ao_preview_home_automation($1) r", [home]);
    const byCode = Object.fromEntries(pv.r.covered.map((c) => [c.code, c.reason]));
    expect(byCode["A39"]).toBe("linked_task");
    expect(byCode["A28"]).toBe("same_task_other_card");
    expect(byCode["A57"]).toBeUndefined(); // suggested only
    const m = await one<{ id: string }>("SELECT id FROM public.ao_card_item_map WHERE match_value='%readiness call%'");
    await as(staffer);
    await expect(db.query("SELECT public.ao_card_item_map_decide($1,'confirmed')", [m.id])).rejects.toThrow("Only Admin");
    await as(admin);
    await db.query("SELECT public.ao_card_item_map_decide($1,'confirmed')", [m.id]);
    pv = await one("SELECT public.ao_preview_home_automation($1) r", [home]);
    expect(pv.r.covered.find((c) => c.code === "A57")?.reason).toBe("confirmed_map");
    expect(mapItem.id).toBeTruthy();
  });

  it("switch-on marks covered cards with the reason and never fails on a Task that already has an owner item", async () => {
    await as(admin);
    const r = await one<{ r: { outcomes: Record<string, number> } }>("SELECT public.ao_set_home_automation($1,true) r", [home]);
    expect(r.r.outcomes["already_covered"]).toBe(3);
    const b = await plan(home, cB);
    expect([b.join_outcome, b.covered_reason, b.covered_source, b.owner_review_id]).toEqual(["already_covered", "linked_task", "owner_review", null]);
    expect((await plan(home, cTwin)).covered_reason).toBe("linked_task"); // A27 took the Task's slot first
    expect((await plan(home, cMap)).covered_reason).toBe("confirmed_map");
    expect((await plan(home, cA)).join_outcome).toBe("locked");
    expect((await plan(home, cOpen)).join_outcome).toBe("open");
  });

  it("a withdrawn item on the Task does not block switch-on", async () => {
    await db.query(`INSERT INTO public.owner_reviews(program_id, property_id, title, onboarding_task_id, archived_at) VALUES ($1,$2,'Old',$3,now())`, [prog2, home2, task2A]);
    await as(admin);
    await db.query("SELECT public.ao_set_home_automation($1,true)", [home2]);
    const a = await plan(home2, cA);
    expect(a.join_outcome).toBe("locked");
    expect((await one<{ t: string | null }>("SELECT onboarding_task_id t FROM public.owner_reviews WHERE id=$1", [a.owner_review_id])).t).toBeNull();
  });

  it("guards every send path: Task item, Operations item and release item point at the card", async () => {
    await as(staffer);
    await expect(db.query(`INSERT INTO public.owner_reviews(program_id, property_id, title, onboarding_task_id) VALUES ($1,$2,'Estimate',$3)`, [prog, home, taskA]))
      .rejects.toThrow('already has "Authorize the make-ready estimate" on its Active Owner plan');
    await expect(db.query(`INSERT INTO public.work_items(kind, property_id, source_table, source_task_id, title) VALUES ('opportunity',$1,'onboarding_tasks',$2,'Estimate')`, [home, taskA]))
      .rejects.toThrow("already has");
    await expect(db.query(`INSERT INTO public.owner_reviews(program_id, property_id, title) VALUES ($1,$2,'Readiness call follow up')`, [prog, home]))
      .rejects.toThrow('"Document the planning call"');
    // Unrelated items and Task work items still go through.
    await db.query(`INSERT INTO public.owner_reviews(program_id, property_id, title) VALUES ($1,$2,'Paint colors')`, [prog, home]);
    await db.query(`INSERT INTO public.work_items(kind, property_id, source_task_id, title) VALUES ('task',$1,$2,'Task copy')`, [home, taskA]);
  });

  it("staff can send a clearly different one-off after confirming, once", async () => {
    await as(staffer);
    await db.query("SELECT public.ao_confirm_one_off($1,$2,'Estimate question')", [home, taskA]);
    await db.query(`INSERT INTO public.work_items(kind, property_id, source_task_id, title) VALUES ('opportunity',$1,$2,'Estimate question')`, [home, taskA]);
    await expect(db.query(`INSERT INTO public.work_items(kind, property_id, source_task_id, title) VALUES ('opportunity',$1,$2,'Again')`, [home, taskA])).rejects.toThrow("already has");
    await as(owner);
    await expect(db.query("SELECT public.ao_confirm_one_off($1,$2,'x')", [home, taskA])).rejects.toThrow("Staff only");
  });

  it("accepting a step-link suggestion writes the link only; rejecting changes nothing", async () => {
    await as(admin);
    const before = await one<Record<string, unknown>>("SELECT * FROM public.ao_library_cards WHERE code='A57'");
    const s = await one<{ id: string; template_task_ids: string[] }>("SELECT id, template_task_ids FROM public.ao_card_step_link_suggestions WHERE card_code='A57'");
    await db.query("SELECT public.ao_step_link_decide($1,true)", [s.id]);
    const after = await one<Record<string, unknown>>("SELECT * FROM public.ao_library_cards WHERE code='A57'");
    for (const k of Object.keys(before)) {
      if (["linked_template_task_ids", "version", "updated_by", "updated_at"].includes(k)) continue;
      expect(after[k]).toEqual(before[k]);
    }
    expect(after["linked_template_task_ids"]).toEqual(s.template_task_ids);
    expect(after["status"]).toBe("released");
    expect(await n("SELECT count(*)::int n FROM public.ao_library_card_history WHERE card_id=$1", [cMap])).toBe(1);
    await expect(db.query("SELECT public.ao_step_link_decide($1,true)", [s.id])).rejects.toThrow("already decided");
    const lock = await one<{ id: string }>("SELECT id FROM public.ao_card_step_link_suggestions WHERE card_code='A33'");
    await db.query("SELECT public.ao_step_link_decide($1,false)", [lock.id]);
    expect((await one<{ status: string }>("SELECT status FROM public.ao_card_step_link_suggestions WHERE id=$1", [lock.id])).status).toBe("rejected");
  });

  it("after-handoff scheduler skips items covered by a card the home has", async () => {
    await as(admin);
    const send = await one<{ id: string }>("INSERT INTO public.after_handoff_plan_items(title, template_id) VALUES ('Check in', gen_random_uuid()) RETURNING id");
    const cov = await one<{ id: string }>("INSERT INTO public.after_handoff_plan_items(title, template_id) VALUES ('Estimate', gen_random_uuid()) RETURNING id");
    const other = await one<{ id: string }>("INSERT INTO public.after_handoff_plan_items(title, template_id) VALUES ('Unknown card', gen_random_uuid()) RETURNING id");
    await db.query("SELECT public.after_handoff_plan_set_coverage($1,'covered_by_card','A27')", [cov.id]);
    await db.query("SELECT public.after_handoff_plan_set_coverage($1,'covered_by_card','A41')", [other.id]).catch(() => undefined);
    await expect(db.query("SELECT public.after_handoff_plan_set_coverage($1,'covered_by_card','ZZZ')", [other.id])).rejects.toThrow("Choose a card");
    await as(staffer);
    await expect(db.query("SELECT public.after_handoff_plan_set_coverage($1,'send',null)", [cov.id])).rejects.toThrow("Only an Admin");
    await as(admin);
    expect((await one<{ n: number }>("SELECT private.schedule_after_handoff(null,$1) n", [home])).n).toBe(2);
    const titles = (await db.query<{ title: string }>("SELECT title FROM public.after_handoff_schedule ORDER BY title")).rows.map((r) => r.title);
    expect(titles).toEqual(["Check in", "Unknown card"]);
    expect(await n("SELECT count(*)::int n FROM public.after_handoff_schedule_events WHERE action='skipped_covered'")).toBe(1);
    expect(send.id).toBeTruthy();
  });

  it("templates, steps and home Tasks unchanged; no notifications or email", async () => {
    expect(await fingerprint()).toBe(fpBefore);
    expect(await n("SELECT (SELECT count(*) FROM public.owner_notifications) + (SELECT count(*) FROM public.staff_notifications) + (SELECT count(*) FROM public.email_log) n")).toBe(0);
  });

  it("undo restores the three replaced functions byte for byte with their ACLs and removes the rest", async () => {
    await db.exec(read("docs/pending/ao-dedupe/undo.sql"));
    expect(await defs()).toBe(liveDefs);
    expect(await n("SELECT count(*)::int n FROM pg_proc WHERE proname IN ('ao_card_coverage','ao_guard_owner_item','ao_confirm_one_off','ao_step_link_decide','after_handoff_plan_set_coverage')")).toBe(0);
    expect(await n("SELECT count(*)::int n FROM pg_trigger WHERE tgname='ao_guard_owner_item'")).toBe(0);
    expect(await anonDefinerSet()).toBe(anonBefore);
  });
});
