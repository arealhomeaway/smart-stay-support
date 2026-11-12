// Nov 12 build: staged files in docs/pending/onboarding-kinds run on an isolated PostgreSQL copy
// (PGlite) built from the live table shapes. Nothing here touches the real database.
import { describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/onboarding-kinds";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = U(1), assignee = U(2), pm = U(3), director = U(4), follower = U(5), staff = U(6);
const home = U(11), prog = U(21), task = U(31), task2 = U(32), review = U(41), review2 = U(42), step = U(51);

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $2 = '${owner}' $$;
CREATE FUNCTION private.is_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 IN ('${assignee}','${pm}','${director}','${follower}','${staff}') $$;
CREATE FUNCTION public.seat_holder(text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT CASE WHEN $1 = 'onboarding_director' THEN '${director}'::uuid END $$;
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text, entity_type text,
  entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY, status text DEFAULT 'active', archived_at timestamptz);
CREATE TABLE public.onboarding_template_tasks(id uuid PRIMARY KEY, title text);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, title text, template_task_id uuid,
  requires_owner_approval boolean DEFAULT false, owner_dependency text, owner_approval_status text DEFAULT 'pending',
  assigned_to uuid, status text DEFAULT 'open', updated_at timestamptz DEFAULT now());
CREATE FUNCTION public.touch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := '2000-01-01'; RETURN NEW; END $$;
CREATE TRIGGER onboarding_tasks_updated BEFORE UPDATE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.touch();
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, status text, project_manager uuid);
CREATE TABLE public.onboarding_follows(user_id uuid, property_id uuid, created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY, program_id uuid, property_id uuid, title text, status text, archived_at timestamptz,
  onboarding_task_id uuid, is_demo boolean DEFAULT false, owner_decision text, responded_at timestamptz, updated_at timestamptz);
CREATE TABLE public.owner_item_task_sends(review_id uuid PRIMARY KEY, task_id uuid);
CREATE TABLE public.owner_request_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid, property_id uuid, program_id uuid,
  task_id uuid, author_id uuid, author_type text, author_name text, event text, body text, is_demo boolean, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text,
  entity_type text, entity_id uuid, link_path text, priority text, email_status text, is_demo boolean);
CREATE TABLE public.approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, status text,
  decided_at timestamptz, responded_at timestamptz, decision_note text);
`;

async function fresh() {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(`
    INSERT INTO public.profiles VALUES ('${owner}', 'Ana Owner');
    INSERT INTO public.owner_programs(id) VALUES ('${prog}');
    INSERT INTO public.onboarding_template_tasks VALUES ('${step}', 'Email the owner');
    INSERT INTO public.onboarding_tasks(id, property_id, title, requires_owner_approval, assigned_to)
      VALUES ('${task}', '${home}', 'Approve the budget', true, '${assignee}'),
             ('${task2}', '${home}', 'Share the design', false, NULL),
             (gen_random_uuid(), '${home}', 'Draft work order: Paint', false, NULL),
             (gen_random_uuid(), '${home}', 'Pick a cleaner', false, NULL);
    INSERT INTO public.onboarding_projects(property_id, status, project_manager) VALUES ('${home}', 'active', '${pm}');
    INSERT INTO public.onboarding_follows(user_id, property_id) VALUES ('${follower}', '${home}');
    INSERT INTO public.owner_reviews(id, program_id, property_id, title, status) VALUES
      ('${review}', '${prog}', '${home}', 'Approve the budget', 'awaiting_owner'),
      ('${review2}', '${prog}', '${home}', 'Share the design', 'awaiting_owner');
    INSERT INTO public.owner_item_task_sends VALUES ('${review}', '${task}'), ('${review2}', '${task2}');
    INSERT INTO public.approvals(entity_type, entity_id, status) VALUES ('onboarding_task', '${task}', 'pending');
  `);
  await db.exec(read("01_task_kinds.sql"));
  await db.exec(read("02_owner_items.sql"));
  return db;
}
const as = (db: PGlite, uid: string) => db.exec(`SELECT set_config('request.jwt.claim.sub', '${uid}', false)`);
const one = async <T,>(db: PGlite, sql: string) => (await db.query<T>(sql)).rows[0] as T;

describe("01 task kinds", () => {
  it("backfills only the approved rule and leaves updated times alone", async () => {
    const db = await fresh();
    const rows = (await db.query<{ title: string; task_kind: string; updated_at: string }>(
      "SELECT title, task_kind, updated_at::text FROM public.onboarding_tasks ORDER BY title")).rows;
    const by = Object.fromEntries(rows.map((r) => [r.title, r.task_kind]));
    expect(by["Approve the budget"]).toBe("send_to_owner");
    expect(by["Draft work order: Paint"]).toBe("work_order");
    expect(by["Pick a cleaner"]).toBe("do_it");
    expect(rows.every((r) => !r.updated_at.startsWith("2000"))).toBe(true);
  });
  it("a new Task copies its step's kind and settings", async () => {
    const db = await fresh();
    await db.exec(`UPDATE public.onboarding_template_tasks SET task_kind = 'email', kind_settings = '{"emailTemplateId":"x"}' WHERE id = '${step}'`);
    await db.exec(`INSERT INTO public.onboarding_tasks(property_id, title, template_task_id) VALUES ('${home}', 'Email the owner', '${step}')`);
    const r = await one<{ task_kind: string; s: string }>(db, `SELECT task_kind, kind_settings->>'emailTemplateId' s FROM public.onboarding_tasks WHERE template_task_id = '${step}'`);
    expect(r).toEqual({ task_kind: "email", s: "x" });
  });
  it("undo removes the copy trigger and value rules", async () => {
    const db = await fresh();
    await db.exec(read("01_task_kinds.undo.sql"));
    const n = await one<{ n: number }>(db, "SELECT count(*)::int n FROM pg_trigger WHERE tgname = 'onboarding_task_kind_from_step'");
    expect(n.n).toBe(0);
  });
});

describe("02 owner items", () => {
  it("fix 24: Approve records the approval on the Task and the owner item with time and posts Approved", async () => {
    const db = await fresh();
    await as(db, owner);
    await db.exec(`SELECT public.owner_item_approve('${review}')`);
    const t = await one<{ s: string }>(db, `SELECT owner_approval_status s FROM public.onboarding_tasks WHERE id = '${task}'`);
    const r = await one<{ d: string; at: string | null; status: string }>(db, `SELECT owner_decision d, responded_at::text at, status FROM public.owner_reviews WHERE id = '${review}'`);
    const a = await one<{ status: string; at: string | null }>(db, `SELECT status, decided_at::text at FROM public.approvals WHERE entity_id = '${task}'`);
    const m = await one<{ body: string; author_type: string }>(db, `SELECT body, author_type FROM public.owner_request_messages WHERE review_id = '${review}'`);
    expect(t.s).toBe("approved");
    expect(r.d).toBe("approved");
    expect(r.at).not.toBeNull();
    expect(a.status).toBe("approved");
    expect(a.at).not.toBeNull();
    expect(m).toEqual({ body: "Approved", author_type: "homeowner" });
    expect(r.status).toBe("answered");
  });
  it("fix 24: Approve is refused on an item that does not ask for an approval", async () => {
    const db = await fresh();
    await as(db, owner);
    await expect(db.exec(`SELECT public.owner_item_approve('${review2}')`)).rejects.toThrow("does not ask for an approval");
    expect((await one<{ b: boolean }>(db, `SELECT public.owner_item_is_approval('${review}') b`)).b).toBe(true);
    expect((await one<{ b: boolean }>(db, `SELECT public.owner_item_is_approval('${review2}') b`)).b).toBe(false);
  });
  it("fix 25: an owner reply moves the item to answered; a staff reply moves it back", async () => {
    const db = await fresh();
    await as(db, owner);
    await db.exec(`SELECT public.owner_item_reply('${review2}', 'Looks good to me')`);
    expect((await one<{ s: string }>(db, `SELECT status s FROM public.owner_reviews WHERE id = '${review2}'`)).s).toBe("answered");
    await db.exec(`INSERT INTO public.owner_request_messages(review_id, author_type, body) VALUES ('${review2}', 'staff', 'Thanks, one more question')`);
    expect((await one<{ s: string }>(db, `SELECT status s FROM public.owner_reviews WHERE id = '${review2}'`)).s).toBe("awaiting_owner");
  });
  it("fix 26: a reply notifies the assigned person and followers", async () => {
    const db = await fresh();
    await as(db, owner);
    await db.exec(`SELECT public.owner_item_reply('${review}', 'A question about line 4')`);
    const ids = (await db.query<{ user_id: string }>(`SELECT user_id FROM public.staff_notifications WHERE entity_id = '${review}' ORDER BY user_id`)).rows.map((r) => r.user_id);
    expect(ids).toEqual([assignee, follower].sort());
  });
  it("fix 26: unassigned, it notifies the Project Manager, the Director of Onboarding and followers", async () => {
    const db = await fresh();
    await as(db, owner);
    await db.exec(`SELECT public.owner_item_reply('${review2}', 'A question')`);
    const ids = (await db.query<{ user_id: string }>(`SELECT user_id FROM public.staff_notifications WHERE entity_id = '${review2}' ORDER BY user_id`)).rows.map((r) => r.user_id);
    expect(ids).toEqual([pm, director, follower].sort());
  });
  it("undo restores the live reply and removes the new functions", async () => {
    const db = await fresh();
    await db.exec(read("02_owner_items.undo.sql"));
    const n = await one<{ n: number }>(db, "SELECT count(*)::int n FROM pg_proc WHERE proname IN ('owner_item_approve','owner_item_is_approval','owner_item_recipients','owner_item_notify','owner_item_status_follow')");
    expect(n.n).toBe(0);
  });
});
