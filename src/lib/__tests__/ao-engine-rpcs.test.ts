import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = U(1), staffer = U(2), owner = U(3), coOwner = U(4), stranger = U(5), assignee = U(6);
const home = U(10), demoHome = U(11), prog = U(20), demoProg = U(21);
const stepA = U(30), taskA = U(31), demoTaskA = U(32);
const cOpen = U(40), cLocked = U(41), cFlex = U(42), cPassed = U(43), cDraft = U(44), cCovered = U(45);
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
CREATE TABLE private.members(program_id uuid, user_id uuid, removed_at timestamptz);
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM private.members WHERE program_id=$1 AND user_id=$2 AND removed_at IS NULL) $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY, property_id uuid, owner_user_id uuid, status text, is_demo boolean NOT NULL DEFAULT false, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid NOT NULL, property_id uuid, phase text NOT NULL, stage text NOT NULL, title text NOT NULL, recommendation text, status text NOT NULL DEFAULT 'prepared', source_type text, owner_action_type text, onboarding_task_id uuid, is_demo boolean, created_by uuid, task_type text, available_from timestamptz, respond_by date, responded_at timestamptz, closed_at timestamptz, outcome text, updated_at timestamptz);
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, handoff_state text DEFAULT 'in_progress', ops_accepted_at timestamptz, completed_at timestamptz, ready_for_ops_at timestamptz, planned_closing_on date, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_templates(id uuid PRIMARY KEY, name text);
CREATE TABLE public.onboarding_template_tasks(id uuid PRIMARY KEY, template_id uuid, title text);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY, property_id uuid, template_task_id uuid, status text, assigned_to uuid, completed_by uuid, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid, owner_user_id uuid, review_id uuid, kind text, priority text, title text, body text, email_status text, is_demo boolean);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text, title text, body text, entity_type text, entity_id uuid, email_status text, is_demo boolean);
INSERT INTO public.onboarding_templates VALUES ('c6f0cab5-4cbc-4531-b471-780ccc051bb2','ARHA Onboarding — Full Plan'),('84f3a777-44a8-430a-af7e-8f18dc9a7dae','ARHA Onboarding - Standard');
INSERT INTO public.onboarding_template_tasks VALUES ('${stepA}','c6f0cab5-4cbc-4531-b471-780ccc051bb2','Order furniture');
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
const catalog = async () =>
  (await one<{ s: string }>(`SELECT coalesce(string_agg(p.oid::regprocedure::text || md5(pg_get_functiondef(p.oid)) || coalesce(p.proacl::text,''), ',' ORDER BY 1),'') ||
     (SELECT coalesce(string_agg(tgname, ',' ORDER BY 1),'') FROM pg_trigger WHERE NOT tgisinternal) s
     FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname IN ('public','private')`)).s;
const card = (id: string, code: string, o: Record<string, unknown>) =>
  db.query(`INSERT INTO public.ao_library_cards(id, code, title, lane, stage_window, status, lock_rule, linked_template_task_ids, deadline_business_days, opens_text, why_text)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::uuid[],$9,$10,'Why')`,
    [id, code, o.title ?? code, o.lane ?? "critical", o.stage ?? "onboarding_early", o.status ?? "released",
     o.lock ?? "none", `{${(o.links as string[] | undefined)?.join(",") ?? ""}}`, o.days ?? 3, o.opens ?? ""]);
const plan = (prop: string, c: string) =>
  one<{ id: string; join_outcome: string; owner_review_id: string | null; unlocked_at: string | null; reminder_at: Date | null; cutoff_at: Date | null; deadline_at: Date | null }>(
    "SELECT * FROM public.ao_home_plan_cards WHERE property_id=$1 AND card_id=$2", [prop, c]);

describe("Active Owner engine pass 2, isolated PostgreSQL", () => {
  let fpBefore = "", anonBefore = "", catBefore = "";
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(read("docs/pending/ao-engine/01_engine_foundation.sql"));
    await db.exec(`INSERT INTO public.staff VALUES ('${admin}', true), ('${staffer}', false), ('${assignee}', false);
      INSERT INTO public.properties VALUES ('${home}', false), ('${demoHome}', true);
      INSERT INTO public.owner_programs(id, property_id, owner_user_id, status) VALUES ('${prog}','${home}','${owner}','active');
      INSERT INTO public.owner_programs(id, property_id, owner_user_id, status, is_demo) VALUES ('${demoProg}','${demoHome}','${owner}','active', true);
      INSERT INTO private.members VALUES ('${prog}','${owner}',null),('${prog}','${coOwner}',null);
      INSERT INTO public.onboarding_projects(property_id, handoff_state) VALUES ('${home}','in_progress'),('${demoHome}','ready');
      INSERT INTO public.onboarding_tasks(id, property_id, template_task_id, status, assigned_to) VALUES
        ('${taskA}','${home}','${stepA}','open','${assignee}'),('${demoTaskA}','${demoHome}','${stepA}','open','${assignee}');`);
    await card(cOpen, "T01", { title: "Pick paint" });
    await card(cLocked, "T02", { title: "Review furniture", lock: "until_linked_step_done", links: [stepA], opens: "order furniture", stage: "anytime" });
    await card(cFlex, "T03", { title: "Neighborhood sheet", lane: "flexible", stage: "anytime" });
    await card(cPassed, "T04", { title: "Early only" });
    await card(cDraft, "T05", { status: "draft", stage: "anytime" });
    await card(cCovered, "T06", { stage: "anytime" });
    await db.query("UPDATE public.ao_library_cards SET stage_window='onboarding_early' WHERE id=$1", [cPassed]);
    fpBefore = await fingerprint();
    anonBefore = await anonDefinerSet();
    catBefore = await catalog();
    await db.exec(read("docs/pending/ao-engine/02_engine_rpcs.sql"));
  });
  afterAll(async () => db?.close());

  it("adds no anon or PUBLIC executable function", async () => {
    expect(await anonDefinerSet()).toBe(anonBefore);
    for (const f of ["ao_card_save(uuid,jsonb)", "ao_set_home_automation(uuid,boolean,uuid[])", "ao_submit_card(uuid,jsonb)", "ao_process_clocks(timestamptz)"])
      expect((await one<{ ok: boolean }>(`SELECT has_function_privilege('anon','public.${f}','EXECUTE') ok`)).ok).toBe(false);
    expect((await one<{ ok: boolean }>(`SELECT has_function_privilege('authenticated','public.ao_process_clocks(timestamptz)','EXECUTE') ok`)).ok).toBe(false);
  });

  it("library editor: Admin edits with history; other staff, owners and signed-out refused", async () => {
    await as(admin);
    expect((await one<{ v: number }>(`SELECT public.ao_card_save($1, '{"title":"Pick paint colors","output_fields":[{"key":"color"}]}') v`, [cOpen])).v).toBe(2);
    expect(await n("SELECT count(*)::int n FROM public.ao_library_card_history WHERE card_id=$1", [cOpen])).toBe(1);
    await expect(db.query(`SELECT public.ao_card_save($1, '{"status":"released"}')`, [cOpen])).rejects.toThrow();
    for (const u of [staffer, owner, null]) {
      await as(u);
      await expect(db.query(`SELECT public.ao_card_set_status($1,'retired')`, [cOpen])).rejects.toThrow();
    }
    await as(admin);
    await db.query(`SELECT public.ao_card_set_status($1,'retired')`, [cDraft]);
    await db.query(`SELECT public.ao_card_set_status($1,'draft')`, [cDraft]);
    expect((await one<{ status: string }>("SELECT status FROM public.ao_library_cards WHERE id=$1", [cDraft])).status).toBe("draft");
  });

  it("switch ON joins at current stage from released cards only", async () => {
    await as(staffer);
    await expect(db.query("SELECT public.ao_set_home_automation($1,true)", [home])).rejects.toThrow();
    await as(admin);
    await db.query("UPDATE public.onboarding_projects SET handoff_state='ready' WHERE property_id=$1", [home]);
    await db.query(`SELECT public.ao_set_home_automation($1,true,ARRAY[$2]::uuid[])`, [home, cCovered]);
    expect((await plan(home, cPassed)).join_outcome).toBe("skipped_passed");
    expect((await plan(home, cCovered)).join_outcome).toBe("already_covered");
    expect((await plan(home, cLocked)).join_outcome).toBe("locked");
    const open = await plan(home, cOpen);
    expect(open.join_outcome).toBe("skipped_passed"); // early-only card passed at launch stage
    expect((await plan(home, cFlex)).join_outcome).toBe("open");
    expect(await n("SELECT count(*)::int n FROM public.ao_home_plan_cards WHERE card_id=$1", [cDraft])).toBe(0);
    const locked = await plan(home, cLocked);
    const rv = await one<{ status: string; recommendation: string }>("SELECT * FROM public.owner_reviews WHERE id=$1", [locked.owner_review_id]);
    expect(rv.status).toBe("prepared");
    expect(rv.recommendation).toBe("Coming soon: waiting on ARHA to order furniture");
    expect(await n("SELECT count(*)::int n FROM public.owner_reviews")).toBe(2); // locked + flexible open
  });

  it("flexible cards get a target only, never reminder or cutoff", async () => {
    const f = await plan(home, cFlex);
    expect(f.deadline_at).not.toBeNull();
    expect(f.reminder_at).toBeNull();
    expect(f.cutoff_at).toBeNull();
  });

  it("Task completion unlocks the card and starts its clock; Task row itself unchanged", async () => {
    await db.query("UPDATE public.onboarding_tasks SET status='complete', completed_by=$2 WHERE id=$1", [taskA, assignee]);
    const p = await plan(home, cLocked);
    expect(p.unlocked_at).not.toBeNull();
    expect(p.cutoff_at!.getTime()).toBeGreaterThan(p.deadline_at!.getTime());
    expect(p.reminder_at!.getTime()).toBeLessThan(p.deadline_at!.getTime());
    expect((await one<{ status: string }>("SELECT status FROM public.owner_reviews WHERE id=$1", [p.owner_review_id])).status).toBe("awaiting_owner");
    await db.query("UPDATE public.onboarding_tasks SET status='open', completed_by=null WHERE id=$1", [taskA]);
  });

  it("reminder once, then expiry alert to the Task assignee only", async () => {
    const p = await plan(home, cLocked);
    const atReminder = new Date(p.reminder_at!.getTime() + 60_000).toISOString();
    await db.query("SELECT public.ao_process_clocks($1)", [atReminder]);
    await db.query("SELECT public.ao_process_clocks($1)", [atReminder]);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE program_id=$1 AND email_status='pending'", [prog])).toBe(1);
    const atCutoff = new Date(p.cutoff_at!.getTime() + 60_000).toISOString();
    await db.query("SELECT public.ao_process_clocks($1)", [atCutoff]);
    await db.query("SELECT public.ao_process_clocks($1)", [atCutoff]);
    const alerts = (await db.query<{ user_id: string; title: string }>("SELECT user_id, title FROM public.staff_notifications")).rows;
    expect(alerts).toEqual([{ user_id: assignee, title: "Homeowner did not complete Review furniture; proceed as normal" }]);
    expect((await one<{ outcome: string }>("SELECT outcome FROM public.owner_reviews WHERE id=$1", [p.owner_review_id])).outcome)
      .toBe("Owner opportunity expired, ARHA completed");
    // flexible never expires even far in the future
    await db.query("SELECT public.ao_process_clocks($1)", ["2030-01-01T00:00:00Z"]);
    const f = await one<{ expired_at: string | null; reminder_sent_at: string | null }>("SELECT * FROM public.ao_home_plan_cards WHERE card_id=$1 AND property_id=$2", [cFlex, home]);
    expect(f.expired_at).toBeNull();
    expect(f.reminder_sent_at).toBeNull();
  });

  it("practice/demo homes never email", async () => {
    await as(admin);
    await db.query("SELECT public.ao_set_home_automation($1,true)", [demoHome]);
    await db.query("UPDATE public.onboarding_tasks SET status='complete' WHERE id=$1", [demoTaskA]);
    const p = await plan(demoHome, cLocked);
    await db.query("SELECT public.ao_process_clocks($1)", [new Date(p.reminder_at!.getTime() + 1000).toISOString()]);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE program_id=$1", [demoProg])).toBe(1);
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE program_id=$1 AND email_status<>'skipped'", [demoProg])).toBe(0);
    await db.query("UPDATE public.onboarding_tasks SET status='open' WHERE id=$1", [demoTaskA]);
  });

  it("contributions: member answer attributed, first answer counts, outsiders refused", async () => {
    const f = await plan(home, cFlex);
    await as(stranger);
    await expect(db.query(`SELECT public.ao_submit_card($1,'{"x":1}')`, [f.id])).rejects.toThrow();
    await as(coOwner);
    await db.query(`SELECT public.ao_submit_card($1,'{"topic":"Schools"}')`, [f.id]);
    await as(owner);
    await expect(db.query(`SELECT public.ao_submit_card($1,'{"topic":"Parks"}')`, [f.id])).rejects.toThrow();
    const c = await one<{ submitted_by: string; field_values: { topic: string } }>("SELECT * FROM public.ao_contributions");
    expect(c.submitted_by).toBe(coOwner);
    expect(c.field_values.topic).toBe("Schools");
  });

  it("switch OFF keeps every existing owner item and plan card", async () => {
    await as(admin);
    const before = await n("SELECT count(*)::int n FROM public.owner_reviews") + await n("SELECT count(*)::int n FROM public.ao_home_plan_cards");
    await db.query("SELECT public.ao_set_home_automation($1,false)", [home]);
    const after = await n("SELECT count(*)::int n FROM public.owner_reviews") + await n("SELECT count(*)::int n FROM public.ao_home_plan_cards");
    expect(after).toBe(before);
    expect(await n("SELECT count(*)::int n FROM public.ao_home_plan_settings_history WHERE property_id=$1", [home])).toBeGreaterThanOrEqual(2);
  });

  it("templates, steps and home Tasks unchanged; undo restores the exact catalog", async () => {
    expect(await fingerprint()).toBe(fpBefore);
    await db.exec(read("docs/pending/ao-engine/undo/02_engine_rpcs.sql"));
    expect(await catalog()).toBe(catBefore);
  });
});
