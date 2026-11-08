// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { canEditPlaybooks } from "../playbook-editing";
import { capabilitiesFor } from "../permissions";
import { canOpenPath } from "../route-access";

/**
 * docs/pending/playbook-roles-checklists/ (Emily, answers D1 and D2; register A15).
 * D1: new playbook history lines record the Operations Supervisor as 'ops_supervisor'; old lines stay.
 * D2: Ticket checklists follow the playbook rule. The Operations Supervisor (holder or cover), both
 * Directors and Admin edit; every other account, Finance included, views only. Screen and database
 * read the same rule. Nothing here touches the real database.
 */
const DIR = "docs/pending/playbook-roles-checklists";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const body = (text: string) => text.slice(text.indexOf("CREATE OR REPLACE FUNCTION")).trim();
const diffLines = (a: string, b: string) => {
  const x = a.split("\n"), y = b.split("\n");
  expect(x.length).toBe(y.length);
  return x.map((l, i) => (l === y[i] ? null : i)).filter((i) => i !== null) as number[];
};

describe("staged files change only the lines named", () => {
  it("history role: one line differs from the live copy and it adds the Supervisor role", () => {
    const live = read("live-capture/change_playbook_state.sql").trim();
    const staged = body(read("01_playbook_history_role.sql"));
    const d = diffLines(live, staged);
    expect(d.length).toBe(1);
    const line = staged.split("\n")[d[0]!]!;
    expect(line).toContain("WHEN public.can_save_playbooks(_actor) THEN 'ops_supervisor' ELSE 'staff' END;");
    expect(body(read("01_playbook_history_role.undo.sql"))).toBe(live);
  });

  it("checklists: only the permission check and its message differ from the live copy", () => {
    const live = read("live-capture/publish_ticket_checklist.sql").trim();
    const staged = body(read("02_ticket_checklist_editors.sql"));
    const d = diffLines(live, staged);
    expect(d.length).toBe(2);
    expect(staged.split("\n")[d[0]!]).toBe("  IF uid IS NULL OR NOT public.can_save_playbooks(uid) THEN");
    expect(staged.split("\n")[d[1]!]).toContain("Only Admins, Directors and the Operations Supervisor can publish a ticket checklist.");
    expect(body(read("02_ticket_checklist_editors.undo.sql"))).toBe(live);
  });
});

// Accounts as the screens see them (same shapes as access-matrix.test.ts).
const SCREEN = {
  PC: { roles: ["tech"], seats: {}, edit: false },
  Supervisor: { roles: ["manager"], seats: { opsSupervisor: true }, edit: true },
  DirOps: { roles: ["manager"], seats: { opsDirector: true }, edit: true },
  DirOnb: { roles: ["onboarding"], seats: { onboardingDirector: true }, edit: true },
  Admin: { roles: ["admin"], seats: {}, edit: true },
  PM: { roles: ["onboarding"], seats: { projectManager: true }, edit: false },
  Utilities: { roles: ["onboarding"], seats: { utilities: true }, edit: false },
  Design: { roles: ["onboarding"], seats: {}, edit: false },
  Finance: { roles: ["manager"], seats: { finance: true }, edit: false },
} as const;

describe("Ticket checklists screen follows the playbook rule", () => {
  const page = readFileSync("src/routes/_authenticated/ticket-checklists.tsx", "utf8");
  it("the page reads the one editor rule", () => {
    expect(page).toContain("const canEdit = canEditPlaybooks(role.roles, role.access.seats);");
    expect(page).not.toContain("role.access.seats.opsDirector === true");
  });
  for (const [name, a] of Object.entries(SCREEN)) {
    it(`${name}: opens the page and ${a.edit ? "edits" : "views only"}`, () => {
      expect(canEditPlaybooks(a.roles as never, a.seats)).toBe(a.edit);
      expect(capabilitiesFor(a.roles as never, a.seats).has("playbooks_view")).toBe(true);
      expect(canOpenPath("/ticket-checklists", { roles: a.roles as never, seats: a.seats } as never)).toBe(true);
    });
  }
  it("homeowners and vendors never open it", () => {
    expect(canOpenPath("/ticket-checklists", { roles: ["owner"], seats: {} } as never)).toBe(false);
    expect(canOpenPath("/ticket-checklists", { roles: ["vendor"], seats: {} } as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Behaviour in an isolated database: live editor rules, then this folder.
// ---------------------------------------------------------------------------
const ADMIN = "00000000-0000-0000-0000-000000000001", OPS = "00000000-0000-0000-0000-000000000002", ONBOARD = "00000000-0000-0000-0000-000000000003";
const SUP = "00000000-0000-0000-0000-000000000004", PC = "00000000-0000-0000-0000-000000000005", PM = "00000000-0000-0000-0000-000000000006";
const FIN = "00000000-0000-0000-0000-000000000007", COVER = "00000000-0000-0000-0000-000000000008";
const STAFF = [ADMIN, OPS, ONBOARD, SUP, PC, PM, FIN, COVER];
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
 CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${ADMIN}'::uuid AND r='admin' $$;
 CREATE FUNCTION private.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${ADMIN}'::uuid AND r='admin' $$;
 CREATE FUNCTION public.is_director(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${OPS}'::uuid $$;
 CREATE FUNCTION private.is_director(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u IN ('${ADMIN}'::uuid,'${OPS}'::uuid) $$;
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
 CREATE TABLE public.playbooks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, category text, active boolean DEFAULT false,
   playbook_key text, version integer DEFAULT 1, status text DEFAULT 'draft', approved_by uuid, approved_at timestamptz, effective_on date,
   applies_to text[], source text, supersedes_id uuid, review_note text, retired_at timestamptz, submitted_by uuid, submitted_at timestamptz,
   checklist jsonb, checklist_category text, sop_url text, updated_at timestamptz DEFAULT now());
 CREATE TABLE public.playbook_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), playbook_id uuid, from_status text, to_status text,
   actor_id uuid, actor_role text, note text, version integer, created_at timestamptz DEFAULT now());
 CREATE TABLE public.work_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), playbook_id uuid);
 CREATE TABLE public.audit_log(actor_id uuid, action text, entity_type text, entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb);`);
  await db.exec(readFileSync("docs/pending/fix-batch-2/live-capture/can_manage_playbooks.sql", "utf8") + ";");
  await db.exec(read("live-capture/can_save_playbooks.sql"));
  await db.exec(read("01_playbook_history_role.sql"));
  await db.exec(read("02_ticket_checklist_editors.sql"));
});
afterAll(async () => { await db.close(); });

const as = (u: string | null) => db.query("select set_config('qa.uid',$1,false)", [u ?? ""]);
const failure = async (fn: () => Promise<unknown>) => { try { await fn(); return ""; } catch (e) { return String((e as Error).message); } };
const steps = JSON.stringify({ priority: "p2", steps: [{ id: "s1", question: "Check the door", kind: "yes_no" }] });
const publish = (cat = "lockout") => db.query<{ id: string }>("select publish_ticket_checklist($1,'Lockout',$2::jsonb) id", [cat, steps]);
const approve = async (u: string) => {
  await as(null);
  const r = await db.query<{ id: string; updated_at: string }>("insert into playbooks(title,category,playbook_key) values('Leak','maintenance',$1) returning id, updated_at", [crypto.randomUUID()]);
  await as(u);
  await db.query("select change_playbook_state($1,$2,'approve','')", [r.rows[0]!.id, r.rows[0]!.updated_at]);
  return (await db.query<{ actor_role: string }>("select actor_role from playbook_approvals where playbook_id=$1", [r.rows[0]!.id])).rows[0]?.actor_role;
};

describe("ticket checklist publishing", () => {
  for (const [name, u] of [["Operations Supervisor", SUP], ["Director of Operations", OPS], ["Director of Onboarding", ONBOARD], ["Admin", ADMIN]] as const) {
    it(`${name} publishes a new version`, async () => {
      const before = (await db.query<{ n: number }>("select count(*)::int n from playbooks where checklist is not null")).rows[0]!.n;
      await as(u);
      expect(await failure(() => publish())).toBe("");
      expect((await db.query<{ n: number }>("select count(*)::int n from playbooks where checklist is not null")).rows[0]!.n).toBe(before + 1);
      expect((await db.query<{ n: number }>("select count(*)::int n from playbooks where checklist_category='lockout' and status='approved'")).rows[0]!.n).toBe(1);
    });
  }

  it("whoever covers the Operations Supervisor role publishes", async () => {
    await db.query("insert into cover values('ops_supervisor',$1)", [COVER]);
    try { await as(COVER); expect(await failure(() => publish())).toBe(""); }
    finally { await db.exec("DELETE FROM public.cover"); }
  });

  for (const [name, u] of [["Finance", FIN], ["Property Coordinator", PC], ["Project Manager", PM], ["signed out", null]] as const) {
    it(`${name} is refused and nothing is written`, async () => {
      const before = (await db.query<{ n: number }>("select count(*)::int n from audit_log")).rows[0]!.n;
      await as(u);
      expect(await failure(() => publish())).toContain("Only Admins, Directors and the Operations Supervisor can publish a ticket checklist.");
      expect((await db.query<{ n: number }>("select count(*)::int n from audit_log")).rows[0]!.n).toBe(before);
    });
  }
});

describe("playbook history role", () => {
  it("records each editor's role; the Operations Supervisor holder and cover record ops_supervisor", async () => {
    expect(await approve(SUP)).toBe("ops_supervisor");
    expect(await approve(ADMIN)).toBe("admin");
    expect(await approve(OPS)).toBe("director_ops");
    expect(await approve(ONBOARD)).toBe("onboarding_director");
    await db.query("insert into cover values('ops_supervisor',$1)", [COVER]);
    try { expect(await approve(COVER)).toBe("ops_supervisor"); }
    finally { await db.exec("DELETE FROM public.cover"); }
  });

  it("existing history lines never change", async () => {
    await as(null);
    await db.query("insert into playbook_approvals(playbook_id,to_status,actor_id,actor_role) values(gen_random_uuid(),'approved',$1,'staff')", [SUP]);
    await approve(SUP);
    expect((await db.query<{ n: number }>("select count(*)::int n from playbook_approvals where actor_role='staff'")).rows[0]!.n).toBe(1);
  });

  it("the undo files put the live copies back", async () => {
    await db.exec(read("01_playbook_history_role.undo.sql"));
    await db.exec(read("02_ticket_checklist_editors.undo.sql"));
    expect(await approve(SUP)).toBe("staff");
    await as(SUP);
    expect(await failure(() => publish())).toContain("Only an Admin or the Operations Director can publish a ticket checklist.");
  });
});
