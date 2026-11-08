// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL checks of docs/pending/fix-batch-1/. Tables are stubbed
 * with the real columns and checks each step reads. Nothing touches the real
 * database.
 */
const DIR = "docs/pending/fix-batch-1";
const ADMIN = "00000000-0000-4000-8000-000000000001";
const TECH = "00000000-0000-4000-8000-000000000002";
const ONBOARDING = "00000000-0000-4000-8000-000000000004";
const OLD_PERSON = "00000000-0000-4000-8000-000000000009";

// The live quiet triggers the import migrations rewrite (same list as notion-runner-sql.test.ts).
const QUIET = [
  ["tickets_auto_assign", "BEFORE INSERT", "auto_assign_ticket"],
  ["tickets_audit_auto_assign", "AFTER INSERT", "audit_ticket_auto_assign"],
  ["tickets_priority_authority", "BEFORE INSERT OR UPDATE OF priority", "enforce_ticket_priority_authority"],
  ["notify_ticket_events_trg", "AFTER INSERT OR UPDATE", "notify_ticket_events"],
  ["notify_ticket_flow_events_trg", "AFTER UPDATE", "notify_ticket_flow_events"],
  ["sync_ticket_work_item", "AFTER INSERT OR UPDATE", "sync_ticket_work_item"],
  ["tickets_notify_owner", "AFTER INSERT OR UPDATE", "notify_owner_of_ticket"],
  ["tickets_owner_opportunity", "AFTER INSERT OR UPDATE", "sync_ticket_opportunity_trigger"],
  ["tickets_insurance_risk_log", "AFTER INSERT OR UPDATE OF insurance_risk", "log_ticket_insurance_risk"],
  ["tickets_feedback_linked_work", "AFTER INSERT", "log_feedback_linked_work"],
  ["tickets_roll_quarterly_review", "AFTER UPDATE", "roll_quarterly_review"],
  ["handoff_carryover_ticket_completed", "AFTER UPDATE OF status", "complete_handoff_carryover_tasks"],
];
const QUIET_SQL = `
CREATE TABLE public.fired_log(name text);
${QUIET.map(([name, , fn]) => `CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.fired_log VALUES ('${name}'); RETURN NEW; END $$;`).join("\n")}
${QUIET.map(([name, ev, fn]) => `CREATE TRIGGER ${name} ${ev} ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.${fn}();`).join("\n")}
`;

const BASE = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${TECH}','tech'), ('${ONBOARDING}','onboarding');
CREATE SEQUENCE tickets_ref_seq;
CREATE TABLE public.tickets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ref int DEFAULT nextval('tickets_ref_seq'),
  title text, description text, category text DEFAULT 'other', entry_kind text, priority text DEFAULT 'p3',
  status text DEFAULT 'open', property_id uuid, assigned_to uuid, reported_at timestamptz DEFAULT now(),
  due_at timestamptz, resolved_at timestamptz, breezeway_task_url text, waiting_on text, waiting_reason text,
  source_channel text, source_reference text, external_source text, external_id text, external_status text,
  external_url text, external_synced_at timestamptz, is_demo boolean DEFAULT false, escalation_level text DEFAULT 'none',
  assignment_source text, assignment_note text, response_due_at timestamptz, action_due_at timestamptz, insurance_risk text,
  acknowledged_at timestamptz, action_started_at timestamptz, next_review_at timestamptz,
  handoff_status text DEFAULT 'none', pending_handoff_to uuid, current_action_owner uuid, record_owner uuid,
  accountable_owner uuid, archived_at timestamptz, last_reopened_at timestamptz, reopen_count int DEFAULT 0,
  -- The live default and check, copied from the real table: the default is refused by the check.
  record_type text DEFAULT 'ticket',
  CONSTRAINT tickets_record_type_chk CHECK (record_type IN ('completed_interaction','active_task','collaborative_matter')));
CREATE UNIQUE INDEX tickets_external_unique ON public.tickets (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE TABLE public.claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_type text NOT NULL, stage text NOT NULL,
  title text NOT NULL, incident_description text, property_id uuid, ticket_id uuid, estimated_amount numeric,
  recovered_amount numeric, currency text, created_by uuid, is_demo boolean);
CREATE UNIQUE INDEX claims_one_per_ticket ON public.claims(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid, kind text,
  event_type text, body text, internal boolean, is_demo boolean, to_owner uuid, created_at timestamptz DEFAULT now(), event_at timestamptz);
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, property_id uuid,
  kind text, title text, storage_path text, original_filename text, mime_type text, size_bytes bigint, upload_key text,
  upload_status text, uploaded_at timestamptz, uploaded_by uuid, visibility text, category text, note text, is_demo boolean);
CREATE UNIQUE INDEX documents_upload_key_once ON public.documents (upload_key) WHERE upload_key IS NOT NULL;
`;

const LIVE_IMPORT = [
  "drizzle/migrations/0243_notion_ticket_import.sql",
  "drizzle/migrations/0264_notion_reopen.sql",
  "drizzle/migrations/0273_notion_import_guard.sql",
];

async function fresh(extra: string[] = []) {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(QUIET_SQL);
  for (const f of [...LIVE_IMPORT, ...extra]) await db.exec(readFileSync(f, "utf8"));
  return db;
}
const asUser = (db: PGlite, id: string) => db.exec(`DELETE FROM public.me; INSERT INTO public.me VALUES ('${id}');`);
const one = async (db: PGlite, sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const importTicket = async (db: PGlite, p: unknown) =>
  (await db.query(`SELECT public.import_notion_ticket($1::jsonb) r`, [JSON.stringify(p)])).rows[0].r;
const page = (over: Record<string, unknown> = {}) => ({
  external_id: "page-1", external_url: "https://notion.so/p1", external_status: "In progress",
  external_synced_at: "2026-11-01T12:00:00Z", title: "Leaky faucet", description: "Imported from Notion",
  priority: "p2", status: "in_progress", property_id: null, assigned_to: null,
  reported_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  due_at: null, resolved_at: null, breezeway_task_url: null, waiting_on: null, waiting_reason: null, import_hold: null,
  ...over,
});

describe("part 1: a first time Notion import can create a ticket", () => {
  it("before the fix, the live import is refused by the ticket type check", async () => {
    const db = await fresh();
    await asUser(db, ADMIN);
    await expect(importTicket(db, page())).rejects.toThrow(/tickets_record_type_chk/);
  });

  it("creates an open recent ticket, a closed ticket and a ticket with a claim, all as active tasks", async () => {
    const db = await fresh([`${DIR}/01_notion_import_ticket_type.sql`]);
    await asUser(db, ADMIN);
    expect((await importTicket(db, page())).action).toBe("created");
    expect((await importTicket(db, page({ external_id: "page-2", status: "closed", external_status: "Done",
      resolved_at: "2026-10-01T00:00:00Z", reported_at: "2026-09-01T00:00:00Z" }))).action).toBe("created");
    expect((await importTicket(db, page({ external_id: "page-3",
      claim: { stage: "potential", estimated_amount: 420, recovered_amount: 0, notes: "Damage" } }))).action).toBe("created");
    const rows = (await db.query(`SELECT external_id, status, record_type FROM public.tickets ORDER BY external_id`)).rows;
    expect(rows).toEqual([
      { external_id: "page-1", status: "in_progress", record_type: "active_task" },
      { external_id: "page-2", status: "closed", record_type: "active_task" },
      { external_id: "page-3", status: "in_progress", record_type: "active_task" },
    ]);
    expect(Number((await one(db, "SELECT count(*) n FROM public.claims")).n)).toBe(1);
  });

  it("a rerun with the same sync changes nothing", async () => {
    const db = await fresh([`${DIR}/01_notion_import_ticket_type.sql`]);
    await asUser(db, ADMIN);
    await importTicket(db, page({ claim: { stage: "potential", estimated_amount: 420, recovered_amount: 0, notes: "Damage" } }));
    const before = await one(db, "SELECT t::text AS t FROM public.tickets t");
    const claimBefore = await one(db, "SELECT c::text AS c FROM public.claims c");
    expect((await importTicket(db, page({ claim: { stage: "potential", estimated_amount: 420, recovered_amount: 0, notes: "Damage" } }))).action).toBe("skipped");
    expect((await one(db, "SELECT t::text AS t FROM public.tickets t")).t).toBe(before.t);
    expect((await one(db, "SELECT c::text AS c FROM public.claims c")).c).toBe(claimBefore.c);
    expect(Number((await one(db, "SELECT count(*) n FROM public.tickets")).n)).toBe(1);
  });

  it("keeps the applied guard: Admin only, reopened is kept, a missing date is refused", async () => {
    const db = await fresh([`${DIR}/01_notion_import_ticket_type.sql`]);
    await asUser(db, TECH);
    await expect(importTicket(db, page())).rejects.toThrow(/Only an Admin/);
    await asUser(db, ADMIN);
    await expect(importTicket(db, page({ reported_at: null }))).rejects.toThrow(/Missing created date/);
    await importTicket(db, page());
    await db.exec(`UPDATE public.tickets SET external_status='reopened_in_resolve', status='open'`);
    expect((await importTicket(db, page({ external_synced_at: "2026-11-02T00:00:00Z", status: "closed" }))).action).toBe("kept");
    expect((await one(db, "SELECT status FROM public.tickets")).status).toBe("open");
    for (const role of ["anon", "service_role"]) {
      expect((await one(db, `SELECT has_function_privilege('${role}', 'public.import_notion_ticket(jsonb)', 'EXECUTE') ok`)).ok).toBe(false);
    }
    expect((await one(db, `SELECT has_function_privilege('authenticated', 'public.import_notion_ticket(jsonb)', 'EXECUTE') ok`)).ok).toBe(true);
  });

  it("the undo puts back the applied function exactly", async () => {
    const db = await fresh([`${DIR}/01_notion_import_ticket_type.sql`, `${DIR}/01_undo_notion_import_ticket_type.sql`]);
    await asUser(db, ADMIN);
    await expect(importTicket(db, page())).rejects.toThrow(/tickets_record_type_chk/);
  });
});

describe("part 2: reopen any closed ticket", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await fresh([`${DIR}/02_reopen_ticket.sql`]);
  });
  const closedTicket = async (cols = "", vals = "") =>
    (await db.query<{ id: string }>(
      `INSERT INTO public.tickets(title, status, record_type, assigned_to, current_action_owner, resolved_at, response_due_at${cols})
       VALUES ('Leak', 'closed', 'active_task', '${OLD_PERSON}', '${OLD_PERSON}', now() - interval '2 days', now() - interval '3 days'${vals}) RETURNING id`,
    )).rows[0].id;
  const reopen = (id: string, reason: string, resp = "now() + interval '30 minutes'", act = "now() + interval '60 minutes'") =>
    db.query(`SELECT public.reopen_ticket($1, $2, ${resp}, ${act}) r`, [id, reason]);

  it("a coordinator reopens a closed ordinary ticket: live, theirs, fresh clocks, one history line", async () => {
    const id = await closedTicket();
    await asUser(db, TECH);
    await reopen(id, "Guest wrote back");
    const t = await one(db, "SELECT * FROM public.tickets WHERE id=$1", [id]);
    expect(t.status).toBe("open");
    expect(t.assigned_to).toBe(TECH);
    expect(t.current_action_owner).toBe(TECH);
    expect(t.record_owner).toBe(TECH);
    expect(t.assignment_source).toBe("manual");
    expect(t.reopen_count).toBe(1);
    expect(t.resolved_at).toBeNull();
    expect(new Date(t.response_due_at).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(t.last_reopened_at).getTime()).toBeGreaterThan(Date.now() - 60_000);
    const h = (await db.query("SELECT * FROM public.ticket_activity WHERE ticket_id=$1", [id])).rows;
    expect(h.map((r) => [r.kind, r.event_type, r.body, r.author_id])).toEqual([
      ["reopened", "reopened", "Reopened. Reason: Guest wrote back", TECH],
    ]);
  });

  it("an onboarding account cannot reopen", async () => {
    const id = await closedTicket();
    await asUser(db, ONBOARDING);
    await expect(reopen(id, "Guest wrote back")).rejects.toThrow(/Only staff who work tickets/);
  });

  it("the reason must be 3 to 500 characters", async () => {
    const id = await closedTicket();
    await asUser(db, TECH);
    await expect(reopen(id, "  ok ")).rejects.toThrow(/short reason/);
    await expect(reopen(id, "x".repeat(501))).rejects.toThrow(/under 500/);
    await reopen(id, "abc");
  });

  it("refuses clocks that do not start from now", async () => {
    const id = await closedTicket();
    await asUser(db, TECH);
    await expect(reopen(id, "Guest wrote back", "now() - interval '1 minute'")).rejects.toThrow(/not valid/);
  });

  it("only a closed ticket; never archived or a one touch log", async () => {
    await asUser(db, TECH);
    const open = (await db.query<{ id: string }>(`INSERT INTO public.tickets(title, status, record_type) VALUES ('x','open','active_task') RETURNING id`)).rows[0].id;
    await expect(reopen(open, "Guest wrote back")).rejects.toThrow(/Only a closed ticket/);
    const archived = await closedTicket(", archived_at", ", now()");
    await expect(reopen(archived, "Guest wrote back")).rejects.toThrow(/archived/);
    const log = (await db.query<{ id: string }>(`INSERT INTO public.tickets(title, status, record_type) VALUES ('x','closed','completed_interaction') RETURNING id`)).rows[0].id;
    await expect(reopen(log, "Guest wrote back")).rejects.toThrow(/one touch log/);
  });

  it("a Notion import not yet live goes through the Notion reopen; a live one closed again reopens here", async () => {
    await asUser(db, TECH);
    const quiet = await closedTicket(", external_source, external_status", ", 'notion', 'Done'");
    await expect(reopen(quiet, "Guest wrote back")).rejects.toThrow(/Imported from Notion/);
    await db.query(`SELECT public.reopen_notion_ticket($1, 'Guest wrote back', now() + interval '30 minutes', now() + interval '60 minutes')`, [quiet]);
    expect((await one(db, "SELECT status, external_status FROM public.tickets WHERE id=$1", [quiet]))).toEqual({
      status: "open", external_status: "reopened_in_resolve",
    });
    await db.query(`UPDATE public.tickets SET status='closed' WHERE id=$1`, [quiet]);
    await reopen(quiet, "Same guest again");
    expect((await one(db, "SELECT status, assigned_to FROM public.tickets WHERE id=$1", [quiet]))).toEqual({ status: "open", assigned_to: TECH });
  });

  it("only signed-in sessions can call it, and the undo removes it", async () => {
    for (const role of ["anon", "service_role", "public"]) {
      expect((await one(db, `SELECT has_function_privilege('${role}', 'public.reopen_ticket(uuid,text,timestamptz,timestamptz)', 'EXECUTE') ok`)).ok).toBe(false);
    }
    expect((await one(db, `SELECT has_function_privilege('authenticated', 'public.reopen_ticket(uuid,text,timestamptz,timestamptz)', 'EXECUTE') ok`)).ok).toBe(true);
    await db.exec(readFileSync(`${DIR}/02_undo_reopen_ticket.sql`, "utf8"));
    expect((await one(db, `SELECT to_regprocedure('public.reopen_ticket(uuid,text,timestamptz,timestamptz)') p`)).p).toBeNull();
  });
});

describe("part 3: Claims go to Team B", () => {
  it("moves only the Claims work type, and the undo puts it back", async () => {
    const db = new PGlite();
    await db.exec(`CREATE TABLE public.work_types(id serial, name text, team text, functional_role_code text, backup_coverage text, response_minutes int);
      INSERT INTO public.work_types(name, team, functional_role_code, backup_coverage, response_minutes) VALUES
      ('Claims','guest_experience','ge_day','Other Guest Experience role; escalate decisions beyond authority',30),
      ('Arrival information','guest_experience','ge_day','Other Guest Experience role',30),
      ('Immediate maintenance','property_operations','po_day','Other Property Operations role',3),
      ('Escalated owner issue','leadership','director_ops',null,60);`);
    const snap = async () => (await db.query(`SELECT name, team, functional_role_code, backup_coverage, response_minutes FROM public.work_types ORDER BY id`)).rows;
    const before = await snap();
    await db.exec(readFileSync(`${DIR}/03_claims_team_b.sql`, "utf8"));
    const after = await snap();
    expect(after[0]).toEqual({ name: "Claims", team: "property_operations", functional_role_code: "po_day",
      backup_coverage: "Other Property Operations role; escalate decisions beyond authority", response_minutes: 30 });
    expect(after.slice(1)).toEqual(before.slice(1));
    await db.exec(readFileSync(`${DIR}/03_undo_claims_team_b.sql`, "utf8"));
    expect(await snap()).toEqual(before);
  });
});

describe("part 4: the add-only record tables lose direct write rights", () => {
  it("revokes writes from signed-in and signed-out sessions; reads and elevated writers keep working", async () => {
    const db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE public.scorecard_records(id serial, note text);
      CREATE TABLE public.ticket_state_log(id serial, note text);
      CREATE TABLE public.routine_check_corrections(id serial, note text);
      GRANT ALL ON public.scorecard_records, public.ticket_state_log, public.routine_check_corrections TO anon, authenticated;
      CREATE FUNCTION public.write_all(_n text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        INSERT INTO public.scorecard_records(note) VALUES (_n);
        INSERT INTO public.ticket_state_log(note) VALUES (_n);
        INSERT INTO public.routine_check_corrections(note) VALUES (_n); $$;
      GRANT EXECUTE ON FUNCTION public.write_all(text) TO authenticated;`);
    await db.exec(readFileSync(`${DIR}/04_tighten_record_tables.sql`, "utf8"));
    for (const t of ["scorecard_records", "ticket_state_log", "routine_check_corrections"]) {
      for (const r of ["anon", "authenticated"]) {
        for (const p of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
          expect({ t, r, p, ok: (await one(db, `SELECT has_table_privilege('${r}','public.${t}','${p}') ok`)).ok }).toEqual({ t, r, p, ok: false });
        }
        expect((await one(db, `SELECT has_table_privilege('${r}','public.${t}','SELECT') ok`)).ok).toBe(true);
      }
    }
    await db.exec(`SET ROLE authenticated`);
    await db.query(`SELECT public.write_all('from a record function')`);
    await expect(db.query(`INSERT INTO public.scorecard_records(note) VALUES ('direct')`)).rejects.toThrow(/permission denied/);
    expect(Number((await one(db, `SELECT count(*) n FROM public.ticket_state_log`)).n)).toBe(1);
    await db.exec(`RESET ROLE`);
    await db.exec(readFileSync(`${DIR}/04_undo_tighten_record_tables.sql`, "utf8"));
    expect((await one(db, `SELECT has_table_privilege('authenticated','public.scorecard_records','INSERT') ok`)).ok).toBe(true);
  });
});
