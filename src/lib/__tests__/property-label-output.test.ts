import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { welcomeContext } from "../owner-welcome.server";
import { renderWelcome } from "../owner-welcome";
import { readOwnerPropertyLabels, readOwnerProgramProperties } from "../owner-program-reader.server";
import { ownerEnrollmentFixture } from "./owner-program-reader-fixture";
import { formatPropertyLabel } from "../property-label";
import { planRow, PLAN_HEADER, toCsv } from "../plan-csv";
import { reportFileBase, strReportCsv, type StrReport } from "../str-report";

const home = { id: "00000000-0000-4000-8000-000000000001", name: "Fernstone House", nickname: "Ramsey", address_line1: "3400 N Fern Ave", unit: "B", city: "Broken Arrow", state: "OK", postal_code: "74012", primary_photo_url: null };
const owner = "00000000-0000-4000-8000-000000000002";
const program = "00000000-0000-4000-8000-000000000003";
const task = "00000000-0000-4000-8000-000000000004";

describe("address labels through current outputs", () => {
  it("loads the welcome's structured home and renders its address without delivery", async () => {
    const selected: string[] = [];
    const db = { from: (table: string) => {
      const q = { select: (s: string) => { selected.push(s); return q; }, eq: () => q, is: () => q,
        maybeSingle: async () => ({ data: { full_name: "Rachel Ramsey" }, error: null }),
        then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: table === "owner_program_properties" ? [{ properties: home }] : [], error: null }).then(resolve),
      }; return q;
    } };
    const ctx = await welcomeContext(db as never, program, owner);
    const rendered = renderWelcome({ subject: "Welcome for {{property_display_name}}", body: "Hi {{owner_first_name}}. Your home is {{property_display_name}}." }, { ...ctx, portalLink: "https://resolve-test.invalid/owner", videoLink: null });
    expect(ctx.propertyNames).toEqual(["3400 N Fern Ave, Unit B"]);
    expect(rendered).toEqual({ subject: "Welcome for 3400 N Fern Ave, Unit B", body: "Hi Rachel. Your home is 3400 N Fern Ave, Unit B." });
    expect(selected.some(s => s.includes("address_line1, unit, city, state, postal_code"))).toBe(true);
  });
  it("keeps homeowner labels and enrollment units through authorized projections", async () => {
    const db = { rpc: (name: string) => {
      const data = name === "read_owner_properties"
        ? [{ id: home.id, program_id: program, program_status: "active", property: home }]
        : [{ id: "enrollment", enrollment: ownerEnrollmentFixture({ id: "enrollment", properties: home }) }];
      const q = { order: () => q, range: async () => ({ data, error: null, count: data.length }) }; return q;
    } };
    const labels = await readOwnerPropertyLabels(db as never, [home.id]);
    expect(labels).toEqual([{ id: home.id, name: "3400 N Fern Ave, Unit B", active: true }]);
    const enrollment = await readOwnerProgramProperties(db as never, program);
    expect(formatPropertyLabel(enrollment.data[0]?.properties).primary).toBe("3400 N Fern Ave, Unit B");
  });
  it("uses the address in new plan and STR report exports, retaining historical snapshots", () => {
    const primary = formatPropertyLabel(home).primary;
    const row = planRow({ plan: primary, stageNo: 1, stage: "Setup", taskNo: 1, title: "Inspect home" });
    expect(toCsv(PLAN_HEADER, [row])).toContain('"3400 N Fern Ave, Unit B"');
    const report: StrReport = { property: { name: primary, address: formatPropertyLabel(home).full }, owner: { name: "Rachel" }, program: { startedOn: null, endsOn: null, status: "active" }, period: { from: "2026-01-01", to: "2026-12-31" }, include: { owner: true, nonOwner: false }, rows: [], summary: [], totals: { ownerMinutes: 0, ownerEntries: 0, nonOwnerSupportedMinutes: 0, underReview: 0 }, disclaimer: "Recorded activity only." };
    expect(strReportCsv(report)).toContain('# Property,"3400 N Fern Ave, Unit B"');
    expect(reportFileBase(report)).toBe("str-participation-3400-n-fern-ave-unit-b-2026-01-01-v1");
    const historical = { ...report, property: { name: "Stored earlier label", address: "Earlier address" } };
    expect(strReportCsv(historical)).toContain("Stored earlier label");
    expect(historical.property.name).toBe("Stored earlier label");
  });
});

describe("actual pending alert producers in isolated PostgreSQL", () => {
  it("executes summary, note, handoff and owner-message producers with address labels", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE SCHEMA auth; CREATE SCHEMA private;
        CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${owner}'::uuid $$;
        CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
        CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
        CREATE FUNCTION public.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
        CREATE FUNCTION public.is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
        CREATE FUNCTION public.seat_holder(text) RETURNS uuid LANGUAGE sql AS $$ SELECT '${owner}'::uuid $$;
        CREATE FUNCTION public.seat_override_at(text,timestamptz) RETURNS TABLE(user_id uuid,kind text) LANGUAGE sql AS $$ SELECT NULL::uuid,'cover'::text WHERE false $$;
        CREATE TABLE properties(id uuid PRIMARY KEY,name text,nickname text,address_line1 text,unit text,city text,state text,postal_code text,is_demo boolean);
        CREATE TABLE profiles(id uuid,full_name text,email text);
        CREATE TABLE property_owners(id uuid,active boolean);
        CREATE TABLE owner_programs(id uuid,owner_user_id uuid,owner_record_id uuid,status text,archived_at timestamptz,is_demo boolean,notify_email boolean);
        CREATE TABLE owner_program_properties(program_id uuid,property_id uuid,inclusion_status text);
        CREATE TABLE onboarding_tasks(id uuid,title text,assigned_to uuid,created_by uuid,property_id uuid);
        CREATE TABLE onboarding_follows(property_id uuid,user_id uuid);
        CREATE TABLE onboarding_projects(id uuid,property_id uuid,handoff_state text,ready_for_ops_by uuid);
        CREATE TABLE onboarding_notes(task_id uuid,author_id uuid,body text,is_demo boolean);
        CREATE TABLE work_items(id uuid,kind text,status text,property_id uuid,program_id uuid,source_task_id uuid,title text,is_demo boolean,responded_at timestamptz,viewed_at timestamptz);
        CREATE TABLE owner_request_messages(id uuid DEFAULT gen_random_uuid(),work_item_id uuid,property_id uuid,program_id uuid,task_id uuid,author_id uuid,author_type text,author_name text,body text,is_demo boolean);
        CREATE TABLE owner_notifications(id uuid DEFAULT gen_random_uuid(),program_id uuid,owner_user_id uuid,review_id uuid,ticket_id uuid,kind text,priority text,title text,body text,action_path text,email_status text,sms_status text,is_demo boolean);
        CREATE TABLE staff_notifications(id uuid DEFAULT gen_random_uuid(),user_id uuid,kind text,title text,body text,entity_type text,entity_id uuid,read_at timestamptz,retracted_at timestamptz);
        CREATE FUNCTION private.notify_onboarding_recipients(uuid[],uuid,text,text,text,text,uuid,text,boolean) RETURNS void LANGUAGE sql AS $$ INSERT INTO staff_notifications(user_id,kind,title,body,entity_type,entity_id) VALUES($1[1],$3,$4,$5,$6,$7) $$;
        CREATE FUNCTION public.notify_staff(uuid,text,text,text,text,uuid,text,text,uuid,boolean,boolean) RETURNS void LANGUAGE sql AS $$ INSERT INTO staff_notifications(user_id,kind,title,body,entity_type,entity_id) VALUES($1,$2,$3,$4,$5,$6) $$;
      `);
      await db.exec(readFileSync("docs/pending/address-labels/01_helper.sql", "utf8"));
      for (const name of ["public.owner_release_summary", "private.notify_onboarding_note", "public.notify_onboarding_handoff_ready", "public.post_owner_request_message"]) {
        await db.exec(readFileSync(`docs/pending/address-labels/definitions/${name}.sql`, "utf8"));
      }
      await db.query("INSERT INTO properties VALUES($1,$2,$3,$4,$5,$6,$7,$8,false)", [home.id,home.name,home.nickname,home.address_line1,home.unit,home.city,home.state,home.postal_code]);
      await db.query("INSERT INTO profiles VALUES($1,'Rachel Ramsey','r@resolve-test.invalid'); INSERT INTO property_owners VALUES($1,true)", [owner]);
      await db.query("INSERT INTO owner_programs VALUES($1,$2,$2,'active',NULL,false,true); INSERT INTO owner_program_properties VALUES($1,$3,'included')", [program,owner,home.id]);
      await db.query("INSERT INTO onboarding_tasks VALUES($1,'Inspect home',$2,$2,$3); INSERT INTO work_items(id,kind,status,property_id,program_id,title,is_demo) VALUES($1,'opportunity','open',$3,$4,'Inspect home',false)", [task,owner,home.id,program]);
      await db.exec("CREATE TRIGGER test_note AFTER INSERT ON onboarding_notes FOR EACH ROW EXECUTE FUNCTION private.notify_onboarding_note(); CREATE TRIGGER test_handoff AFTER UPDATE ON onboarding_projects FOR EACH ROW EXECUTE FUNCTION public.notify_onboarding_handoff_ready();");
      await db.query("SELECT public.owner_release_summary($1,2,ARRAY[$2::uuid])", [program,home.id]);
      await db.query("INSERT INTO onboarding_notes VALUES($1,$2,'Checked',false)", [task,owner]);
      await db.query("INSERT INTO onboarding_projects VALUES($1,$2,'draft',$3); UPDATE onboarding_projects SET handoff_state='ready' WHERE id=$1", [task,home.id,owner]);
      await db.query("SELECT public.post_owner_request_message($1,'Update for the homeowner')", [task]);
      const alerts = await db.query<{kind:string;title:string;body:string}>("SELECT kind,title,body FROM owner_notifications UNION ALL SELECT kind,title,body FROM staff_notifications");
      expect(alerts.rows.length).toBe(4);
      for (const alert of alerts.rows) {
        expect(`${alert.title} ${alert.body}`).toContain("3400 N Fern Ave, Unit B");
        expect(`${alert.title} ${alert.body}`).not.toContain("Fernstone House");
      }
      const unchanged = await db.query<{name:string;nickname:string}>("SELECT name,nickname FROM properties");
      expect(unchanged.rows).toEqual([{ name: home.name, nickname: home.nickname }]);
    } finally { await db.close(); }
  });
});