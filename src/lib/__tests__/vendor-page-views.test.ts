// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { canOpenPath } from "@/lib/route-access";
import { capabilitiesFor, type AccessSeats, type AppRole } from "@/lib/permissions";
import { departmentFor } from "@/lib/shell-nav";
import { VENDOR_TABS, vendorPageAccess } from "@/lib/vendor-page-views";

/**
 * Nov 8, 2026 (Emily, correcting the earlier answer): onboarding uses all of
 * ARHA's vendors. The Director of Onboarding, Project Managers and Utilities
 * open every Vendors tab and read every vendor record and field, exactly like
 * the Operations Supervisor. They edit vendor companies, service areas and
 * home coverage. Status (Approved or Gold), Gold Standard, compliance and
 * screening stay with Operations leadership, shown read only, never hidden.
 * Design stays out of Vendors.
 */
const person = (roles: AppRole[], seats: AccessSeats = {}) => ({ roles, seats });
const ONBOARDING_EDITORS = {
  "Director of Onboarding": person(["onboarding"], { onboardingDirector: true }),
  "Project Manager": person(["onboarding"], { projectManager: true }),
  Utilities: person(["onboarding"], { utilities: true }),
};
const SUPERVISOR = person(["manager"], { opsSupervisor: true });
const LEADERSHIP = {
  "Operations Supervisor": SUPERVISOR,
  "Director of Operations": person(["manager"], { opsDirector: true }),
  Admin: person(["admin"]),
};
const DESIGN = person(["onboarding"]);
const PC = person(["tech"]);

const accessFor = (p: { roles: AppRole[]; seats: AccessSeats }) => {
  const caps = capabilitiesFor(p.roles, p.seats);
  return vendorPageAccess((c) => caps.has(c));
};
const vendorMenuFor = (p: { roles: AppRole[]; seats: AccessSeats }) => {
  const caps = capabilitiesFor(p.roles, p.seats);
  return (departmentFor("/vendors")?.links ?? []).filter((l) => !l.capability || caps.has(l.capability)).map((l) => l.label);
};
const ALL_MENU = ["Directory", "Database", "Gold Standard", "Market Coverage", "Needs Review"];

describe("Vendors page: onboarding sees the full vendor database", () => {
  for (const [name, p] of Object.entries(ONBOARDING_EDITORS)) {
    it(`${name}: every tab and menu item, same as the Operations Supervisor; edits companies, not leadership fields`, () => {
      const a = accessFor(p);
      expect(a.tabs).toEqual([...VENDOR_TABS]);
      expect(a.tabs).toEqual(accessFor(SUPERVISOR).tabs);
      expect(a.screening).toBe(true);
      expect(vendorMenuFor(p)).toEqual(ALL_MENU);
      expect(canOpenPath("/vendors", p)).toBe(true);
      expect(canOpenPath("/vendors/some-vendor", p)).toBe(true);
      expect(a.edit).toBe(true);
      expect(a.lead).toBe(false);
    });
  }

  for (const [name, p] of Object.entries(LEADERSHIP)) {
    it(`${name}: every tab, edits and leadership controls`, () => {
      expect(accessFor(p)).toEqual({ tabs: [...VENDOR_TABS], edit: true, lead: true, screening: true });
      expect(vendorMenuFor(p)).toEqual(ALL_MENU);
    });
  }

  it("Design stays out of Vendors", () => {
    expect(accessFor(DESIGN)).toEqual({ tabs: [], edit: false, lead: false, screening: false });
    expect(vendorMenuFor(DESIGN)).toEqual([]);
    expect(canOpenPath("/vendors", DESIGN)).toBe(false);
  });

  it("a coordinator keeps what they had: no Database tab, everything else read only", () => {
    expect(accessFor(PC)).toEqual({ tabs: ["directory", "gold", "coverage", "review"], edit: false, lead: false, screening: true });
    expect(vendorMenuFor(PC)).toEqual(["Directory", "Gold Standard", "Market Coverage", "Needs Review"]);
  });

  it("a read only view turns every edit off", () => {
    const caps = capabilitiesFor(["admin"]);
    expect(vendorPageAccess((c) => caps.has(c), true)).toMatchObject({ edit: false, lead: false });
  });

  it("the screens show every tab and keep leadership controls read only, never hidden", () => {
    const page = readFileSync("src/routes/_authenticated/vendors.index.tsx", "utf8");
    const profile = readFileSync("src/routes/_authenticated/vendors.$vendorId.tsx", "utf8");
    const sheet = readFileSync("src/components/VendorOrgSheet.tsx", "utf8");
    const database = readFileSync("src/components/vendors/VendorDatabase.tsx", "utf8");
    for (const src of [page, profile, sheet]) expect(src).not.toContain("showScreening");
    expect(page).toContain('<TabsTrigger value="review">Needs Review</TabsTrigger>');
    expect(page).toContain('{canManage && <TabsTrigger value="database">Database</TabsTrigger>}');
    expect(page).toContain("<VendorNeedsReview canManage={canLead} />");
    expect(sheet).toContain('<TabsTrigger value="screening">Screening</TabsTrigger>');
    expect(sheet).not.toMatch(/\{\w+ && <TabsTrigger value="screening">/);
    // Screening results, status and documents: leadership only, with a plain label for editors.
    expect(sheet).toContain("canManage={canLead}\n                      saving={resultMutation.isPending}");
    expect(sheet).toContain("{canLead && (\n                  <>\n                    <Separator />\n                    <div className=\"space-y-2\">\n                      <Label>Change status</Label>");
    expect(sheet).toContain("Status, Gold Standard, compliance and screening results are changed by Operations leadership.");
    expect(sheet).toContain("Documents are filed by Operations leadership.");
    expect(profile).toContain("value={v.program_owner} canManage={canLead}");
    expect(database).toContain("{canLead && c.field && (");
  });
});

// ---------------------------------------------------------------------------
// Database: the live rules (read on Nov 8, 2026) plus fix batch 2 part 4.
// ---------------------------------------------------------------------------
const SUP = "00000000-0000-4000-8000-000000000003";
const DIR_ONB = "00000000-0000-4000-8000-000000000005";
const PM = "00000000-0000-4000-8000-000000000006";
const UTIL = "00000000-0000-4000-8000-000000000007";
const DESIGNER = "00000000-0000-4000-8000-000000000008";
const EDITORS = { "Director of Onboarding": DIR_ONB, "Project Manager": PM, Utilities: UTIL };

const BASE = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, private, auth TO authenticated;
CREATE TABLE public.me(id uuid); GRANT SELECT ON public.me TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
INSERT INTO public.user_roles VALUES ('${SUP}','manager'),('${DIR_ONB}','onboarding'),('${PM}','onboarding'),('${UTIL}','onboarding'),('${DESIGNER}','onboarding');
CREATE TABLE public.functional_roles(code text, active boolean DEFAULT true, current_seat_holder uuid);
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
INSERT INTO public.functional_roles VALUES ('ops_supervisor',true,'${SUP}'),('director_onboarding',true,'${DIR_ONB}'),
  ('onboarding_project_manager',true,'${PM}'),('utilities',true,NULL),('designer',true,NULL);
INSERT INTO public.functional_role_members VALUES ('utilities','${UTIL}'),('designer','${DESIGNER}');
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE FUNCTION public.holds_functional_role(_user_id uuid, _code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles WHERE code = _code AND active AND current_seat_holder = _user_id)
      OR EXISTS (SELECT 1 FROM public.functional_role_members WHERE role_code = _code AND user_id = _user_id) $$;
CREATE FUNCTION public.is_onboarding_director(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT public.holds_functional_role(_user_id,'director_onboarding') $$;
CREATE FUNCTION private.is_supervisor(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','manager')) $$;
CREATE FUNCTION private.is_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','manager','tech','onboarding')) $$;
CREATE FUNCTION private.is_director(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT public.holds_functional_role(_user_id,'director_ops') $$;
CREATE FUNCTION private.is_vendor_admin(_user_id uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.is_vendor_member(_user_id uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.vendor_gates_clear(_org uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;

CREATE TABLE public.vendor_orgs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, notes text,
  primary_contact_name text, website text, is_active boolean DEFAULT true, status text DEFAULT 'candidate',
  compliance_status text, program_owner uuid, score_quality int, tier text, critical_failure boolean DEFAULT false,
  dispatch_method text, qualification_score int, updated_at timestamptz, is_demo boolean DEFAULT false);
GRANT SELECT, INSERT, UPDATE ON public.vendor_orgs TO authenticated;
ALTER TABLE public.vendor_orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_orgs_insert ON public.vendor_orgs FOR INSERT TO authenticated WITH CHECK (private.is_supervisor(auth.uid()));
CREATE POLICY vendor_orgs_read ON public.vendor_orgs FOR SELECT TO authenticated USING (private.is_staff(auth.uid()) OR private.is_vendor_member(auth.uid(), id));
CREATE POLICY vendor_orgs_update ON public.vendor_orgs FOR UPDATE TO authenticated USING (private.is_supervisor(auth.uid()) OR private.is_vendor_admin(auth.uid(), id)) WITH CHECK (private.is_supervisor(auth.uid()) OR private.is_vendor_admin(auth.uid(), id));
CREATE TABLE public.vendor_field_audit(org_id uuid, field text, old_value jsonb, new_value jsonb, changed_by uuid);
GRANT SELECT ON public.vendor_field_audit TO authenticated;

-- Live private.vendor_orgs_guard, copied unchanged.
CREATE OR REPLACE FUNCTION private.vendor_orgs_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); is_admin boolean; is_lead boolean; is_sup boolean; is_staff boolean;
  k text; o jsonb; n jsonb;
  system_cols text[] := ARRAY['dispatch_method','breezeway_person_id','source_system','legacy_notion_id','migration_status','legacy_fields','created_by','created_at'];
  gold_cols text[] := ARRAY['status','compliance_status','score_capacity','score_responsiveness','score_quality','score_hospitality','score_communication','score_pricing','score_references','performance_score','jobs_90d','critical_failure','last_review_on','next_review_on','program_owner','open_corrective_action','corrective_action_due','tier','trial_score'];
  skip_cols text[] := ARRAY['updated_at','qualification_score'];
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  is_admin := public.has_role(uid,'admin');
  is_lead := is_admin OR private.is_director(uid);
  is_sup := is_lead OR private.is_supervisor(uid);
  is_staff := private.is_staff(uid);
  o := to_jsonb(OLD); n := to_jsonb(NEW);
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    IF k = ANY(skip_cols) OR (o->k) IS NOT DISTINCT FROM (n->k) THEN CONTINUE; END IF;
    IF k = ANY(system_cols) AND NOT is_lead THEN
      RAISE EXCEPTION 'The % field is a protected system field. Only Admin or the Director of Operations can change it.', k;
    END IF;
    IF k = ANY(gold_cols) AND NOT is_sup THEN
      RAISE EXCEPTION 'Only Operations leadership can change Gold Standard or compliance fields.';
    END IF;
    IF NOT is_staff AND k NOT IN ('primary_contact_name','primary_contact_email','primary_contact_phone','website','notes') THEN
      RAISE EXCEPTION 'Vendor accounts can only update their contact details.';
    END IF;
    INSERT INTO public.vendor_field_audit(org_id, field, old_value, new_value, changed_by)
      VALUES (NEW.id, k, o->k, n->k, uid);
  END LOOP;
  IF NEW.status IN ('approved','gold') AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT private.vendor_gates_clear(NEW.id) THEN
      RAISE EXCEPTION 'A required qualification gate is not complete. A score cannot override a failed gate.';
    END IF;
    IF NEW.critical_failure THEN
      RAISE EXCEPTION 'This vendor has an open critical failure and cannot be Approved or Gold.';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER vendor_orgs_guard BEFORE UPDATE ON public.vendor_orgs FOR EACH ROW EXECUTE FUNCTION private.vendor_orgs_guard();

CREATE TABLE public.vendor_gatekeeper_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, result text);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_gatekeeper_results TO authenticated;
ALTER TABLE public.vendor_gatekeeper_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY gatekeeper_result_read ON public.vendor_gatekeeper_results FOR SELECT TO authenticated USING (private.is_staff(auth.uid()) OR private.is_vendor_admin(auth.uid(), org_id));
CREATE POLICY gatekeeper_result_write ON public.vendor_gatekeeper_results FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));
CREATE TABLE public.vendor_service_areas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, postal_code text);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_service_areas TO authenticated;
ALTER TABLE public.vendor_service_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_areas_read ON public.vendor_service_areas FOR SELECT TO authenticated USING (private.is_staff(auth.uid()) OR private.is_vendor_member(auth.uid(), org_id));
CREATE POLICY service_areas_write ON public.vendor_service_areas FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));
CREATE TABLE public.property_vendor_coverage(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, property_id uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_vendor_coverage TO authenticated;
ALTER TABLE public.property_vendor_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY coverage_read ON public.property_vendor_coverage FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY coverage_write ON public.property_vendor_coverage FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));
`;

let db: PGlite;
let orgId = "";
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

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BASE);
  await db.exec(readFileSync("docs/pending/fix-batch-2/04_vendor_editors.sql", "utf8"));
  const r = await db.query<{ id: string }>(
    "INSERT INTO public.vendor_orgs(display_name, status, compliance_status, program_owner, score_quality) VALUES ('Co', 'approved', 'current', NULL, 4) RETURNING id",
  );
  orgId = r.rows[0].id;
  await db.exec(`INSERT INTO public.vendor_orgs(display_name) VALUES ('Second Co');
    INSERT INTO public.vendor_gatekeeper_results(org_id, result) VALUES ('${orgId}', 'pass');
    INSERT INTO public.vendor_service_areas(org_id, postal_code) VALUES ('${orgId}', '78701');
    INSERT INTO public.property_vendor_coverage(org_id) VALUES ('${orgId}');`);
});

describe("Vendors database: onboarding reads everything, leadership keeps status, Gold Standard, compliance and screening", () => {
  for (const [name, user] of Object.entries(EDITORS)) {
    it(`${name} reads every vendor record and field the Operations Supervisor reads`, async () => {
      for (const table of ["vendor_orgs", "vendor_gatekeeper_results", "vendor_service_areas", "property_vendor_coverage", "vendor_field_audit"]) {
        const mine = await as(user, `SELECT * FROM public.${table} ORDER BY 1`);
        const sup = await as(SUP, `SELECT * FROM public.${table} ORDER BY 1`);
        expect(mine.ok).toBe(true);
        expect(mine.rows).toEqual(sup.rows);
      }
      const row = (await as<Record<string, unknown>>(user, `SELECT status, compliance_status, score_quality FROM public.vendor_orgs WHERE id='${orgId}'`)).rows[0];
      expect(row).toEqual({ status: "approved", compliance_status: "current", score_quality: 4 });
    });

    it(`${name} edits the vendor company but cannot change status, Gold Standard, compliance or screening`, async () => {
      expect((await as(user, `UPDATE public.vendor_orgs SET primary_contact_name='Front desk' WHERE id='${orgId}' RETURNING id`)).rows.length).toBe(1);
      for (const set of ["status='gold'", "status='candidate'", "score_quality=5", "tier='gold'", "program_owner='${SUP}'", "compliance_status='expired'"]) {
        const r = await as(user, `UPDATE public.vendor_orgs SET ${set.replace("${SUP}", SUP)} WHERE id='${orgId}'`);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("Only Operations leadership can change Gold Standard or compliance fields.");
      }
      expect((await as(user, `INSERT INTO public.vendor_gatekeeper_results(org_id, result) VALUES ('${orgId}', 'pass')`)).ok).toBe(false);
      expect((await as(user, "UPDATE public.vendor_gatekeeper_results SET result='fail' RETURNING id")).rows.length).toBe(0);
      expect((await as(user, "DELETE FROM public.vendor_gatekeeper_results RETURNING id")).rows.length).toBe(0);
      const left = await db.query<Record<string, unknown>>(`SELECT status, compliance_status, score_quality, tier, program_owner FROM public.vendor_orgs WHERE id='${orgId}'`);
      expect(left.rows[0]).toEqual({ status: "approved", compliance_status: "current", score_quality: 4, tier: null, program_owner: null });
      expect((await db.query("SELECT count(*)::int AS n FROM public.vendor_gatekeeper_results")).rows[0]).toEqual({ n: 1 });
    });
  }

  it("the Operations Supervisor still changes status and screening", async () => {
    expect((await as(SUP, `UPDATE public.vendor_orgs SET status='gold' WHERE id='${orgId}' RETURNING id`)).rows.length).toBe(1);
    expect((await as(SUP, "UPDATE public.vendor_gatekeeper_results SET result='pass' RETURNING id")).rows.length).toBe(1);
  });

  it("Design cannot change vendors", async () => {
    expect((await as(DESIGNER, `UPDATE public.vendor_orgs SET notes='x' WHERE id='${orgId}' RETURNING id`)).rows.length).toBe(0);
  });
});
