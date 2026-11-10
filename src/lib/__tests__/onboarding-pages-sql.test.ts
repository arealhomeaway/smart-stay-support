// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/onboarding-pages/01_onboarding_project_fields.sql
 * (Build 11; register O1, O3, O4, A16; Emily, Nov 10). Tables are stubbed with the live column
 * names and the live update rule. Nothing touches the real database.
 */
const DIR = "docs/pending/onboarding-pages";
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const DIRECTOR = "00000000-0000-4000-8000-0000000000d1";
const PM = "00000000-0000-4000-8000-0000000000b1";
const OTHER_PM = "00000000-0000-4000-8000-0000000000b2";
const UTILITIES = "00000000-0000-4000-8000-0000000000e1";
const SUPERVISOR = "00000000-0000-4000-8000-0000000000f1";
const COORD = "00000000-0000-4000-8000-0000000000c1";
const HOME = "00000000-0000-4000-8000-000000000101";
const PROJECT = "00000000-0000-4000-8000-000000000201";

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, private, auth TO authenticated;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','onboarding');
CREATE TABLE public.me(id uuid);
GRANT SELECT ON public.me TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
GRANT SELECT ON public.user_roles TO authenticated;
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${DIRECTOR}','onboarding'), ('${PM}','onboarding'),
  ('${OTHER_PM}','onboarding'), ('${UTILITIES}','onboarding'), ('${SUPERVISOR}','manager'), ('${COORD}','tech');
CREATE TABLE public.functional_roles(code text, current_seat_holder uuid);
INSERT INTO public.functional_roles VALUES ('onboarding_director', '${DIRECTOR}');
CREATE FUNCTION public.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
CREATE FUNCTION public.is_onboarding_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text IN ('admin','manager','onboarding')) $$;
CREATE FUNCTION public.is_supervisor(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text IN ('admin','manager')) $$;
CREATE FUNCTION public.is_internal_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id) $$;
CREATE FUNCTION public.is_onboarding_director(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.functional_roles WHERE code IN ('onboarding_director','director_onboarding') AND current_seat_holder=_user_id) $$;
CREATE FUNCTION private.can_assign_onboarding_responsibility(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT public.is_onboarding_director(_u) OR public.has_role(_u,'admin') $$;
CREATE TABLE public.synthetic(id uuid);
CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.synthetic WHERE id = auth.uid()) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, private TO authenticated;

CREATE TABLE public.properties(id uuid PRIMARY KEY, name text, is_demo boolean NOT NULL DEFAULT false, handoff_accepted_at timestamptz);
INSERT INTO public.properties VALUES ('${HOME}', '1399 Foxtail Ln', false, NULL);
CREATE FUNCTION public.format_property_label(_h jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS
  $$ SELECT jsonb_build_object('primary', _h->>'name') $$;
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY, property_id uuid NOT NULL, status text NOT NULL DEFAULT 'active',
  project_manager uuid, director uuid, target_handoff_on date, handoff_state text NOT NULL DEFAULT 'in_progress',
  ops_accepted_at timestamptz, is_demo boolean NOT NULL DEFAULT false, updated_at timestamptz DEFAULT now());
INSERT INTO public.onboarding_projects(id, property_id, project_manager, director, target_handoff_on)
  VALUES ('${PROJECT}', '${HOME}', '${PM}', '${DIRECTOR}', '2026-11-20');
GRANT SELECT, INSERT, UPDATE ON public.onboarding_projects TO authenticated;
ALTER TABLE public.onboarding_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY read ON public.onboarding_projects FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY upd ON public.onboarding_projects FOR UPDATE TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) AND (public.is_supervisor(auth.uid()) OR project_manager = auth.uid()
    OR director = auth.uid() OR private.can_assign_onboarding_responsibility(auth.uid())))
  WITH CHECK (public.is_onboarding_staff(auth.uid()) AND (public.is_supervisor(auth.uid()) OR project_manager = auth.uid()
    OR director = auth.uid() OR private.can_assign_onboarding_responsibility(auth.uid())));
CREATE TABLE public.onboarding_project_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, property_id uuid,
  kind text NOT NULL, summary text NOT NULL, detail text, prior_value text, new_value text, actor uuid, is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.onboarding_project_events TO authenticated;
ALTER TABLE public.onboarding_project_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY r ON public.onboarding_project_events FOR SELECT TO authenticated USING (true);
CREATE POLICY w ON public.onboarding_project_events FOR INSERT TO authenticated
  WITH CHECK (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text,
  CONSTRAINT documents_category_chk CHECK ((category IS NULL) OR (category = ANY (ARRAY['pma'::text, 'insurance'::text,
  'ownership'::text, 'hoa'::text, 'covenants'::text, 'permit_license'::text, 'compliance'::text, 'manual'::text,
  'hvac_doc'::text, 'warranty'::text, 'equipment'::text, 'access_security'::text, 'measurements'::text, 'design'::text,
  'onboarding_evidence'::text, 'assessment'::text, 'operations'::text, 'maintenance'::text, 'media'::text,
  'reference'::text, 'other'::text]))));
CREATE TABLE public.handoff_reminders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, property_id uuid,
  handoff_on date NOT NULL, kind text NOT NULL, sent_on date, recipients uuid[],
  CONSTRAINT handoff_reminders_once UNIQUE (project_id, handoff_on, kind));
CREATE FUNCTION public.seat_holder_at(_code text, _at timestamptz) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT CASE _code WHEN 'ops_supervisor' THEN '${SUPERVISOR}'::uuid ELSE '${ADMIN}'::uuid END $$;
CREATE TABLE public.sent(who uuid, title text, body text);
CREATE FUNCTION public.notify_staff(_who uuid, _kind text, _title text, _body text, _et text, _eid uuid, _link text,
  _p text, _x text, _a boolean, _b boolean) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.sent VALUES (_who, _title, _body) $$;
`;

async function db() {
  const pg = new PGlite();
  await pg.exec(STUBS);
  await pg.exec(readFileSync(`${DIR}/before_run_handoff_reminders.sql`, "utf8"));
  await pg.exec(readFileSync(`${DIR}/01_onboarding_project_fields.sql`, "utf8"));
  return pg;
}

async function as(pg, who: string, sql: string, params: unknown[] = []) {
  await pg.exec(`RESET ROLE; DELETE FROM public.me; INSERT INTO public.me VALUES ('${who}'); SET ROLE authenticated;`);
  try {
    return await pg.query(sql, params);
  } finally {
    await pg.exec("RESET ROLE;");
  }
}

const save = (pg, who, patch) =>
  as(pg, who, "SELECT public.save_onboarding_project_details($1, $2::jsonb) AS r", [PROJECT, JSON.stringify(patch)]);
const correct = (pg, who, date, reason) =>
  as(pg, who, "SELECT public.correct_committed_handoff_date($1, $2::date, $3) AS r", [PROJECT, date, reason]);
const project = async (pg) => (await pg.query(`SELECT * FROM public.onboarding_projects WHERE id='${PROJECT}'`)).rows[0];

describe("onboarding project fields (Build 11)", () => {
  let pg: PGlite;
  beforeEach(async () => {
    pg = await db();
  });

  it("adds every field empty, so every home reads Not set until filled", async () => {
    const p = await project(pg);
    for (const f of ["owner_type", "project_status", "pma_status", "invoice_status", "greater_area", "weekly_status", "committed_handoff_on"])
      expect(p[f]).toBeNull();
  });

  it("the Project Manager saves the fields and each change is one history line", async () => {
    await save(pg, PM, { owner_type: "Active Owner", project_status: "Repairs", pma_status: "PMA In Progress", greater_area: "Tulsa" });
    const p = await project(pg);
    expect(p.owner_type).toBe("Active Owner");
    expect(p.project_status).toBe("Repairs");
    const ev = (await pg.query("SELECT kind, summary, new_value, actor FROM public.onboarding_project_events ORDER BY summary")).rows;
    expect(ev.map((e) => e.summary)).toEqual(["Greater Area changed", "Owner Type changed", "PMA Status changed", "Status changed"]);
    expect(ev.every((e) => e.actor === PM && e.kind === "project_detail_changed")).toBe(true);
  });

  it("refuses values that are not Notion's own options", async () => {
    await expect(save(pg, PM, { project_status: "Almost done" })).rejects.toThrow();
    await expect(save(pg, PM, { owner_type: "VIP" })).rejects.toThrow();
    await expect(save(pg, PM, { status: "cancelled" })).rejects.toThrow(/cannot be saved here/);
  });

  it("Status is set by the Project Manager; another Project Manager cannot set it", async () => {
    await pg.exec(`INSERT INTO public.functional_roles VALUES ('director_ops', '${OTHER_PM}')`);
    await expect(save(pg, SUPERVISOR, { project_status: "Repairs" })).rejects.toThrow(/set by the Project Manager/);
    await save(pg, DIRECTOR, { project_status: "Waiting for Design" });
    await save(pg, ADMIN, { project_status: "Repairs" });
    expect((await project(pg)).project_status).toBe("Repairs");
  });

  it("Utilities, a coordinator and another home's Project Manager can view but not change", async () => {
    for (const who of [UTILITIES, OTHER_PM, COORD])
      await expect(save(pg, who, { greater_area: "Broken Arrow" })).rejects.toThrow(/view this home but not change it/);
    expect((await project(pg)).greater_area).toBeNull();
  });

  it("the Committed Handoff Date is set once, stamped, then locked", async () => {
    await save(pg, PM, { committed_handoff_on: "2026-11-20" });
    let p = await project(pg);
    expect(String(p.committed_handoff_on.toISOString?.() ?? p.committed_handoff_on).slice(0, 10)).toBe("2026-11-20");
    expect(p.committed_handoff_set_by).toBe(PM);
    expect(p.committed_handoff_set_at).not.toBeNull();
    await expect(save(pg, PM, { committed_handoff_on: "2026-11-25" })).rejects.toThrow(/locked/);
    await expect(save(pg, DIRECTOR, { committed_handoff_on: null })).rejects.toThrow(/locked/);
    await expect(save(pg, ADMIN, { committed_handoff_on: "2026-11-25" })).rejects.toThrow(/locked/);
    // A direct update is refused too, even by someone allowed to edit the home.
    await expect(as(pg, DIRECTOR, `UPDATE public.onboarding_projects SET committed_handoff_on='2026-12-01' WHERE id='${PROJECT}'`)).rejects.toThrow(/locked/);
    await expect(as(pg, DIRECTOR, `UPDATE public.onboarding_projects SET committed_handoff_set_by='${DIRECTOR}' WHERE id='${PROJECT}'`)).rejects.toThrow(/cannot be changed/);
    // Saving the same date again changes nothing and is allowed.
    await save(pg, PM, { committed_handoff_on: "2026-11-20", weekly_status: "Deliveries Friday" });
    p = await project(pg);
    expect(p.weekly_status).toBe("Deliveries Friday");
  });

  it("only a Supervisor or Admin corrects it, with a reason, and the correction is on the record", async () => {
    await save(pg, PM, { committed_handoff_on: "2026-11-20" });
    await expect(correct(pg, DIRECTOR, "2026-11-27", "Builder delayed")).rejects.toThrow(/Only a Supervisor or Admin/);
    await expect(correct(pg, PM, "2026-11-27", "Builder delayed")).rejects.toThrow(/Only a Supervisor or Admin/);
    await expect(correct(pg, ADMIN, "2026-11-27", "")).rejects.toThrow(/reason/);
    await expect(correct(pg, ADMIN, "2026-11-20", "Same date")).rejects.toThrow(/already/);
    await correct(pg, SUPERVISOR, "2026-11-27", "Builder delayed the closing");
    const p = await project(pg);
    expect(String(p.committed_handoff_on.toISOString?.() ?? p.committed_handoff_on).slice(0, 10)).toBe("2026-11-27");
    expect(p.committed_handoff_set_by).toBe(PM);
    const ev = (await pg.query("SELECT detail, prior_value, new_value, actor FROM public.onboarding_project_events WHERE kind='committed_handoff_corrected'")).rows;
    expect(ev).toEqual([{ detail: "Builder delayed the closing", prior_value: "2026-11-20", new_value: "2026-11-27", actor: SUPERVISOR }]);
    // The lock holds again right after the correction.
    await expect(save(pg, PM, { committed_handoff_on: "2026-11-29" })).rejects.toThrow(/locked/);
  });

  it("a correction needs a date already set", async () => {
    await expect(correct(pg, ADMIN, "2026-11-27", "Builder delayed")).rejects.toThrow(/no Committed Handoff Date/);
  });

  it("handoff reminders follow the Committed Handoff Date once set, and the estimate until then", async () => {
    // 8 AM Central on Nov 13: the estimate (Nov 20) is 7 days out.
    await pg.query("SELECT public.run_handoff_reminders('2026-11-13 14:00:00+00')");
    expect((await pg.query("SELECT kind, handoff_on::text FROM public.handoff_reminders")).rows).toEqual([{ kind: "seven_days", handoff_on: "2026-11-20" }]);
    await pg.exec("DELETE FROM public.handoff_reminders");
    await save(pg, PM, { committed_handoff_on: "2026-11-15" });
    await pg.query("SELECT public.run_handoff_reminders('2026-11-13 14:00:00+00')");
    expect((await pg.query("SELECT kind, handoff_on::text FROM public.handoff_reminders")).rows).toEqual([{ kind: "two_days", handoff_on: "2026-11-15" }]);
  });

  it("design folders are accepted and the old categories still are", async () => {
    for (const c of ["design_floor_plan", "design_mood_board", "design_pick_list", "design_install", "design_staging", "design_photo", "design", "covenants", "other"])
      await pg.query("INSERT INTO public.documents(category) VALUES ($1)", [c]);
    await expect(pg.query("INSERT INTO public.documents(category) VALUES ('design_anything')")).rejects.toThrow();
  });

  it("undo restores the reminder function exactly and removes everything added", async () => {
    await pg.query("INSERT INTO public.documents(category) VALUES ('design_photo')");
    await pg.exec(readFileSync(`${DIR}/undo/01_onboarding_project_fields.sql`, "utf8"));
    const cols = (await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name='onboarding_projects'")).rows.map((r) => r.column_name);
    expect(cols).not.toContain("committed_handoff_on");
    expect(cols).not.toContain("project_status");
    expect((await pg.query("SELECT category FROM public.documents")).rows).toEqual([{ category: "design" }]);
    await expect(pg.query("INSERT INTO public.documents(category) VALUES ('design_photo')")).rejects.toThrow();
    const fns = (await pg.query("SELECT proname FROM pg_proc WHERE proname IN ('save_onboarding_project_details','correct_committed_handoff_date','lock_committed_handoff')")).rows;
    expect(fns).toEqual([]);
    const body = (await pg.query("SELECT prosrc FROM pg_proc WHERE proname='run_handoff_reminders'")).rows[0].prosrc;
    expect(body).not.toContain("committed");
    const before = readFileSync(`${DIR}/before_run_handoff_reminders.sql`, "utf8");
    expect(before).toContain(body.trim());
  });
});
