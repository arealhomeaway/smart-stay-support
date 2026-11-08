// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL checks of docs/pending/fix-batch-2/. Tables carry only the
 * columns each rule reads; the live policies are copied in so the new ones are
 * proven additive. Nothing touches the real database.
 */
const DIR = "docs/pending/fix-batch-2";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");

const ADMIN = "00000000-0000-4000-8000-000000000001";
const COORD = "00000000-0000-4000-8000-000000000002";
const SUP = "00000000-0000-4000-8000-000000000003"; // holds ops_supervisor, manager account
const DIR_OPS = "00000000-0000-4000-8000-000000000004";
const DIR_ONB = "00000000-0000-4000-8000-000000000005";
const PM = "00000000-0000-4000-8000-000000000006";
const UTIL = "00000000-0000-4000-8000-000000000007";
const DESIGN = "00000000-0000-4000-8000-000000000008";
const COVER = "00000000-0000-4000-8000-000000000009"; // covering the Operations Supervisor today

const BASE = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, private, auth TO authenticated;
CREATE TABLE public.me(id uuid); GRANT SELECT ON public.me TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'),('${COORD}','tech'),('${SUP}','manager'),('${DIR_OPS}','manager'),
  ('${DIR_ONB}','onboarding'),('${PM}','onboarding'),('${UTIL}','onboarding'),('${DESIGN}','onboarding'),('${COVER}','tech');
CREATE TABLE public.functional_roles(code text, active boolean DEFAULT true, current_seat_holder uuid);
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
INSERT INTO public.functional_roles VALUES ('ops_supervisor',true,'${SUP}'),('director_ops',true,'${DIR_OPS}'),
  ('director_onboarding',true,'${DIR_ONB}'),('onboarding_project_manager',true,'${PM}'),('utilities',true,NULL),('designer',true,NULL);
INSERT INTO public.functional_role_members VALUES ('utilities','${UTIL}'),('designer','${DESIGN}');
CREATE TABLE public.cover(role_code text, user_id uuid);
INSERT INTO public.cover VALUES ('ops_supervisor','${COVER}');
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE FUNCTION private.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT public.has_role(_user_id,_role) $$;
CREATE FUNCTION public.holds_functional_role(_user_id uuid, _code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles WHERE code = _code AND active AND current_seat_holder = _user_id)
      OR EXISTS (SELECT 1 FROM public.functional_role_members WHERE role_code = _code AND user_id = _user_id) $$;
CREATE FUNCTION public.seat_holder_at(_role_code text, _at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT coalesce((SELECT user_id FROM public.cover WHERE role_code=_role_code LIMIT 1),
       (SELECT current_seat_holder FROM public.functional_roles WHERE code=_role_code)) $$;
CREATE FUNCTION public.is_supervisor(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'manager') $$;
CREATE FUNCTION private.is_supervisor(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT public.is_supervisor(_user_id) $$;
CREATE FUNCTION public.is_director(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT public.holds_functional_role(_user_id,'director_ops') $$;
CREATE FUNCTION public.is_onboarding_director(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT public.holds_functional_role(_user_id,'director_onboarding') $$;
CREATE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','manager','tech','onboarding')) $$;
CREATE FUNCTION private.is_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT public.is_staff(_user_id) $$;
CREATE FUNCTION private.is_vendor_admin(_user_id uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.is_vendor_member(_user_id uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
${readFileSync(`${DIR}/live-capture/can_manage_playbooks.sql`, "utf8")};
-- Row type the playbook save function declares (its body runs only when called).
CREATE TABLE public.playbooks(id uuid PRIMARY KEY DEFAULT gen_random_uuid());

-- Live policies copied from the real tables (read on Nov 8).
CREATE TABLE public.team_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role public.app_role, note text);
GRANT SELECT, INSERT, UPDATE ON public.team_invites TO authenticated;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins create team invites" ON public.team_invites FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read team invites" ON public.team_invites FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update team invites" ON public.team_invites FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.email_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, active boolean DEFAULT true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read message templates" ON public.email_templates FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Supervisors can change message templates" ON public.email_templates FOR UPDATE TO authenticated USING (is_supervisor(auth.uid())) WITH CHECK (is_supervisor(auth.uid()));
CREATE POLICY "Supervisors can create message templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (is_supervisor(auth.uid()));
CREATE POLICY "Supervisors can remove message templates" ON public.email_templates FOR DELETE TO authenticated USING (is_supervisor(auth.uid()));

CREATE TABLE public.vendor_orgs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, notes text, is_demo boolean DEFAULT false);
GRANT SELECT, INSERT, UPDATE ON public.vendor_orgs TO authenticated;
ALTER TABLE public.vendor_orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_orgs_insert ON public.vendor_orgs FOR INSERT TO authenticated WITH CHECK (private.is_supervisor(auth.uid()));
CREATE POLICY vendor_orgs_read ON public.vendor_orgs FOR SELECT TO authenticated USING (private.is_staff(auth.uid()) OR private.is_vendor_member(auth.uid(), id));
CREATE POLICY vendor_orgs_update ON public.vendor_orgs FOR UPDATE TO authenticated USING (private.is_supervisor(auth.uid()) OR private.is_vendor_admin(auth.uid(), id)) WITH CHECK (private.is_supervisor(auth.uid()) OR private.is_vendor_admin(auth.uid(), id));
CREATE TABLE public.vendor_service_areas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, postal_code text);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_service_areas TO authenticated;
ALTER TABLE public.vendor_service_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_areas_read ON public.vendor_service_areas FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY service_areas_write ON public.vendor_service_areas FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));
CREATE TABLE public.property_vendor_coverage(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, property_id uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_vendor_coverage TO authenticated;
ALTER TABLE public.property_vendor_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY coverage_read ON public.property_vendor_coverage FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY coverage_write ON public.property_vendor_coverage FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));
CREATE TABLE public.vendor_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid);
GRANT SELECT, INSERT ON public.vendor_documents TO authenticated;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_docs_write ON public.vendor_documents FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));
`;

let db: PGlite;
async function as<T>(user: string, sql: string): Promise<{ ok: boolean; rows: T[]; error?: string }> {
  await db.exec(`RESET ROLE; DELETE FROM public.me; INSERT INTO public.me VALUES ('${user}');`);
  try {
    await db.exec("SET ROLE authenticated");
    const r = await db.query<T>(sql);
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, rows: [], error: String((e as Error).message) };
  } finally {
    await db.exec("RESET ROLE");
  }
}
const fn = async (name: string, user: string) =>
  ((await db.query(`SELECT public.${name}('${user}'::uuid) AS ok`)).rows[0] as { ok: boolean }).ok;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BASE);
  for (const f of ["01_playbook_supervisor_save.sql", "02_operations_invites.sql", "03_email_templates_onboarding_director.sql", "04_vendor_editors.sql", "05_direct_booking_settings_admin.sql"]) {
    await db.exec(read(f));
  }
});

describe("fix batch 2: staged files change only the permission lines", () => {
  it("save_playbook_draft differs from the live copy only in its permission check", () => {
    const live = read("live-capture/save_playbook_draft.sql").trim().split("\n");
    const staged = read("01_playbook_supervisor_save.sql");
    const body = staged.slice(staged.indexOf("CREATE OR REPLACE FUNCTION public.save_playbook_draft")).trim().replace(/;$/, "").split("\n");
    expect(body.length).toBe(live.length);
    const diff = body.map((l, i) => (l === live[i] ? null : i)).filter((i) => i !== null);
    expect(diff.length).toBe(1);
    expect(body[diff[0]!]).toContain("public.can_save_playbooks(_actor)");
  });

  it("save_direct_booking_settings differs from the live copy only in its permission check", () => {
    const live = read("live-capture/save_direct_booking_settings.sql").trim().split("\n");
    const staged = read("05_direct_booking_settings_admin.sql");
    const body = staged.slice(staged.indexOf("CREATE OR REPLACE FUNCTION")).trim().replace(/;$/, "").split("\n");
    expect(body.length).toBe(live.length);
    const diff = body.map((l, i) => (l === live[i] ? null : i)).filter((i) => i !== null);
    expect(diff.length).toBe(2);
    expect(body[diff[0]!]).toContain("public.has_role(auth.uid(), 'admin')");
  });
});

describe("item 1: playbook saving", () => {
  it("adds the Operations Supervisor (held or covering) to saving, not to approving", async () => {
    expect(await fn("can_save_playbooks", SUP)).toBe(true);
    expect(await fn("can_save_playbooks", COVER)).toBe(true);
    expect(await fn("can_manage_playbooks", SUP)).toBe(false);
    for (const u of [ADMIN, DIR_OPS, DIR_ONB]) expect(await fn("can_save_playbooks", u)).toBe(true);
    for (const u of [COORD, PM, UTIL, DESIGN]) expect(await fn("can_save_playbooks", u)).toBe(false);
  });
});

describe("item 2: Operations invites", () => {
  it("Operations leadership can create Coordinator and Supervisor codes only", async () => {
    for (const u of [SUP, DIR_OPS, COVER]) {
      expect((await as(u, "INSERT INTO public.team_invites(role) VALUES ('tech') RETURNING id")).ok).toBe(true);
      expect((await as(u, "INSERT INTO public.team_invites(role) VALUES ('manager') RETURNING id")).ok).toBe(true);
      for (const r of ["admin", "onboarding", "vendor", "owner"])
        expect((await as(u, `INSERT INTO public.team_invites(role) VALUES ('${r}')`)).ok).toBe(false);
    }
  });
  it("they see and change only Operations codes; Admin still sees every code", async () => {
    await db.exec("INSERT INTO public.team_invites(role, note) VALUES ('onboarding','onb'),('vendor','ven')");
    const seen = (await as<{ role: string }>(SUP, "SELECT role FROM public.team_invites")).rows.map((r) => r.role);
    expect(new Set(seen)).toEqual(new Set(["tech", "manager"]));
    const changed = await as(SUP, "UPDATE public.team_invites SET note='x' WHERE role='onboarding' RETURNING id");
    expect(changed.rows.length).toBe(0);
    const all = (await as<{ role: string }>(ADMIN, "SELECT role FROM public.team_invites")).rows.map((r) => r.role);
    expect(all).toContain("onboarding");
    expect(all).toContain("vendor");
  });
  it("coordinators and the Director of Onboarding get nothing new here", async () => {
    for (const u of [COORD, DIR_ONB, PM]) {
      expect((await as(u, "INSERT INTO public.team_invites(role) VALUES ('tech')")).ok).toBe(false);
      expect((await as(u, "SELECT * FROM public.team_invites")).rows.length).toBe(0);
    }
  });
});

describe("item 3: email templates", () => {
  it("the Director of Onboarding can create and change; reading stays all staff; removing stays Supervisor", async () => {
    expect((await as(DIR_ONB, "INSERT INTO public.email_templates(name) VALUES ('Welcome') RETURNING id")).ok).toBe(true);
    expect((await as(DIR_ONB, "UPDATE public.email_templates SET active=false RETURNING id")).rows.length).toBe(1);
    expect((await as(DIR_ONB, "DELETE FROM public.email_templates RETURNING id")).rows.length).toBe(0);
    expect((await as(COORD, "SELECT * FROM public.email_templates")).rows.length).toBe(1);
    expect((await as(COORD, "INSERT INTO public.email_templates(name) VALUES ('x')")).ok).toBe(false);
    expect((await as(PM, "INSERT INTO public.email_templates(name) VALUES ('x')")).ok).toBe(false);
  });
});

describe("item 4: vendor editing", () => {
  it("Director of Onboarding, Project Manager and Utilities can save vendor companies, areas and coverage", async () => {
    for (const u of [DIR_ONB, PM, UTIL]) {
      const created = await as<{ id: string }>(u, "INSERT INTO public.vendor_orgs(display_name) VALUES ('Co') RETURNING id");
      expect(created.ok).toBe(true);
      const id = created.rows[0]!.id;
      expect((await as(u, `UPDATE public.vendor_orgs SET notes='n' WHERE id='${id}' RETURNING id`)).rows.length).toBe(1);
      expect((await as(u, `INSERT INTO public.vendor_service_areas(org_id, postal_code) VALUES ('${id}','78701')`)).ok).toBe(true);
      expect((await as(u, `INSERT INTO public.property_vendor_coverage(org_id) VALUES ('${id}')`)).ok).toBe(true);
    }
  });
  it("Design and coordinators cannot, and documents stay Supervisor only", async () => {
    for (const u of [DESIGN, COORD]) {
      expect((await as(u, "INSERT INTO public.vendor_orgs(display_name) VALUES ('Co')")).ok).toBe(false);
      expect((await as(u, "UPDATE public.vendor_orgs SET notes='z' RETURNING id")).rows.length).toBe(0);
    }
    expect((await as(PM, "INSERT INTO public.vendor_documents(org_id) VALUES (gen_random_uuid())")).ok).toBe(false);
    expect(await fn("can_edit_vendors", SUP)).toBe(true);
    expect(await fn("can_edit_vendors", DESIGN)).toBe(false);
  });
});

describe("undo files", () => {
  it("each undo removes what its file added", async () => {
    const u = new PGlite();
    await u.exec(BASE);
    for (const n of ["01_playbook_supervisor_save", "02_operations_invites", "03_email_templates_onboarding_director", "04_vendor_editors", "05_direct_booking_settings_admin"]) {
      await u.exec(read(`${n}.sql`));
      await u.exec(read(`${n}.undo.sql`));
    }
    const fns = await u.query("SELECT proname FROM pg_proc WHERE proname IN ('can_save_playbooks','can_invite_operations_users','can_edit_vendors')");
    expect(fns.rows.length).toBe(0);
    const pols = await u.query("SELECT policyname FROM pg_policies WHERE policyname LIKE 'Operations leadership%' OR policyname LIKE 'Director of Onboarding%' OR policyname LIKE '%_editors'");
    expect(pols.rows.length).toBe(0);
    const pb = await u.query("SELECT pg_get_functiondef('public.save_playbook_draft(uuid,timestamptz,jsonb)'::regprocedure) d");
    expect(pb.rows[0].d).toContain("public.can_manage_playbooks(_actor)");
    const ds = await u.query("SELECT pg_get_functiondef('public.save_direct_booking_settings(jsonb)'::regprocedure) d");
    expect(ds.rows[0].d).not.toContain("'admin'");
  });
});
