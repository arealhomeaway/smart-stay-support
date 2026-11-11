// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/kati-tickets/01_kati_tickets.sql (Build 15, Kati's
 * help tickets 65 and 67; Emily, Nov 10). Tables are stubbed with the live column names and the
 * live completion guards. Fake people and records only.
 */
const DIR = "docs/pending/kati-tickets";
const DIRECTOR = "00000000-0000-4000-8000-0000000000a1";
const PM = "00000000-0000-4000-8000-0000000000a2";
const DESIGNER = "00000000-0000-4000-8000-0000000000a3";
const OUTSIDER = "00000000-0000-4000-8000-0000000000a4";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const LOCKED_HOME = "00000000-0000-4000-8000-0000000000b2";

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.staff(id uuid PRIMARY KEY, director boolean DEFAULT false);
INSERT INTO public.staff VALUES ('${DIRECTOR}', true), ('${PM}', false), ('${DESIGNER}', false);
CREATE FUNCTION private.is_onboarding_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=_u) $$;
CREATE FUNCTION private.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=_u) $$;
CREATE FUNCTION private.is_supervisor(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_onboarding_director(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE((SELECT director FROM public.staff WHERE id=_u), false) $$;
CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, handoff_accepted_at timestamptz, lifecycle_status text DEFAULT 'onboarding');
INSERT INTO public.properties VALUES ('${HOME}', NULL, 'onboarding'), ('${LOCKED_HOME}', now(), 'active_operations');
CREATE FUNCTION private.onboarding_work_locked(_p uuid[]) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.properties WHERE id = ANY(_p) AND (handoff_accepted_at IS NOT NULL OR lifecycle_status='handoff_requested')) $$;
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, status text DEFAULT 'active',
  project_manager uuid, director uuid, created_at timestamptz DEFAULT now());
INSERT INTO public.onboarding_projects(property_id, project_manager) VALUES ('${HOME}', '${PM}'), ('${LOCKED_HOME}', '${PM}');
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, stage text DEFAULT 'Pre-Close',
  title text, sort_order int DEFAULT 0, status text DEFAULT 'open', archived_at timestamptz, exception_at timestamptz,
  assigned_to uuid, owner_dependency text, requires_owner_approval boolean DEFAULT false, owner_approval_status text DEFAULT 'not_required',
  blocker text, template_task_id uuid, evidence_required boolean DEFAULT true, evidence_note text, completed_at timestamptz,
  completed_by uuid, is_demo boolean DEFAULT false);
CREATE FUNCTION public.owner_business_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='complete' AND (NEW.owner_dependency='business_decision' OR NEW.requires_owner_approval)
     AND NEW.owner_approval_status IS DISTINCT FROM 'approved' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'A homeowner decision is required before this Task can be completed.'; END IF;
  RETURN NEW; END $$;
CREATE TRIGGER owner_business_decision_completion_guard BEFORE UPDATE OF status ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.owner_business_decision_guard();
CREATE TABLE public.onboarding_step_review_settings(template_task_id uuid PRIMARY KEY, reviewer_roles text[]);
CREATE TABLE public.onboarding_task_reviews(task_id uuid, status text, submitted_at timestamptz DEFAULT now(), round int DEFAULT 1);
CREATE FUNCTION private.review_blocker(_t uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
CREATE TABLE public.onboarding_project_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, kind text, new_value text);
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, title text,
  original_filename text, upload_status text DEFAULT 'stored', deleted_at timestamptz, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_task_file_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, receiving_task_id uuid,
  source_task_id uuid, origin text CHECK (origin IN ('template','manual')), created_by uuid, created_at timestamptz DEFAULT now(),
  removed_at timestamptz, removed_by uuid);
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text, entity_type text,
  entity_id uuid, entity_label text, before_value jsonb, after_value jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.breezeway_people(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), breezeway_person_id bigint, first_name text,
  last_name text, active boolean DEFAULT true, is_integration_identity boolean DEFAULT false);
INSERT INTO public.breezeway_people(breezeway_person_id, first_name, last_name, active) VALUES (501, 'Field', 'Person', true), (502, 'Old', 'Person', false);
CREATE TABLE public.feature_flags(key text PRIMARY KEY, label text, description text, enabled boolean DEFAULT false);
`;

let db: PGlite;
const as = async (user: string | null) => {
  await db.query("DELETE FROM public.me");
  if (user) await db.query("INSERT INTO public.me VALUES ($1)", [user]);
};
const task = async (fields: Record<string, unknown>) => {
  const cols = Object.keys(fields);
  const r = await db.query(
    `INSERT INTO public.onboarding_tasks(${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`,
    Object.values(fields),
  );
  return r.rows[0].id as string;
};
const bulk = (ids: string[], note: string, doneOn: string | null = null, fileTask: string | null = null, dry = false, home = HOME) =>
  db.query("SELECT public.bulk_complete_onboarding_tasks($1, $2::uuid[], $3, $4::date, $5::uuid, $6) AS r", [home, ids, note, doneOn, fileTask, dry]);
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(`${DIR}/01_kati_tickets.sql`, "utf8"));
});

describe("bulk complete (ticket 65)", () => {
  it("five tasks with one shared note get the note, who, when and a Done before Resolve date", async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push(await task({ property_id: HOME, title: `Step ${i}`, sort_order: i }));
    await as(PM);
    const out = (await bulk(ids, "Signed copy is in the SharePoint home folder", "2026-11-02")).rows[0].r;
    expect(out.completed).toBe(5);
    const rows = (await db.query("SELECT status, evidence_note, completed_by, (completed_at AT TIME ZONE 'America/Chicago')::date::text AS d FROM public.onboarding_tasks ORDER BY sort_order")).rows;
    for (const r of rows) {
      expect(r.status).toBe("complete");
      expect(r.completed_by).toBe(PM);
      expect(r.d).toBe("2026-11-02");
      expect(r.evidence_note).toBe("Signed copy is in the SharePoint home folder\nDone before Resolve on 2026-11-02.");
    }
    const audit = (await db.query("SELECT count(*)::int n FROM public.audit_log WHERE action='onboarding_task_bulk_completed' AND actor_id=$1", [PM])).rows[0].n;
    expect(audit).toBe(5);
  });

  it("refuses a note under 5 characters with no file, and accepts one shared file instead", async () => {
    const a = await task({ property_id: HOME, title: "A" });
    const b = await task({ property_id: HOME, title: "B" });
    await as(PM);
    expect(await fails(bulk([a, b], "done"))).toContain("at least 5 characters");
    await db.query("INSERT INTO public.documents(entity_type, entity_id, title, original_filename) VALUES ('onboarding_task', $1, 'Signed', 'signed.pdf')", [a]);
    const out = (await bulk([a, b], "", null, a)).rows[0].r;
    expect(out.completed).toBe(2);
    const notes = (await db.query("SELECT evidence_note FROM public.onboarding_tasks ORDER BY title")).rows.map((r) => r.evidence_note);
    expect(notes).toEqual(["File: signed.pdf", "File: signed.pdf"]);
    const links = (await db.query("SELECT receiving_task_id, source_task_id FROM public.onboarding_task_file_links")).rows;
    expect(links).toEqual([{ receiving_task_id: b, source_task_id: a }]);
  });

  it("holds a task waiting on the homeowner and completes nothing in that batch", async () => {
    const a = await task({ property_id: HOME, title: "Ordinary" });
    const m = await task({ property_id: HOME, title: "Share the mood boards", requires_owner_approval: true, owner_approval_status: "not_required" });
    await as(DIRECTOR);
    const dry = (await bulk([a, m], "Shared by email on Nov 4", null, null, true)).rows[0].r;
    expect(dry.ready.map((x) => x.title)).toEqual(["Ordinary"]);
    expect(dry.held[0].reason).toBe("Needs the homeowner's approval first.");
    expect(await fails(bulk([a, m], "Shared by email on Nov 4"))).toContain("Untick these tasks first");
    expect((await db.query("SELECT count(*)::int n FROM public.onboarding_tasks WHERE status='complete'")).rows[0].n).toBe(0);
  });

  it("a teammate who is not a lead completes only their own tasks; outsiders and locked homes are refused", async () => {
    const mine = await task({ property_id: HOME, title: "Mine", assigned_to: DESIGNER });
    const theirs = await task({ property_id: HOME, title: "Theirs", assigned_to: PM });
    await as(DESIGNER);
    const dry = (await bulk([mine, theirs], "Photos are in the shared folder", null, null, true)).rows[0].r;
    expect(dry.held).toEqual([{ taskId: theirs, title: "Theirs", reason: "Not assigned to you." }]);
    await as(OUTSIDER);
    expect(await fails(bulk([mine], "Photos are in the shared folder"))).toContain("Onboarding staff access");
    const locked = await task({ property_id: LOCKED_HOME, title: "Locked" });
    await as(PM);
    expect(await fails(bulk([locked], "Photos are in the shared folder", null, null, false, LOCKED_HOME))).toContain("locked");
  });

  it("refuses a future Done before Resolve date and tasks from another home", async () => {
    const a = await task({ property_id: HOME, title: "A" });
    const other = await task({ property_id: LOCKED_HOME, title: "Other" });
    await as(PM);
    expect(await fails(bulk([a], "Proof is in the folder", "2099-01-01"))).toContain("not in the future");
    expect(await fails(bulk([a, other], "Proof is in the folder"))).toContain("not on this home");
  });
});

describe("Breezeway section on Work order tasks (ticket 67)", () => {
  const save = (t: string, date: string | null, choice: string | null, person: number | null, ref: string | null) =>
    db.query("SELECT public.save_onboarding_task_breezeway($1, $2::date, $3, $4::bigint, $5) AS r", [t, date, choice, person, ref]);

  it("saves a date, an assignee choice and a pasted link, with add only history", async () => {
    const wo = await task({ property_id: HOME, title: "Work order: Pick up keys from the post office" });
    await as(PM);
    let r = (await save(wo, "2026-11-12", "unassigned", null, "")).rows[0].r;
    expect(r.assignee_choice).toBe("unassigned");
    expect(r.breezeway_task_id).toBeNull();
    r = (await save(wo, "2026-11-12", "person", 501, "https://app.breezeway.io/task/98765")).rows[0].r;
    expect(r.assignee_name).toBe("Field Person");
    expect(Number(r.breezeway_task_id)).toBe(98765);
    r = (await save(wo, "2026-11-13", "person", 501, "#98765")).rows[0].r;
    expect(r.breezeway_url).toBeNull();
    expect((await db.query("SELECT count(*)::int n FROM public.onboarding_task_breezeway_events")).rows[0].n).toBe(3);
    expect(await fails(db.query("DELETE FROM public.onboarding_task_breezeway_events"))).toContain("kept as it was recorded");
  });

  it("refuses non Work order tasks, bad links, inactive people and a task linked twice", async () => {
    const plain = await task({ property_id: HOME, title: "Create the OwnerRez property" });
    const wo1 = await task({ property_id: HOME, title: "Work order: Repair & Improvement Estimates" });
    const wo2 = await task({ property_id: HOME, title: "Work order: Meet the furniture delivery" });
    await as(PM);
    expect(await fails(save(plain, null, null, null, "123"))).toContain("Only Work order tasks");
    expect(await fails(save(wo1, null, null, null, "https://example.com/task/1"))).toContain("Paste the Breezeway task number");
    expect(await fails(save(wo1, null, "person", 502, null))).toContain("not active in Breezeway");
    await save(wo1, null, null, null, "4444");
    expect(await fails(save(wo2, null, null, null, "4444"))).toContain("already linked");
    await as(OUTSIDER);
    expect(await fails(save(wo1, null, null, null, "4444"))).toContain("Onboarding staff access");
  });

  it("the Send to Breezeway switch is added and off", async () => {
    const r = (await db.query("SELECT enabled FROM public.feature_flags WHERE key='onboarding_breezeway_send'")).rows;
    expect(r).toEqual([{ enabled: false }]);
  });
});

describe("staged files", () => {
  it("plan version 5 is staged only, never in the applied migrations", () => {
    const v5 = readFileSync(`${DIR}/02_standard_plan_v5.sql`, "utf8");
    expect(v5).toContain("STAGED, NOT APPLIED");
    expect(v5).toContain("Share the mood boards with the owner");
    expect(v5).toContain("Share the floor plans with the owner");
    const applied = readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8"));
    expect(applied.some((sql) => sql.includes("Share the floor plans with the owner"))).toBe(false);
  });
});
