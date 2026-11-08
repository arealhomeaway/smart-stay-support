// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/notion-runner/01_import_guard.sql,
 * loaded on top of the live import functions (migration 0243) and the live
 * reopen protection (migration 0264). Nothing touches the real database.
 */
const ADMIN = "00000000-0000-4000-8000-000000000001";
const STAFF = "00000000-0000-4000-8000-000000000002";
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
const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE TABLE public.fired_log(name text);
CREATE SEQUENCE tickets_ref_seq;
CREATE TABLE public.tickets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ref int DEFAULT nextval('tickets_ref_seq'),
  title text, description text, category text DEFAULT 'other', entry_kind text, priority text DEFAULT 'p3',
  status text DEFAULT 'open', property_id uuid, assigned_to uuid, reported_at timestamptz DEFAULT now(),
  due_at timestamptz, resolved_at timestamptz, breezeway_task_url text, waiting_on text, waiting_reason text,
  source_channel text, source_reference text, external_source text, external_id text, external_status text,
  external_url text, external_synced_at timestamptz, is_demo boolean DEFAULT false, escalation_level text DEFAULT 'none',
  assignment_source text, assignment_note text, response_due_at timestamptz, insurance_risk text);
CREATE UNIQUE INDEX tickets_external_unique ON public.tickets (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE TABLE public.claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_type text NOT NULL, stage text NOT NULL,
  title text NOT NULL, incident_description text, property_id uuid, ticket_id uuid, estimated_amount numeric,
  recovered_amount numeric, currency text, created_by uuid, is_demo boolean);
CREATE UNIQUE INDEX claims_one_per_ticket ON public.claims(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid, kind text,
  event_type text, body text, internal boolean, is_demo boolean, created_at timestamptz DEFAULT now(), event_at timestamptz);
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, property_id uuid,
  kind text, title text, storage_path text, original_filename text, mime_type text, size_bytes bigint, upload_key text,
  upload_status text, uploaded_at timestamptz, uploaded_by uuid, visibility text, category text, note text, is_demo boolean);
CREATE UNIQUE INDEX documents_upload_key_once ON public.documents (upload_key) WHERE upload_key IS NOT NULL;
${QUIET.map(([name, , fn]) => `CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.fired_log VALUES ('${name}'); RETURN NEW; END $$;`).join("\n")}
${QUIET.map(([name, ev, fn]) => `CREATE TRIGGER ${name} ${ev} ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.${fn}();`).join("\n")}
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${STAFF}','tech');
`;

let db: PGlite;
const ticket = (over: Record<string, unknown> = {}) => ({
  external_id: "page-1", external_url: "https://notion.so/p1", external_status: "In progress",
  external_synced_at: "2026-10-20T12:00:00Z", title: "Leaky faucet", description: "Imported from Notion",
  priority: "p2", status: "in_progress", property_id: null, assigned_to: null, reported_at: "2026-10-30T00:00:00Z",
  due_at: null, resolved_at: null, breezeway_task_url: null, waiting_on: null, waiting_reason: null, import_hold: null,
  claim: { stage: "potential", estimated_amount: 420, recovered_amount: 100, notes: "Imported from Notion" },
  ...over,
});
const asUser = (id: string) => db.exec(`DELETE FROM public.me; INSERT INTO public.me VALUES ('${id}');`);
const call = async (p: unknown) => (await db.query(`SELECT public.import_notion_ticket($1::jsonb) r`, [JSON.stringify(p)])).rows[0].r;
const one = async (sql: string) => (await db.query(sql)).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync("drizzle/migrations/0243_notion_ticket_import.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0264_notion_reopen.sql", "utf8"));
  await db.exec(readFileSync("docs/pending/notion-runner/01_import_guard.sql", "utf8"));
  await asUser(ADMIN);
});

describe("staged Notion runner guard", () => {
  it("still refuses anyone who is not an Admin", async () => {
    await asUser(STAFF);
    await expect(call(ticket())).rejects.toThrow(/Only an Admin/);
    await asUser(ADMIN);
  });

  it("creates once and never duplicates on the Notion page ID", async () => {
    expect((await call(ticket())).action).toBe("created");
    expect((await call(ticket())).action).toBe("skipped");
    expect((await call(ticket({ external_synced_at: "2026-10-21T12:00:00Z" }))).action).toBe("updated");
    expect(Number((await one("SELECT count(*) n FROM public.tickets WHERE external_id='page-1'")).n)).toBe(1);
    expect(Number((await one("SELECT count(*) n FROM public.claims")).n)).toBe(1);
    expect(Number((await one("SELECT count(*) n FROM public.fired_log")).n)).toBe(0);
  });

  it("a reopened ticket is kept as it is, and so is its claim", async () => {
    await db.exec(`UPDATE public.tickets SET external_status='reopened_in_resolve', status='open', assigned_to='${STAFF}' WHERE external_id='page-1'`);
    await db.exec(`UPDATE public.claims SET stage='costing', incident_description='Worked in Resolve'`);
    const r = await call(ticket({ external_synced_at: "2026-11-01T00:00:00Z", status: "closed", title: "Changed in Notion",
      claim: { stage: "potential", estimated_amount: 1, recovered_amount: 0, notes: "Imported again" } }));
    expect(r.action).toBe("kept");
    const t = await one("SELECT * FROM public.tickets WHERE external_id='page-1'");
    expect(t.status).toBe("open");
    expect(t.title).toBe("Leaky faucet");
    expect(t.assigned_to).toBe(STAFF);
    const c = await one("SELECT * FROM public.claims");
    expect(c.stage).toBe("costing");
    expect(c.incident_description).toBe("Worked in Resolve");
    expect(Number(c.estimated_amount)).toBe(420);
  });

  it("a missing created date is refused, never turned into now", async () => {
    await expect(call(ticket({ external_id: "page-2", reported_at: null }))).rejects.toThrow(/Missing created date/);
    await expect(call(ticket({ external_id: "page-2", reported_at: "" }))).rejects.toThrow(/Missing created date/);
  });

  it("only signed-in sessions can execute the import functions", async () => {
    for (const fn of ["import_notion_ticket(jsonb)", "import_notion_ticket_comments(uuid, jsonb)", "import_notion_ticket_file(uuid, jsonb)"]) {
      for (const role of ["anon", "service_role", "public"]) {
        const r = await one(`SELECT has_function_privilege('${role}', 'public.${fn}', 'EXECUTE') ok`);
        expect({ fn, role, ok: r.ok }).toEqual({ fn, role, ok: false });
      }
      expect((await one(`SELECT has_function_privilege('authenticated', 'public.${fn}', 'EXECUTE') ok`)).ok).toBe(true);
    }
  });

  it("the undo restores the live behavior", async () => {
    const undo = new PGlite();
    await undo.exec(STUBS);
    await undo.exec(readFileSync("drizzle/migrations/0243_notion_ticket_import.sql", "utf8"));
    await undo.exec(readFileSync("docs/pending/notion-runner/01_import_guard.sql", "utf8"));
    await undo.exec(readFileSync("docs/pending/notion-runner/01_undo_import_guard.sql", "utf8"));
    await undo.exec(`INSERT INTO public.me VALUES ('${ADMIN}')`);
    const r = (await undo.query(`SELECT public.import_notion_ticket($1::jsonb) r`, [JSON.stringify(ticket({ reported_at: null }))])).rows[0].r;
    expect(r.action).toBe("created");
    expect((await undo.query(`SELECT has_function_privilege('service_role', 'public.import_notion_ticket(jsonb)', 'EXECUTE') ok`)).rows[0].ok).toBe(true);
  });
});
