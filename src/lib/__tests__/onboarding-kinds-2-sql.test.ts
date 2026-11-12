// Nov 12 completion build: staged files in docs/pending/onboarding-kinds-2 run on an isolated
// PostgreSQL copy (PGlite) built from the live table shapes. Nothing here touches the real database.
import { describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/onboarding-kinds-2";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = U(1), reviewer = U(2), pm = U(3), other = U(4), uploader = U(5);
const home = U(11), home2 = U(12), prog = U(21), project = U(22);
const approval = U(31), source = U(32), openSource = U(33), configured = U(34), elsewhere = U(35), bdTask = U(36), outside = U(37);
const step = U(51), opp = U(61), plan = U(71), review = U(81);

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE FUNCTION private.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 IN ('${reviewer}','${pm}','${other}','${uploader}') $$;
CREATE FUNCTION private.is_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.is_onboarding_staff($1) $$;
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $2 = '${owner}' $$;
CREATE FUNCTION private.review_role_person(uuid, text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT CASE WHEN $2 = 'onboarding_project_manager' THEN '${pm}'::uuid END $$;
CREATE TABLE public.notified(work_item uuid, what text);
CREATE FUNCTION private.notify_opportunity_staff(uuid, text) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.notified VALUES ($1, $2) $$;
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text, entity_type text,
  entity_id uuid, entity_label text, reason text, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, email text);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY);
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, status text, created_at timestamptz DEFAULT now(), is_demo boolean DEFAULT false);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, title text, template_task_id uuid,
  task_kind text DEFAULT 'do_it', kind_settings jsonb DEFAULT '{}', assigned_to uuid, assigned_seat text, status text DEFAULT 'open',
  sort_order int DEFAULT 0, archived_at timestamptz, completed_at timestamptz, is_demo boolean DEFAULT false,
  requires_owner_approval boolean DEFAULT false, owner_dependency text, owner_approval_status text DEFAULT 'pending');
CREATE TABLE public.onboarding_step_review_settings(template_task_id uuid PRIMARY KEY, reviewer_roles text[] DEFAULT '{}');
CREATE TABLE public.onboarding_task_file_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, receiving_task_id uuid, source_task_id uuid, removed_at timestamptz);
CREATE TABLE public.onboarding_project_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, property_id uuid, kind text, summary text,
  detail text, prior_value text, new_value text, actor uuid, is_demo boolean, created_at timestamptz DEFAULT now());
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text,
  entity_type text, entity_id uuid, link_path text, actor_id uuid, is_demo boolean);
CREATE TABLE public.onboarding_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, task_id uuid, body text, author_id uuid, is_demo boolean);
CREATE TABLE public.approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, property_id uuid, status text,
  decision_note text, decided_at timestamptz, responded_at timestamptz, response_channel text, created_at timestamptz DEFAULT now());
CREATE TABLE public.work_items(id uuid PRIMARY KEY, program_id uuid, property_id uuid, kind text, status text, source text, source_task_id uuid,
  title text, response_types text[], responded_at timestamptz, viewed_at timestamptz, owner_response jsonb DEFAULT '[]');
CREATE TABLE public.ao_home_plan_cards(id uuid PRIMARY KEY, program_id uuid, linked_task_id uuid);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY, program_id uuid, archived_at timestamptz, onboarding_task_id uuid);
CREATE TABLE public.owner_item_task_sends(review_id uuid PRIMARY KEY, task_id uuid);
`;

async function fresh(withLive = true) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(`
    INSERT INTO public.profiles VALUES ('${owner}', 'Ana Owner', null), ('${reviewer}', 'Rae Reviewer', null);
    INSERT INTO public.owner_programs VALUES ('${prog}');
    INSERT INTO public.onboarding_projects(id, property_id, status) VALUES ('${project}', '${home}', 'active');
    INSERT INTO public.onboarding_step_review_settings VALUES ('${step}', '{onboarding_director}');
    INSERT INTO public.onboarding_tasks(id, property_id, title, task_kind, assigned_to, assigned_seat, status, completed_at, template_task_id, owner_dependency, requires_owner_approval, owner_approval_status, kind_settings) VALUES
      ('${approval}', '${home}', 'Approve the design board', 'approval', '${reviewer}', NULL, 'open', NULL, NULL, NULL, false, 'not_required', '{}'),
      ('${source}', '${home}', 'Make the design board', 'upload_files', '${uploader}', NULL, 'complete', now(), NULL, NULL, false, 'not_required', '{}'),
      ('${openSource}', '${home}', 'Collect the paint colors', 'do_it', NULL, 'onboarding_project_manager', 'open', NULL, NULL, NULL, false, 'not_required', '{}'),
      ('${configured}', '${home}', 'Approve the budget', 'approval', '${reviewer}', NULL, 'open', NULL, '${step}', NULL, false, 'not_required', '{}'),
      ('${elsewhere}', '${home2}', 'Other home step', 'do_it', NULL, NULL, 'open', NULL, NULL, NULL, false, 'not_required', '{}'),
      ('${bdTask}', '${home}', 'Choose the furnishing package', 'send_to_owner', NULL, NULL, 'open', NULL, NULL, 'business_decision', false, 'not_required', '{}'),
      ('${outside}', '${home}', 'Sign the management agreement', 'outside_resolve', NULL, NULL, 'open', NULL, NULL, NULL, false, 'not_required', '{"where":"docusign"}');
    INSERT INTO public.onboarding_task_file_links(property_id, receiving_task_id, source_task_id) VALUES
      ('${home}', '${approval}', '${source}'), ('${home}', '${approval}', '${openSource}');
    INSERT INTO public.work_items(id, program_id, property_id, kind, status, source, source_task_id, title, response_types)
      VALUES ('${opp}', '${prog}', '${home}', 'opportunity', 'open', 'arha', '${bdTask}', 'Choose the furnishing package', '{decision}');
    INSERT INTO public.approvals(entity_type, entity_id, property_id, status) VALUES ('onboarding_task', '${bdTask}', '${home}', 'pending');
    INSERT INTO public.ao_home_plan_cards VALUES ('${plan}', '${prog}', '${outside}');
    INSERT INTO public.owner_reviews VALUES ('${review}', '${prog}', NULL, '${outside}');
  `);
  if (withLive) await db.exec(read("live-capture/respond_owner_opportunity.sql").replace(/^--.*$/m, ""));
  await db.exec(read("01_fill_in_and_follow_ups.sql"));
  await db.exec(read("02_approval_send_back.sql"));
  await db.exec(read("03_owner_approve_and_outside.sql"));
  return db;
}
const as = (db: PGlite, uid: string) => db.exec(`SELECT set_config('request.jwt.claim.sub', '${uid}', false)`);
const one = async <T,>(db: PGlite, sql: string) => (await db.query<T>(sql)).rows[0] as T;

describe("01 inspection date and follow-up link", () => {
  it("item 1: the project keeps an inspection date", async () => {
    const db = await fresh();
    await db.exec(`UPDATE public.onboarding_projects SET inspection_on = '2026-12-03' WHERE id = '${project}'`);
    expect((await one<{ d: string }>(db, `SELECT inspection_on::text d FROM public.onboarding_projects WHERE id = '${project}'`)).d).toBe("2026-12-03");
  });
  it("item 8: a follow-up stores its source Task, and each side can find the other", async () => {
    const db = await fresh();
    await db.exec(`INSERT INTO public.onboarding_tasks(id, property_id, title, follow_up_of) VALUES ('${U(90)}', '${home}', 'Fix the gate code', '${source}')`);
    const r = await one<{ f: string }>(db, `SELECT follow_up_of::text f FROM public.onboarding_tasks WHERE id = '${U(90)}'`);
    expect(r.f).toBe(source);
    const back = (await db.query<{ id: string }>(`SELECT id::text FROM public.onboarding_tasks WHERE follow_up_of = '${source}'`)).rows.map((x) => x.id);
    expect(back).toEqual([U(90)]);
  });
  it("item 8: a follow-up on another home, or on itself, is refused", async () => {
    const db = await fresh();
    await expect(db.exec(`INSERT INTO public.onboarding_tasks(property_id, title, follow_up_of) VALUES ('${home2}', 'Wrong home', '${source}')`)).rejects.toThrow("same home");
    await expect(db.exec(`UPDATE public.onboarding_tasks SET follow_up_of = id WHERE id = '${source}'`)).rejects.toThrow("cannot follow up on itself");
  });
  it("undo removes the rule and keeps the values", async () => {
    const db = await fresh();
    await db.exec(`INSERT INTO public.onboarding_tasks(id, property_id, title, follow_up_of) VALUES ('${U(90)}', '${home}', 'Fix the gate code', '${source}')`);
    await db.exec(read("01_fill_in_and_follow_ups.undo.sql"));
    expect((await one<{ n: number }>(db, "SELECT count(*)::int n FROM pg_trigger WHERE tgname = 'onboarding_follow_up_same_home'")).n).toBe(0);
    expect((await one<{ f: string }>(db, `SELECT follow_up_of::text f FROM public.onboarding_tasks WHERE id = '${U(90)}'`)).f).toBe(source);
  });
});

describe("02 Approval without a step review", () => {
  it("item 9: the assigned person reviews; a configured review keeps its own reviewers", async () => {
    const db = await fresh();
    await as(db, other);
    expect((await one<{ r: string }>(db, `SELECT public.approval_task_reviewer('${approval}')::text r`)).r).toBe(reviewer);
    expect((await one<{ r: string | null }>(db, `SELECT public.approval_task_reviewer('${configured}')::text r`)).r).toBeNull();
  });
  it("item 9: without a person, whoever holds the Task's role on this home reviews", async () => {
    const db = await fresh();
    await db.exec(`UPDATE public.onboarding_tasks SET assigned_to = NULL, assigned_seat = 'onboarding_project_manager' WHERE id = '${approval}'`);
    await as(db, other);
    expect((await one<{ r: string }>(db, `SELECT public.approval_task_reviewer('${approval}')::text r`)).r).toBe(pm);
  });
  it("item 9: Send back needs a note and the reviewer", async () => {
    const db = await fresh();
    await as(db, reviewer);
    await expect(db.exec(`SELECT public.approval_task_send_back('${approval}', 'no')`)).rejects.toThrow("5 characters");
    await as(db, other);
    await expect(db.exec(`SELECT public.approval_task_send_back('${approval}', 'Please redo the rug')`)).rejects.toThrow("Only the person reviewing");
  });
  it("item 9: Send back reopens the finished Show files from step, notifies each step's person and logs the note", async () => {
    const db = await fresh();
    await as(db, reviewer);
    const r = await one<{ j: { reopened: string[]; notified: number } }>(db, `SELECT public.approval_task_send_back('${approval}', 'Please redo the rug colors') j`);
    expect(r.j.reopened).toEqual([source]);
    expect(r.j.notified).toBe(2);
    expect((await one<{ s: string }>(db, `SELECT status s FROM public.onboarding_tasks WHERE id = '${source}'`)).s).toBe("open");
    expect((await one<{ s: string }>(db, `SELECT status s FROM public.onboarding_tasks WHERE id = '${openSource}'`)).s).toBe("open");
    const who = (await db.query<{ user_id: string }>(`SELECT user_id::text FROM public.staff_notifications ORDER BY user_id`)).rows.map((x) => x.user_id);
    expect(who).toEqual([pm, uploader].sort());
    expect((await one<{ b: string }>(db, `SELECT body b FROM public.onboarding_notes WHERE task_id = '${approval}'`)).b).toBe("Sent back: Please redo the rug colors");
    const kinds = (await db.query<{ kind: string }>(`SELECT kind FROM public.onboarding_project_events ORDER BY kind`)).rows.map((x) => x.kind);
    expect(kinds).toEqual(["approval_sent_back", "task_reopened"]);
    expect((await one<{ a: string }>(db, `SELECT actor_id::text a FROM public.audit_log WHERE action = 'onboarding_approval_sent_back'`)).a).toBe(reviewer);
  });
  it("undo removes both functions", async () => {
    const db = await fresh();
    await db.exec(read("02_approval_send_back.undo.sql"));
    expect((await one<{ n: number }>(db, "SELECT count(*)::int n FROM pg_proc WHERE proname IN ('approval_task_reviewer','approval_task_send_back')")).n).toBe(0);
  });
});

describe("03 staff Opportunity Approve and outside lines", () => {
  it("item 5: Approve on a staff Opportunity for a Business Decision marks the Task approved, closes the approval and audits it", async () => {
    const db = await fresh();
    await as(db, owner);
    await db.exec(`SELECT public.respond_owner_opportunity('${opp}', 'decision', 'authorize', 'Go ahead')`);
    expect((await one<{ s: string }>(db, `SELECT owner_approval_status s FROM public.onboarding_tasks WHERE id = '${bdTask}'`)).s).toBe("approved");
    const a = await one<{ status: string; at: string | null }>(db, `SELECT status, decided_at::text at FROM public.approvals WHERE entity_id = '${bdTask}'`);
    expect(a.status).toBe("approved");
    expect(a.at).not.toBeNull();
    expect((await one<{ n: number }>(db, `SELECT count(*)::int n FROM public.audit_log WHERE action = 'owner_item_approved' AND entity_id = '${bdTask}'`)).n).toBe(1);
    const resp = await one<{ r: string }>(db, `SELECT owner_response->0->>'task_approval' r FROM public.work_items WHERE id = '${opp}'`);
    expect(resp.r).toBe("approved");
  });
  it("item 5: before 03, the same Approve left a Business Decision Task unapproved", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(`
      INSERT INTO public.owner_programs VALUES ('${prog}');
      INSERT INTO public.onboarding_tasks(id, property_id, title, owner_dependency, owner_approval_status) VALUES ('${bdTask}', '${home}', 'Choose', 'business_decision', 'not_required');
      INSERT INTO public.work_items(id, program_id, property_id, kind, status, source, source_task_id, title, response_types)
        VALUES ('${opp}', '${prog}', '${home}', 'opportunity', 'open', 'arha', '${bdTask}', 'Choose', '{decision}');`);
    await db.exec(read("live-capture/respond_owner_opportunity.sql").replace(/^--.*$/m, ""));
    await as(db, owner);
    await db.exec(`SELECT public.respond_owner_opportunity('${opp}', 'decision', 'authorize', 'Go ahead')`);
    expect((await one<{ s: string }>(db, `SELECT owner_approval_status s FROM public.onboarding_tasks WHERE id = '${bdTask}'`)).s).toBe("not_required");
  });
  it("item 5: a second Approve is refused once approved", async () => {
    const db = await fresh();
    await as(db, owner);
    await db.exec(`SELECT public.respond_owner_opportunity('${opp}', 'decision', 'authorize', null)`);
    await expect(db.exec(`SELECT public.respond_owner_opportunity('${opp}', 'decision', 'authorize', null)`)).rejects.toThrow("already answered");
  });
  it("item 2: plan cards and owner items of an outside-Resolve Task carry its place", async () => {
    const db = await fresh();
    await as(db, owner);
    const rows = (await db.query<{ source: string; item_id: string; where_code: string }>(`SELECT source, item_id::text, where_code FROM public.owner_outside_resolve_lines('${prog}') ORDER BY source`)).rows;
    expect(rows).toEqual([
      { source: "plan", item_id: plan, where_code: "docusign" },
      { source: "review", item_id: review, where_code: "docusign" },
    ]);
    await as(db, U(99));
    await expect(db.exec(`SELECT * FROM public.owner_outside_resolve_lines('${prog}')`)).rejects.toThrow("Not available");
  });
  it("undo restores the live respond_owner_opportunity and removes the outside reader", async () => {
    const db = await fresh();
    await db.exec(read("03_owner_approve_and_outside.undo.sql"));
    const src = (await one<{ s: string }>(db, "SELECT prosrc s FROM pg_proc WHERE proname = 'respond_owner_opportunity'")).s;
    expect(src.includes("owner_item_approved")).toBe(false);
    expect((await one<{ n: number }>(db, "SELECT count(*)::int n FROM pg_proc WHERE proname = 'owner_outside_resolve_lines'")).n).toBe(0);
  });
});
