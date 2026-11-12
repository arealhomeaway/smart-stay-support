// Active Owner, plan starts at enrollment (Nov 12): staged docs/pending/ao-enrollment-start/apply.sql run against an
// isolated PostgreSQL copy built from the live table shapes and the live functions captured Nov 12 (live-capture/).
// Nothing here touches the real database.
import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const DIR = "docs/pending/ao-enrollment-start";
const read = (p: string) => readFileSync(p, "utf8");
const APPLY = read(`${DIR}/apply.sql`);
const UNDO = read(`${DIR}/apply.undo.sql`);
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = "98bd6696-4018-4965-b645-0471c5ae3925";
const owner1 = U(4), or1 = U(7), h1 = U(11), h2 = U(12), h3 = U(13), pm = U(6);
const stepA = U(31);

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('test.uid', true),''), nullif(current_setting('request.jwt.claim.sub', true),''))::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, deleted_at timestamptz, banned_until timestamptz);
CREATE TABLE public.staff(id uuid PRIMARY KEY, is_admin boolean NOT NULL DEFAULT false);
CREATE TABLE public.user_roles(user_id uuid, role public.app_role, UNIQUE(user_id, role));
CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION public.is_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION private.is_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION public.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION private.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1) $$;
CREATE FUNCTION private.is_onboarding_leader(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1 AND is_admin) $$;
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1 AND is_admin AND $2='admin') $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.actor_label(uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'Admin'::text $$;
CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.active_owner_may_act(boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION private.onboarding_work_locked(uuid[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.business_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT current_date $$;
CREATE FUNCTION private.demo_owner_link_ok(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.owner_lifecycle_staff(boolean) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
CREATE FUNCTION private.is_active_owner_authority(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=$1 AND is_admin) $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
`;
const AFTER_SCHEMA = `
CREATE TABLE private.members(program_id uuid, user_id uuid, removed_at timestamptz);
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM public.owner_programs p WHERE p.id=$1 AND p.owner_user_id=$2)
      OR EXISTS(SELECT 1 FROM private.members WHERE program_id=$1 AND user_id=$2 AND removed_at IS NULL) $$;
CREATE FUNCTION private.owner_program_readable(uuid, uuid, boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.is_program_member($2, $1) $$;
CREATE FUNCTION public.format_property_label(jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('primary', $1->>'name') $$;
CREATE FUNCTION private.owner_lifecycle_program(uuid, uuid, boolean) RETURNS public.owner_programs LANGUAGE sql AS $$
  SELECT * FROM public.owner_programs WHERE id=$1 AND report_version=$2 $$;
CREATE TABLE public.tickets(id uuid PRIMARY KEY, property_id uuid, is_demo boolean DEFAULT false);
CREATE TABLE public.owner_program_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid, property_id uuid, kind text, summary text,
  actor_id uuid, previous_value text, new_value text, reason text, detail jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_review_properties(review_id uuid, property_id uuid);
CREATE TABLE public.owner_task_templates(id uuid PRIMARY KEY, active boolean);
CREATE TABLE public.onboarding_templates(id uuid PRIMARY KEY, key text, name text);
CREATE TABLE public.onboarding_template_versions(id uuid PRIMARY KEY, template_id uuid, version int, snapshot jsonb);
CREATE FUNCTION public.plan_step_applies(jsonb, text, text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION public.project_role_assignee(uuid, text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${pm}'::uuid $$;
`;
// The engine as live on Nov 12, captured function by function.
const LIVE_FILES = readdirSync(`${DIR}/live-capture`).filter((f) => f.endsWith(".sql")).sort();
const TRIGGERS = `
CREATE TRIGGER ao_guard_owner_item BEFORE INSERT ON public.owner_reviews FOR EACH ROW EXECUTE FUNCTION private.ao_guard_owner_item();
CREATE TRIGGER owner_reviews_notify_owner AFTER INSERT OR UPDATE ON public.owner_reviews FOR EACH ROW WHEN ((NOT new.auto_ticket)) EXECUTE FUNCTION notify_owner_of_review();
CREATE TRIGGER block_demo_owner_notification_delivery BEFORE INSERT OR UPDATE ON public.owner_notifications FOR EACH ROW EXECUTE FUNCTION private.block_demo_owner_notification_delivery();
CREATE TRIGGER ao_unlock_on_task_complete AFTER UPDATE OF status ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION private.ao_task_completed();
CREATE TRIGGER enrollment_activation_guard BEFORE INSERT OR DELETE OR UPDATE OF program_id, property_id, inclusion_status, closing_date, closing_confirmed, is_demo, archived_at ON public.owner_program_properties FOR EACH ROW EXECUTE FUNCTION guard_owner_enrollment_activation();
CREATE TRIGGER ao_enrollment_changed AFTER INSERT OR UPDATE OF inclusion_status, archived_at ON public.owner_program_properties FOR EACH ROW EXECUTE FUNCTION private.ao_enrollment_changed();
CREATE TRIGGER ao_program_changed AFTER UPDATE OF status, archived_at ON public.owner_programs FOR EACH ROW EXECUTE FUNCTION private.ao_enrollment_changed();
GRANT SELECT ON public.ao_home_plan_cards TO authenticated;
ALTER TABLE public.ao_home_plan_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY ao_plan_read ON public.ao_home_plan_cards FOR SELECT TO authenticated
  USING (is_internal_staff(auth.uid()) OR private.owner_current_property_for_actor(auth.uid(), property_id, program_id));
`;

let db: PGlite;
const as = async (uid: string | null) => db.query(`SELECT set_config('test.uid', $1, false)`, [uid ?? ""]);
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!;
const n = async (sql: string, p: unknown[] = []) => (await one<{ n: number }>(sql, p)).n;
const cards = (home: string) => n("SELECT count(*)::int n FROM public.ao_home_plan_cards WHERE property_id=$1", [home]);
const openCards = (home: string) => n(`SELECT count(*)::int n FROM public.ao_home_plan_cards c JOIN public.owner_reviews r ON r.id=c.owner_review_id
  WHERE c.property_id=$1 AND c.join_outcome='open' AND r.status='awaiting_owner'`, [home]);
const readyNotices = (prog: string) => n("SELECT count(*)::int n FROM public.owner_notifications WHERE program_id=$1 AND kind='ao_plan_ready'", [prog]);
const card = (code: string, stage = "anytime", lock = "none", links: string[] = []) =>
  db.query(`INSERT INTO public.ao_library_cards(code, title, lane, stage_window, status, lock_rule, linked_template_task_ids, deadline_business_days, why_text)
    VALUES ($1, 'Card ' || $1, 'critical', $2, 'released', $3, $4::uuid[], 3, 'Why')`, [code, stage, lock, `{${links.join(",")}}`]);
const create = async (home: string) => (await one<{ r: { programId: string } }>("SELECT public.create_owner_program($1) r", [home])).r.programId;
const version = async (prog: string) => (await one<{ v: string }>("SELECT report_version v FROM public.owner_programs WHERE id=$1", [prog])).v;
// What the one-step enrollment does right after creating the program: link the homeowner login.
const linkOwner = (prog: string) => db.query("UPDATE public.owner_programs SET owner_user_id=$2 WHERE id=$1", [prog, owner1]);
const defOf = async (sig: string) => (await one<{ d: string }>(`SELECT pg_get_functiondef('${sig}'::regprocedure) d`)).d;

describe("Active Owner plan starts at enrollment, staged SQL on an isolated database", () => {
  let before: { cards: number; status: string } = { cards: -1, status: "" };
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("SET check_function_bodies = off;");
    await db.exec(STUBS);
    await db.exec(read("src/lib/__tests__/fixtures/active-owner-fix-schema.sql"));
    await db.exec(read("src/lib/__tests__/fixtures/ao-enrollment-start-extra.sql"));
    await db.exec(AFTER_SCHEMA);
    for (const f of LIVE_FILES) await db.exec(read(`${DIR}/live-capture/${f}`));
    await db.exec(TRIGGERS);
    await db.exec(`
      INSERT INTO public.staff VALUES ('${ADMIN}', true), ('${pm}', false);
      INSERT INTO auth.users(id) VALUES ('${ADMIN}'), ('${owner1}');
      INSERT INTO public.user_roles VALUES ('${owner1}', 'owner');
      INSERT INTO public.profiles(id, full_name) VALUES ('${owner1}', 'Pat Owner');
      INSERT INTO public.property_owners(id, active, source_owner_id, name, email) VALUES ('${or1}', true, 'o1', 'Pat Owner', 'pat@example.invalid');
      INSERT INTO public.properties(id, name, owner_record_id) VALUES ('${h1}','1 First St','${or1}'),('${h2}','2 Second St','${or1}'),('${h3}','3 Third St','${or1}');
      INSERT INTO public.onboarding_projects(id, property_id, handoff_state) VALUES ('${U(51)}','${h1}','in_progress'),('${U(52)}','${h2}','in_progress'),('${U(53)}','${h3}','in_progress');
    `);
    await card("O01"); await card("O02"); await card("L01", "anytime", "until_linked_step_done", [stepA]);
    for (const [i, home] of [h1, h2, h3].entries())
      await db.query("INSERT INTO public.onboarding_tasks(id, property_id, title, template_task_id, status, assigned_to) VALUES ($1,$2,'Step A',$3,'open',$4)", [U(100 + i), home, stepA, pm]);
    // Live today: a draft program starts no plan (rolled back afterwards).
    await as(ADMIN);
    await db.exec("BEGIN");
    const prog = await create(h3);
    before = { cards: await cards(h3), status: (await one<{ s: string }>("SELECT status s FROM public.owner_programs WHERE id=$1", [prog])).s };
    await db.exec("ROLLBACK");
    await db.exec(APPLY);
  });
  afterAll(async () => db?.close());

  it("live today, creating a draft program for a home gives it no cards", () => {
    expect(before).toEqual({ cards: 0, status: "draft" });
  });

  it("creating a draft program starts the home's plan with cards; one plan-ready notice once the login is linked", async () => {
    await as(ADMIN);
    const prog = await create(h1);
    expect((await one<{ s: string; st: string | null }>("SELECT status s, started_on st FROM public.owner_programs WHERE id=$1", [prog]))).toEqual({ s: "draft", st: null });
    expect(await cards(h1)).toBe(3);
    expect(await openCards(h1)).toBe(2); // O01, O02 open; L01 waits on its step
    expect((await one<{ a: boolean }>("SELECT automated a FROM public.ao_home_plan_settings WHERE property_id=$1", [h1])).a).toBe(true);
    expect(await readyNotices(prog)).toBe(0); // no login linked yet: nobody to tell
    await linkOwner(prog);
    expect(await readyNotices(prog)).toBe(1);
    const note = await one<{ body: string; email_status: string; owner_user_id: string }>(
      "SELECT body, email_status, owner_user_id FROM public.owner_notifications WHERE program_id=$1 AND kind='ao_plan_ready'", [prog]);
    expect(note).toEqual({ body: "We added 2 activities to your portal for 1 First St. Open your portal to see what's next.", email_status: "held", owner_user_id: owner1 });
    // No card-by-card notice: the plan start is one batch.
    expect(await n("SELECT count(*)::int n FROM public.owner_notifications WHERE program_id=$1 AND kind<>'ao_plan_ready'", [prog])).toBe(0);
    // Linking again or any later status change adds no second notice.
    await db.query("UPDATE public.owner_programs SET status='waiting_for_closing' WHERE id=$1", [prog]);
    expect(await readyNotices(prog)).toBe(1);
  });

  it("a second home added later to the draft program also starts, folded into the same notice", async () => {
    await as(ADMIN);
    const prog = (await one<{ id: string }>("SELECT id FROM public.owner_programs WHERE property_id=$1", [h1])).id;
    await db.query("SELECT public.change_owner_program($1, $2, 'add_property', $3, NULL)", [prog, await version(prog), h2]);
    expect(await cards(h2)).toBe(3);
    expect(await openCards(h2)).toBe(2);
    expect(await readyNotices(prog)).toBe(1);
    expect((await one<{ open_count: number }>("SELECT open_count FROM public.ao_plan_ready_notices WHERE program_id=$1", [prog])).open_count).toBe(4);
    // Adding the home twice is refused and builds nothing again.
    await expect(db.query("SELECT public.change_owner_program($1, $2, 'add_property', $3, NULL)", [prog, await version(prog), h2])).rejects.toThrow();
    expect(await cards(h2)).toBe(3);
  });

  it("the owner of a draft program can see the cards and log hours", async () => {
    const prog = (await one<{ id: string }>("SELECT id FROM public.owner_programs WHERE property_id=$1", [h1])).id;
    await db.query("UPDATE public.owner_programs SET status='draft' WHERE id=$1", [prog]);
    await as(owner1);
    expect((await one<{ e: { eligible: boolean } }>("SELECT public.owner_hours_eligibility($1) e", [prog])).e).toEqual({ eligible: true });
    expect((await one<{ id: string }>("SELECT (private.lock_owner_time_program($1, $2, false, true)).id", [prog, owner1])).id).toBe(prog);
    for (const s of ["waiting_for_closing", "ready_for_onboarding", "active", "target_reached"]) {
      await as(ADMIN); await db.query("UPDATE public.owner_programs SET status=$2 WHERE id=$1", [prog, s]); await as(owner1);
      expect((await one<{ e: { eligible: boolean } }>("SELECT public.owner_hours_eligibility($1) e", [prog])).e.eligible).toBe(true);
    }
    await as(ADMIN); await db.query("UPDATE public.owner_programs SET status='draft' WHERE id=$1", [prog]);
  });

  it("only live programs count: paused, closed, completed or archived start nothing", async () => {
    await as(ADMIN);
    const prog = (await one<{ id: string }>("SELECT id FROM public.owner_programs WHERE property_id=$1", [h1])).id;
    for (const s of ["draft", "waiting_for_closing", "ready_for_onboarding", "active", "target_reached"])
      expect((await one<{ ok: boolean }>("SELECT private.owner_program_live($1) ok", [s])).ok).toBe(true);
    for (const s of ["paused", "closed", "completed", "complete", "pending"])
      expect((await one<{ ok: boolean }>("SELECT private.owner_program_live($1) ok", [s])).ok).toBe(false);
    for (const s of ["paused", "closed"]) {
      await db.query("UPDATE public.owner_programs SET status=$2 WHERE id=$1", [prog, s]);
      expect((await one<{ r: { reason?: string } }>("SELECT private.ao_home_program($1) r", [h1])).r.reason).toBe("This home has no active Active Owner program");
    }
    await db.query("UPDATE public.owner_programs SET status='draft' WHERE id=$1", [prog]);
    expect((await one<{ r: { program_id?: string } }>("SELECT private.ao_home_program($1) r", [h1])).r.program_id).toBe(prog);
  });

  it("the file changes only the status checks and the one owner-link notice; undo puts back the exact live text", async () => {
    const sigs = ["private.ao_enrollment_changed()", "private.ao_home_program(uuid)", "private.ao_enrolled_rows()",
      "private.lock_owner_time_program(uuid,uuid,boolean,boolean)", "public.owner_hours_eligibility(uuid)", "public.capture_owner_time_update()",
      "public.can_view_owner_library_video(uuid)", "public.notify_owner_of_review()", "public.record_owner_work_order_response(uuid,uuid,text,text)",
      "public.owner_release_summary(uuid,integer,uuid[])"];
    expect(APPLY).not.toMatch(/activate_owner_program\(/);
    // Outside function bodies the file changes no rows.
    const outside = APPLY.replace(/\$function\$[\s\S]*?\$function\$/g, "").replace(/--.*$/gm, "");
    expect(outside).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/im);
    await db.exec(UNDO);
    for (const sig of sigs) {
      const [schema, rest] = sig.split(".");
      const file = `${schema}.${rest!.split("(")[0]}`;
      const live = read(`${DIR}/live-capture/${file}.sql`).trim().replace(/;$/, "").trim();
      expect((await defOf(sig)).trim()).toBe(live);
    }
    expect(await n("SELECT count(*)::int n FROM pg_proc WHERE proname='owner_program_live'")).toBe(0);
    const trig = await one<{ d: string }>("SELECT pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname='ao_program_changed'");
    expect(trig.d).toContain("AFTER UPDATE OF status, archived_at ON public.owner_programs");
    await db.exec(APPLY); // applies again cleanly after undo
    expect(await n("SELECT count(*)::int n FROM pg_proc WHERE proname='owner_program_live'")).toBe(1);
  });
});
