// Owner Opportunities and Task Drawer (Nov 11): staged files 01 to 04 run on an isolated PostgreSQL copy built
// from the live table shapes and the live function text captured in live-capture/. Nothing here touches the real database.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/owner-opps-drawer";
const read = (p: string) => readFileSync(p, "utf8");
const live = (f: string) => read(`${DIR}/live-capture/${f}.sql`);
const F01 = read(`${DIR}/01_library_cards.sql`), U01 = read(`${DIR}/01_library_cards.undo.sql`);
const F02 = read(`${DIR}/02_portal_plan_and_once_per_owner.sql`), U02 = read(`${DIR}/02_portal_plan_and_once_per_owner.undo.sql`);
const F03 = read(`${DIR}/03_owner_notice_wording.sql`), U03 = read(`${DIR}/03_owner_notice_wording.undo.sql`);
const F04 = read(`${DIR}/04_task_started_and_draft_work_orders.sql`), U04 = read(`${DIR}/04_task_started_and_draft_work_orders.undo.sql`);
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = "98bd6696-4018-4965-b645-0471c5ae3925";
const owner = U(1), other = U(2), pm = U(3), stranger = U(4);
const h1 = U(11), h2 = U(12), prog = U(21);

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE TABLE public.admins(id uuid PRIMARY KEY);
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $2='admin' AND EXISTS(SELECT 1 FROM public.admins WHERE id=$1) $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.admins WHERE id=$1) OR $1='${pm}' $$;
CREATE FUNCTION private.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 IN ('${pm}','${stranger}') $$;
CREATE FUNCTION private.is_supervisor(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.onboarding_work_locked(uuid[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
-- An owner may act on both homes of the program; the other owner on none.
CREATE FUNCTION private.owner_current_property_for_actor(uuid, uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='${owner}' $$;

CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text, entity_type text,
  entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.owner_opportunity_library(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, summary text NOT NULL DEFAULT '',
  what text NOT NULL DEFAULT '', why text NOT NULL DEFAULT '', how text NOT NULL DEFAULT '', ways_to_document text NOT NULL DEFAULT '',
  suggested_minutes int, category text NOT NULL DEFAULT 'research', image_key text NOT NULL DEFAULT 'research', active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ao_library_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version int NOT NULL DEFAULT 1, title text NOT NULL,
  what_text text NOT NULL DEFAULT '', why_text text NOT NULL DEFAULT '', how_text text NOT NULL DEFAULT '', required_output text NOT NULL DEFAULT '',
  documentation_note text NOT NULL DEFAULT '', est_hours_min numeric, est_hours_max numeric,
  lane text NOT NULL CHECK (lane IN ('critical','launch','flexible','triggered')),
  stage_window text NOT NULL CHECK (stage_window IN ('onboarding_early','onboarding_launch','anytime','operations')),
  team_needs_this boolean NOT NULL DEFAULT false, lock_rule text NOT NULL DEFAULT 'none' CHECK (lock_rule IN ('none','until_linked_step_done')),
  linked_template_task_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[], code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','released','retired')), card_group text NOT NULL DEFAULT '',
  event_triggered boolean NOT NULL DEFAULT false, opens_text text NOT NULL DEFAULT '', deadline_text text NOT NULL DEFAULT '',
  deadline_business_days int, deadline_calendar_days int,
  cutoff_rule text NOT NULL DEFAULT 'next_business_day_9am' CHECK (cutoff_rule IN ('next_business_day_9am','none')),
  cutoff_business_days int NOT NULL DEFAULT 1, takeover_text text NOT NULL DEFAULT '', output_fields jsonb NOT NULL DEFAULT '[]',
  retired_at timestamptz, updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ao_library_card_history(id bigserial PRIMARY KEY, card_id uuid NOT NULL, version int NOT NULL, snapshot jsonb NOT NULL,
  changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ao_home_plan_settings(property_id uuid PRIMARY KEY, automated boolean NOT NULL DEFAULT false);
CREATE TABLE public.ao_home_plan_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, program_id uuid, card_id uuid,
  card_version int, join_outcome text, owner_review_id uuid, linked_task_id uuid, unlocked_at timestamptz, unlocked_by uuid,
  deadline_at timestamptz, reminder_at timestamptz, cutoff_at timestamptz, reminder_sent_at timestamptz, expired_at timestamptz,
  owner_completed_at timestamptz, created_at timestamptz DEFAULT now(), covered_reason text, covered_source text, covered_item_id uuid);
CREATE TABLE public.ao_contributions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_card_id uuid, property_id uuid, program_id uuid,
  card_id uuid, submitted_by uuid, field_values jsonb, submitted_at timestamptz DEFAULT now());
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text, responded_at timestamptz, updated_at timestamptz);
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, status text DEFAULT 'active',
  project_manager uuid, director uuid, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, title text, status text DEFAULT 'open',
  assigned_to uuid, archived_at timestamptz);
`;

const RETIRED = ["Build a local area & dining guide", "Research seasonal events & demand drivers", "Research comparable furnished rentals",
  "Review listing positioning", "Review your property's guest journey"];
const UNIQUE = ["Create house notes for future guests", "Property & market education", "Research remote-work amenities"];
const ONCE = ["N05", "N06", "N07", "N08", "N12", "P16", "P17", "P18"];

async function fresh() {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(`CREATE FUNCTION private.ao_is_editor(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT _uid IS NOT NULL AND (public.has_role(_uid,'admin') OR public.is_onboarding_director(_uid)) $$;`);
  await db.exec(live("ao_card_set_status") + ";");
  await db.exec(live("ao_submit_card") + ";");
  await db.exec(`INSERT INTO public.admins VALUES ('${ADMIN}');`);
  for (const [i, t] of [...RETIRED, ...UNIQUE].entries())
    await db.query(`INSERT INTO public.owner_opportunity_library(title, what, why, how, ways_to_document, sort_order) VALUES ($1, $2, 'why', 'how', 'notes', $3)`,
      [t, `what ${t}`, i]);
  for (const c of [...ONCE, "N13", "P09", "A33"])
    await db.query(`INSERT INTO public.ao_library_cards(code, title, lane, stage_window, status) VALUES ($1, $1, $2, $3, 'released')`,
      [c, c === "A33" ? "triggered" : "flexible", c === "A33" ? "operations" : "anytime"]);
  return db;
}
const one = async <T,>(db: PGlite, sql: string) => (await db.query<T>(sql)).rows[0] as T;

describe("staged 01: library cards", () => {
  let db: PGlite;
  beforeAll(async () => { db = await fresh(); await db.exec(F01); });

  it("retires the five repeating Optional Library cards, keeps them and records each", async () => {
    const rows = (await db.query<{ title: string; active: boolean }>(`SELECT title, active FROM public.owner_opportunity_library ORDER BY sort_order`)).rows;
    expect(rows.filter((r) => !r.active).map((r) => r.title).sort()).toEqual([...RETIRED].sort());
    expect(rows.filter((r) => r.active).map((r) => r.title).sort()).toEqual([...UNIQUE].sort());
    expect(rows.length).toBe(8);
    const audit = await one<{ n: number }>(db, `SELECT count(*)::int n FROM public.audit_log WHERE action='owner_library_retired' AND actor_id='${ADMIN}'`);
    expect(audit.n).toBe(5);
  });

  it("adds the three unique ones as released anytime cards with history and no hour estimate", async () => {
    const cards = (await db.query<{ code: string; title: string; status: string; stage_window: string; est_hours_min: unknown; versions: number }>(
      `SELECT c.code, c.title, c.status, c.stage_window, c.est_hours_min, (SELECT count(*)::int FROM public.ao_library_card_history h WHERE h.card_id=c.id AND h.changed_by='${ADMIN}') versions
         FROM public.ao_library_cards c WHERE c.code IN ('N15','N16','N17') ORDER BY c.code`)).rows;
    expect(cards.map((c) => c.title)).toEqual(UNIQUE);
    for (const c of cards) {
      expect(c.status).toBe("released");
      expect(c.stage_window).toBe("anytime");
      expect(c.est_hours_min).toBeNull();
      expect(c.versions).toBe(2);
    }
  });

  it("marks exactly the eight market and relationship cards once per owner, each with a history row", async () => {
    const marked = (await db.query<{ code: string }>(`SELECT code FROM public.ao_library_cards WHERE once_per_owner ORDER BY code`)).rows.map((r) => r.code);
    expect(marked).toEqual(ONCE);
    const hist = await one<{ n: number }>(db, `SELECT count(*)::int n FROM public.ao_library_card_history h JOIN public.ao_library_cards c ON c.id=h.card_id WHERE c.code = ANY('{${ONCE.join(",")}}')`);
    expect(hist.n).toBe(8);
  });

  it("a repeat changes nothing", async () => {
    const before = await one<{ a: number; h: number; v: number }>(db, `SELECT (SELECT count(*)::int FROM public.audit_log) a, (SELECT count(*)::int FROM public.ao_library_card_history) h, (SELECT sum(version)::int FROM public.ao_library_cards) v`);
    await db.exec(F01);
    const after = await one<{ a: number; h: number; v: number }>(db, `SELECT (SELECT count(*)::int FROM public.audit_log) a, (SELECT count(*)::int FROM public.ao_library_card_history) h, (SELECT sum(version)::int FROM public.ao_library_cards) v`);
    expect(after).toEqual(before);
  });

  it("undo brings the five back from the receipts, retires the three added cards and clears once per owner; nothing deleted", async () => {
    await db.exec(U01);
    const inactive = await one<{ n: number }>(db, `SELECT count(*)::int n FROM public.owner_opportunity_library WHERE NOT active`);
    expect(inactive.n).toBe(0);
    const added = (await db.query<{ status: string }>(`SELECT status FROM public.ao_library_cards WHERE code IN ('N15','N16','N17')`)).rows;
    expect(added.map((r) => r.status)).toEqual(["retired", "retired", "retired"]);
    const once = await one<{ n: number }>(db, `SELECT count(*)::int n FROM public.ao_library_cards WHERE once_per_owner`);
    expect(once.n).toBe(0);
    const total = await one<{ n: number }>(db, `SELECT count(*)::int n FROM public.owner_opportunity_library`);
    expect(total.n).toBe(8);
  });
});

describe("staged 02: one answer completes every home's copy of a once per owner card", () => {
  let db: PGlite;
  const setup = async () => {
    db = await fresh();
    await db.exec(F01);
    await db.exec(F02);
    await db.exec(`INSERT INTO public.ao_home_plan_settings VALUES ('${h1}', true), ('${h2}', true);`);
    for (const [code, home, n] of [["N05", h1, 1], ["N05", h2, 2], ["N13", h1, 3], ["N13", h2, 4]] as const) {
      await db.exec(`INSERT INTO public.owner_reviews(id, status) VALUES ('${U(100 + n)}', 'awaiting_owner');
        INSERT INTO public.ao_home_plan_cards(id, property_id, program_id, card_id, join_outcome, owner_review_id, unlocked_at)
        SELECT '${U(200 + n)}', '${home}', '${prog}', id, 'open', '${U(100 + n)}', now() FROM public.ao_library_cards WHERE code='${code}';`);
    }
  };
  const as = (uid: string) => db.exec(`SELECT set_config('request.jwt.claim.sub', '${uid}', false);`);

  it("answering N05 on one home completes the other home's N05 too, each with its own record", async () => {
    await setup();
    await as(owner);
    await db.query(`SELECT public.ao_submit_card($1, '{"notes":"x"}'::jsonb)`, [U(201)]);
    const done = (await db.query<{ id: string }>(`SELECT id FROM public.ao_home_plan_cards WHERE owner_completed_at IS NOT NULL ORDER BY id`)).rows.map((r) => r.id);
    expect(done).toEqual([U(201), U(202)]);
    const contributions = await one<{ n: number }>(db, `SELECT count(*)::int n FROM public.ao_contributions`);
    expect(contributions.n).toBe(2);
    const answered = (await db.query<{ id: string }>(`SELECT id FROM public.owner_reviews WHERE status='answered' ORDER BY id`)).rows.map((r) => r.id);
    expect(answered).toEqual([U(101), U(102)]);
  });

  it("a card that is not once per owner completes only its own home", async () => {
    await db.query(`SELECT public.ao_submit_card($1, '{"notes":"y"}'::jsonb)`, [U(203)]);
    const n13 = (await db.query<{ id: string; done: boolean }>(`SELECT id, owner_completed_at IS NOT NULL done FROM public.ao_home_plan_cards WHERE id IN ('${U(203)}','${U(204)}') ORDER BY id`)).rows;
    expect(n13).toEqual([{ id: U(203), done: true }, { id: U(204), done: false }]);
  });

  it("another owner is still refused", async () => {
    await as(other);
    await expect(db.query(`SELECT public.ao_submit_card($1, '{}'::jsonb)`, [U(204)])).rejects.toThrow(/Not allowed/);
  });

  it("the portal read returns the stage window, the owner item and once per owner", async () => {
    await as(owner);
    const rows = (await db.query<{ code: string; stage_window: string; owner_review_id: string; once_per_owner: boolean }>(
      `SELECT code, stage_window, owner_review_id, once_per_owner FROM public.ao_owner_portal_plan('${prog}') ORDER BY code, owner_review_id`)).rows;
    expect(rows.length).toBe(4);
    expect(rows[0]).toEqual({ code: "N05", stage_window: "anytime", owner_review_id: U(101), once_per_owner: true });
    expect(rows[2]!.once_per_owner).toBe(false);
  });

  it("undo puts ao_submit_card back exactly and removes the new read", async () => {
    await db.exec(U02);
    const def = await one<{ d: string }>(db, `SELECT pg_get_functiondef('public.ao_submit_card(uuid,jsonb)'::regprocedure) d`);
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    expect(norm(def.d)).toBe(norm(live("ao_submit_card")));
    const gone = await one<{ n: number }>(db, `SELECT count(*)::int n FROM pg_proc WHERE proname='ao_owner_portal_plan'`);
    expect(gone.n).toBe(0);
  });
});

describe("staged 03: notice wording", () => {
  it("only the three Active Owner notice kinds change; every other line is the live text", () => {
    const before = live("read_owner_participation");
    const body = F03.slice(F03.indexOf("CREATE OR REPLACE FUNCTION"));
    const restored = body
      .replace("'opportunity_sent','ao_plan_ready','ao_daily','ao_home_live')", "'opportunity_sent')")
      .replace("\n    WHEN 'ao_plan_ready' THEN n.title WHEN 'ao_daily' THEN n.title WHEN 'ao_home_live' THEN n.title", "")
      .replace("CASE WHEN n.kind IN('opportunity_sent','ao_plan_ready','ao_daily','ao_home_live') THEN n.body", "CASE WHEN n.kind='opportunity_sent' THEN n.body");
    expect(restored.trim().replace(/;$/, "")).toBe(before.trim());
    expect(body).toContain("WHEN 'ao_plan_ready' THEN n.title");
    expect(body).toContain("WHEN 'ao_daily' THEN n.title");
    expect(body).toContain("WHEN 'ao_home_live' THEN n.title");
  });
  it("undo is the live text exactly", () => {
    expect(U03.slice(U03.indexOf("CREATE OR REPLACE")).trim().replace(/;$/, "")).toBe(live("read_owner_participation").trim());
  });
});

describe("staged 04: Mark as started and Draft work order", () => {
  let db: PGlite;
  const task = U(301);
  beforeAll(async () => {
    db = await fresh();
    await db.exec(`INSERT INTO public.onboarding_projects(property_id, project_manager) VALUES ('${h1}', '${U(9)}');
      INSERT INTO public.onboarding_tasks(id, property_id, title, assigned_to) VALUES ('${task}', '${h1}', 'Draft work order: hang art', '${pm}');`);
    // Only the started part runs here; the Breezeway save function needs the full Breezeway tables.
    await db.exec(F04.slice(0, F04.indexOf("CREATE OR REPLACE FUNCTION public.save_onboarding_task_breezeway")));
  });
  const as = (uid: string) => db.exec(`SELECT set_config('request.jwt.claim.sub', '${uid}', false);`);

  it("the person working the Task marks it started once, recorded with who and when", async () => {
    await as(pm);
    const r = await one<{ j: { changed: boolean } }>(db, `SELECT public.mark_onboarding_task_started('${task}') j`);
    expect(r.j.changed).toBe(true);
    const again = await one<{ j: { changed: boolean } }>(db, `SELECT public.mark_onboarding_task_started('${task}') j`);
    expect(again.j.changed).toBe(false);
    const row = await one<{ by: string; status: string; set: boolean }>(db, `SELECT started_by by, status, started_at IS NOT NULL set FROM public.onboarding_tasks WHERE id='${task}'`);
    expect(row).toEqual({ by: pm, status: "open", set: true });
    const audit = await one<{ n: number }>(db, `SELECT count(*)::int n FROM public.audit_log WHERE action='onboarding_task_started' AND actor_id='${pm}'`);
    expect(audit.n).toBe(1);
  });

  it("someone not on the Task is refused", async () => {
    await as(stranger);
    await expect(db.query(`SELECT public.mark_onboarding_task_started('${task}')`)).rejects.toThrow(/not assigned to you/);
  });

  it("the Breezeway save accepts both title forms and changes nothing else", () => {
    const before = live("save_onboarding_task_breezeway");
    const after = F04.slice(F04.indexOf("CREATE OR REPLACE FUNCTION public.save_onboarding_task_breezeway")).trim().replace(/;$/, "");
    expect(after.replace("'^\\s*(draft\\s+)?work order\\s*:'", "'^\\s*work order\\s*:'")).toBe(before.trim());
    const re = /^\s*(draft\s+)?work order\s*:/i;
    expect(re.test("Draft work order: hang art")).toBe(true);
    expect(re.test("Work order: Pick up keys")).toBe(true);
    expect(re.test("Review and approve every Breezeway work order")).toBe(false);
    expect(U04).toContain(before.trim());
  });
});
