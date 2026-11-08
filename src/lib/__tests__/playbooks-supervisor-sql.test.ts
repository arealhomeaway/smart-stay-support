// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * docs/pending/playbooks-supervisor/ (Nov 8, 2026, Emily). Matrix line Playbooks:
 * coordinators view, Supervisor edit, Director of Operations edit, Director of
 * Onboarding edit, Admin edit, Project Manager, Utilities, Design and Finance view.
 * Each staged function is its live copy with only the permission line changed.
 * Nothing touches the real database.
 */
const DIR = "docs/pending/playbooks-supervisor";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const FNS = ["change_playbook_state", "reserve_sop_upload", "sop_upload_context", "sop_upload_receipt", "commit_sop_upload", "abort_sop_upload"];

const ADMIN = "00000000-0000-0000-0000-000000000001", OPS = "00000000-0000-0000-0000-000000000002", ONBOARD = "00000000-0000-0000-0000-000000000003";
const SUP = "00000000-0000-0000-0000-000000000004", PC = "00000000-0000-0000-0000-000000000005", PM = "00000000-0000-0000-0000-000000000006";
const FIN = "00000000-0000-0000-0000-000000000007", COVER = "00000000-0000-0000-0000-000000000008";
const STAFF = [ADMIN, OPS, ONBOARD, SUP, PC, PM, FIN, COVER];

/** Split a staged or undo file into its CREATE OR REPLACE bodies, keyed by function name. */
function bodies(text: string) {
  const out: Record<string, string> = {};
  for (const part of text.split(/(?=CREATE OR REPLACE FUNCTION )/).filter((p) => p.startsWith("CREATE OR REPLACE"))) {
    const name = /FUNCTION public\.(\w+)\(/.exec(part)![1]!;
    out[name] = part.trim().replace(/;$/, "");
  }
  return out;
}

describe("staged files change only the permission line", () => {
  const staged = bodies(read("01_playbooks_supervisor.sql"));
  const undo = bodies(read("01_playbooks_supervisor.undo.sql"));

  it("touches exactly the six playbook and SOP actions", () => {
    expect(Object.keys(staged).sort()).toEqual([...FNS].sort());
    expect(Object.keys(undo).sort()).toEqual([...FNS].sort());
  });

  for (const fn of FNS) {
    it(`${fn}: one line differs from the live copy and it reads the editor rule`, () => {
      const live = read(`live-capture/${fn}.sql`).trim().split("\n");
      const body = staged[fn]!.split("\n");
      expect(body.length).toBe(live.length);
      const diff = body.map((l, i) => (l === live[i] ? null : i)).filter((i) => i !== null);
      expect(diff.length).toBe(1);
      expect(live[diff[0]!]).toContain("public.can_manage_playbooks(");
      expect(body[diff[0]!]).toContain("public.can_save_playbooks(");
      expect(body[diff[0]!]).toContain("the Operations Supervisor");
      expect(staged[fn]).not.toContain("can_manage_playbooks");
    });
    it(`${fn}: the undo restores the live copy exactly`, () => {
      expect(undo[fn]).toBe(read(`live-capture/${fn}.sql`).trim());
    });
  }

  it("the editor rule itself is unchanged: Admin, both Directors, and the Operations Supervisor holder or cover", () => {
    const rule = read("live-capture/can_save_playbooks.sql");
    expect(rule).toContain("public.can_manage_playbooks(_user_id)");
    expect(rule).toContain("public.holds_functional_role(_user_id, 'ops_supervisor')");
    expect(rule).toContain("public.seat_holder_at('ops_supervisor') = _user_id");
    expect(read("01_playbooks_supervisor.sql")).not.toContain("FUNCTION public.can_save_playbooks");
  });
});

// ---------------------------------------------------------------------------
// Behaviour: earlier staged playbook and SOP files build the tables, then the
// live editor rule and this folder's functions are loaded on top.
// ---------------------------------------------------------------------------
const columns = `id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, category text NOT NULL, summary text, active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), playbook_key text, version integer DEFAULT 1, status text DEFAULT 'active', effective_on date, approved_by uuid, applies_to text[] DEFAULT ARRAY['ticket'], matcher jsonb DEFAULT '{}', priority_reason text, risk_flags jsonb DEFAULT '[]', immediate_actions text[] DEFAULT '{}', escalate_if text[] DEFAULT '{}', vendor_brief jsonb, source text DEFAULT 'authored', source_refs text[] DEFAULT '{}', supersedes_id uuid, requires_director boolean DEFAULT false, submitted_by uuid, submitted_at timestamptz, approved_at timestamptz, retired_at timestamptz, review_note text, source_version text, generated_at timestamptz, required_evidence text[] DEFAULT '{}', checklist jsonb`;
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
 CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${ADMIN}'::uuid AND r='admin' $$;
 CREATE FUNCTION public.is_director(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${OPS}'::uuid $$;
 CREATE FUNCTION public.is_onboarding_director(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${ONBOARD}'::uuid $$;
 CREATE FUNCTION public.is_internal_staff(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u = ANY(ARRAY['${STAFF.join("','")}']::uuid[]) $$;
 CREATE TABLE public.functional_roles(code text, active boolean DEFAULT true, current_seat_holder uuid);
 CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
 INSERT INTO public.functional_roles VALUES ('ops_supervisor',true,'${SUP}'),('onboarding_project_manager',true,'${PM}'),('finance_lead',true,'${FIN}');
 CREATE TABLE public.cover(role_code text, user_id uuid);
 CREATE FUNCTION public.holds_functional_role(_user_id uuid, _code text) RETURNS boolean LANGUAGE sql STABLE AS $$
   SELECT EXISTS (SELECT 1 FROM public.functional_roles WHERE code=_code AND active AND current_seat_holder=_user_id)
       OR EXISTS (SELECT 1 FROM public.functional_role_members WHERE role_code=_code AND user_id=_user_id) $$;
 CREATE FUNCTION public.seat_holder_at(_role_code text, _at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql STABLE AS
   $$ SELECT coalesce((SELECT user_id FROM public.cover WHERE role_code=_role_code LIMIT 1),(SELECT current_seat_holder FROM public.functional_roles WHERE code=_role_code)) $$;
 CREATE TABLE public.playbooks(${columns});
 CREATE TABLE public.playbook_steps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),playbook_id uuid,position integer,instruction text,detail text,required boolean DEFAULT true,photo_required boolean DEFAULT false);
 CREATE TABLE public.playbook_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),playbook_id uuid,from_status text,to_status text,actor_id uuid,actor_role text,note text,version integer,created_at timestamptz DEFAULT now());
 CREATE TABLE public.work_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),playbook_id uuid);
 CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),playbook_id uuid);
 CREATE FUNCTION public.qa_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
 CREATE TRIGGER qa_updated BEFORE UPDATE ON public.playbooks FOR EACH ROW EXECUTE FUNCTION public.qa_updated();`);
  await db.exec(readFileSync("docs/pending/playbooks-nov5/01_playbook_editing.sql", "utf8"));
  await db.exec("CREATE TABLE profiles(id uuid PRIMARY KEY);");
  for (const u of STAFF) await db.query("INSERT INTO profiles(id) VALUES($1)", [u]);
  await db.exec(readFileSync("docs/pending/sop-upload/01_sop_upload.sql", "utf8"));
  // Live editor rules (read Nov 8), then the live save function and this folder.
  await db.exec(readFileSync("docs/pending/fix-batch-2/live-capture/can_manage_playbooks.sql", "utf8") + ";");
  await db.exec(read("live-capture/can_save_playbooks.sql") + ";");
  await db.exec(readFileSync("docs/pending/fix-batch-2/01_playbook_supervisor_save.sql", "utf8"));
  await db.exec(read("01_playbooks_supervisor.sql"));
});
afterAll(async () => { await db.close(); });

const as = (u: string | null) => db.query("select set_config('qa.uid',$1,false),set_config('resolve.playbook_write','',false)", [u ?? ""]);
const content = (title = "Edited") => ({ title, category: "maintenance", summary: "New", applies_to: ["ticket"], keywords: ["leak"], risk_flags: [], immediate_actions: ["Shut off water"], escalate_if: [], required_evidence: [], steps: [{ instruction: "Inspect", detail: null, required: true, photo_required: false }] });
async function seed(status = "draft") {
  await as(null);
  const r = await db.query<{ id: string }>("insert into playbooks(title,category,status,active,playbook_key) values('Original','maintenance',$1,$2,$3) returning id", [status, status === "active", crypto.randomUUID()]);
  return r.rows[0]!.id;
}
const row = async (id: string) => (await db.query<Record<string, any>>("select * from playbooks where id=$1", [id])).rows[0] ?? {};
const save = async (id: string) => { const r = await row(id); return (await db.query<{ r: { id: string } }>("select save_playbook_draft($1,$2,$3) r", [id, r.updated_at, JSON.stringify(content())])).rows[0]?.r; };
const state = async (id: string, action: string, note = "Checked") => { const r = await row(id); return db.query("select change_playbook_state($1,$2,$3,$4)", [id, r.updated_at, action, note]); };
const failure = async (fn: () => Promise<unknown>) => { try { await fn(); return ""; } catch (e) { return e instanceof Error ? e.message : String(e); } };
const history = async (id: string) => (await db.query<{ to_status: string; actor_id: string }>("select to_status, actor_id from playbook_approvals where playbook_id=$1 order by created_at", [id])).rows;
const reserve = async (name: string) => (await db.query<{ r: { id: string } }>("select reserve_sop_upload($1,$2,'2026-11-08') r", [name, SUP])).rows[0]?.r;
const commit = async (id: string) => (await db.query<{ r: { draftIds: string[] } }>("select commit_sop_upload($1,$2,$3) r", [id, JSON.stringify({ id: "file", driveId: "drive", url: "https://arealhomeaway.sharepoint.com/file" }), JSON.stringify([{ previousPlaybookId: null, situations: [], checklistCategories: [], content: content() }])])).rows[0]?.r;

describe("playbooks: Supervisor edits, everyone else views", () => {
  for (const [name, u] of [["Operations Supervisor", SUP], ["Operations Supervisor cover", COVER], ["Director of Operations", OPS], ["Director of Onboarding", ONBOARD], ["Admin", ADMIN]] as const) {
    it(`${name} saves, approves, archives and uploads, and each action writes its history`, async () => {
      if (u === COVER) await db.exec(`INSERT INTO public.cover VALUES ('ops_supervisor','${COVER}')`);
      try {
        const id = await seed("draft");
        await as(u);
        expect(await failure(() => save(id))).toBe("");
        expect(await failure(() => state(id, "approve"))).toBe("");
        expect((await row(id)).status).toBe("approved");
        expect((await row(id)).approved_by).toBe(u);
        expect(await failure(() => state(id, "archive"))).toBe("");
        expect((await row(id)).status).toBe("retired");
        expect(await history(id)).toEqual([{ to_status: "approved", actor_id: u }, { to_status: "retired", actor_id: u }]);
        const r = await reserve(`${name}.pdf`);
        expect(await failure(() => db.query("select sop_upload_context($1)", [`${name}.pdf`]))).toBe("");
        const receipt = await commit(r!.id);
        expect(receipt!.draftIds.length).toBe(1);
        const v = (await db.query<Record<string, any>>("select state, uploaded_by, version from sop_versions where id=$1", [r!.id])).rows[0];
        expect(v).toEqual({ state: "saved", uploaded_by: u, version: 1 });
        expect((await row(receipt!.draftIds[0]!)).status).toBe("draft");
        const spare = await reserve(`${name} spare.pdf`);
        expect(await failure(() => db.query("select abort_sop_upload($1)", [spare!.id]))).toBe("");
      } finally {
        if (u === COVER) await db.exec("DELETE FROM public.cover");
      }
    });
  }

  for (const [name, u] of [["Property Coordinator", PC], ["Project Manager", PM], ["Finance", FIN]] as const) {
    it(`${name} is refused every change and nothing is written`, async () => {
      const draft = await seed("draft");
      const active = await seed("active");
      await as(u);
      expect(await failure(() => save(draft))).toContain("Only Admins, Directors and the Operations Supervisor");
      for (const [id, action] of [[draft, "approve"], [active, "archive"], [draft, "submit"], [active, "note"]] as const) {
        expect(await failure(() => state(id, action))).toContain("Only Admins, Directors and the Operations Supervisor can change playbooks.");
      }
      expect(await failure(() => reserve(`${name}.pdf`))).toContain("Only Admins, Directors and the Operations Supervisor can upload SOPs.");
      expect(await failure(() => db.query("select sop_upload_context('x.pdf')"))).toContain("can upload SOPs.");
      expect(await failure(() => db.query("select sop_upload_receipt(gen_random_uuid())"))).toContain("can upload SOPs.");
      expect(await failure(() => db.query("select abort_sop_upload(gen_random_uuid())"))).toContain("can upload SOPs.");
      expect(await history(draft)).toEqual([]);
      expect(await history(active)).toEqual([]);
      expect((await row(draft)).status).toBe("draft");
      expect((await row(active)).status).toBe("active");
      expect((await db.query("select count(*)::int n from sop_versions where original_name=$1", [`${name}.pdf`])).rows[0]).toEqual({ n: 0 });
    });
  }

  it("signed out is refused", async () => {
    const id = await seed("draft");
    await as(null);
    expect(await failure(() => state(id, "approve"))).toContain("Staff access required.");
    expect(await failure(() => reserve("anon.pdf"))).toContain("can upload SOPs.");
  });

  it("the undo puts the Director-only rule back", async () => {
    await db.exec(read("01_playbooks_supervisor.undo.sql"));
    const id = await seed("draft");
    await as(SUP);
    expect(await failure(() => state(id, "approve"))).toContain("Only Admins and Directors can approve or archive playbooks.");
    expect(await failure(() => reserve("after-undo.pdf"))).toContain("Only Admins and Directors can upload SOPs.");
    await as(PC);
    expect(await failure(() => state(id, "submit"))).toBe("");
  });
});
