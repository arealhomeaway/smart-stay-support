// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/notion-ticket-import/01. Tables
 * and trigger functions are stubbed; each quieted trigger writes to fired_log
 * so the test proves imports start no routing, alerts or clocks while normal
 * inserts still fire them. Nothing touches the real database.
 */
const DIR = "docs/pending/notion-ticket-import";
const ADMIN = "00000000-0000-4000-8000-000000000001";
const STAFF = "00000000-0000-4000-8000-000000000002";
let db: PGlite;

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
${QUIET.map(([name, , fn]) => `CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.fired_log VALUES ('${name}'); IF TG_OP='INSERT' AND '${fn}'='auto_assign_ticket' THEN NEW.response_due_at := now(); END IF; RETURN NEW; END $$;`).join("\n")}
${QUIET.map(([name, ev, fn]) => `CREATE TRIGGER ${name} ${ev} ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.${fn}();`).join("\n")}
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${STAFF}','tech');
`;

const ticket = (over: Record<string, unknown> = {}) => ({
  external_id: "page-1", external_url: "https://notion.so/p1", external_status: "In progress",
  external_synced_at: "2026-10-20T12:00:00Z", title: "Leaky faucet", description: "Imported from Notion",
  priority: "p2", status: "in_progress", property_id: null, assigned_to: STAFF, reported_at: "2026-10-01T00:00:00Z",
  due_at: "2026-10-05T00:00:00Z", resolved_at: null, breezeway_task_url: null, waiting_on: null, waiting_reason: null,
  import_hold: "needs_home", claim: { stage: "potential", estimated_amount: 420, recovered_amount: 100, notes: "Imported from Notion" },
  ...over,
});
const asUser = (id: string) => db.exec(`DELETE FROM public.me; INSERT INTO public.me VALUES ('${id}');`);
const call = async (p: unknown) => (await db.query<{ r: { action: string; ticket_id: string } }>(`SELECT public.import_notion_ticket($1::jsonb) r`, [JSON.stringify(p)])).rows[0].r;
const count = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0].n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(`${DIR}/01_notion_ticket_import.sql`, "utf8"));
});

describe("pending Notion import SQL", () => {
  it("refuses anyone who is not an Admin", async () => {
    await asUser(STAFF);
    await expect(call(ticket())).rejects.toThrow(/Only an Admin/);
  });

  it("creates the ticket and its claim with no routing, alerts or clocks", async () => {
    await asUser(ADMIN);
    await db.exec("DELETE FROM public.fired_log");
    const r = await call(ticket());
    expect(r.action).toBe("created");
    expect(await count("SELECT count(*) n FROM public.fired_log")).toBe(0);
    const row = (await db.query<Record<string, unknown>>("SELECT * FROM public.tickets WHERE external_id='page-1'")).rows[0];
    expect(row.response_due_at).toBeNull();
    expect(row.assigned_to).toBe(STAFF);
    expect(row.external_source).toBe("notion");
    expect(row.import_hold).toBe("needs_home");
    expect(row.category).toBe("other");
    expect(await count("SELECT count(*) n FROM public.claims")).toBe(1);
  });

  it("a rerun never duplicates: unchanged is skipped, changed is updated", async () => {
    expect((await call(ticket())).action).toBe("skipped");
    expect((await call(ticket({ external_synced_at: "2026-10-21T12:00:00Z", priority: "p1" }))).action).toBe("updated");
    expect(await count("SELECT count(*) n FROM public.tickets WHERE external_id='page-1'")).toBe(1);
    expect(await count("SELECT count(*) n FROM public.claims")).toBe(1);
    expect(await count("SELECT count(*) n FROM public.fired_log")).toBe(0);
  });

  it("normal ticket writes still fire every trigger", async () => {
    await db.exec("INSERT INTO public.tickets(title) VALUES ('Normal ticket')");
    expect(await count("SELECT count(*) n FROM public.fired_log WHERE name='tickets_auto_assign'")).toBe(1);
    expect(await count("SELECT count(*) n FROM public.fired_log WHERE name='notify_ticket_events_trg'")).toBe(1);
    expect(await count("SELECT count(*) n FROM public.tickets WHERE title='Normal ticket' AND response_due_at IS NOT NULL")).toBe(1);
  });

  it("imports comments once with original author text and date", async () => {
    const id = (await db.query<{ id: string }>("SELECT id FROM public.tickets WHERE external_id='page-1'")).rows[0].id;
    const comments = [{ external_id: "c1", created_at: "2026-03-01T10:00:00Z", author: "Josh", body: "Called guest" }];
    const first = await db.query<{ n: number }>("SELECT public.import_notion_ticket_comments($1, $2::jsonb) n", [id, JSON.stringify(comments)]);
    const second = await db.query<{ n: number }>("SELECT public.import_notion_ticket_comments($1, $2::jsonb) n", [id, JSON.stringify(comments)]);
    expect(first.rows[0].n).toBe(1);
    expect(second.rows[0].n).toBe(0);
    const c = (await db.query<Record<string, unknown>>("SELECT * FROM public.ticket_activity")).rows[0];
    expect(c.external_author_name).toBe("Josh");
    expect(new Date(c.created_at as string).toISOString()).toBe("2026-03-01T10:00:00.000Z");
  });

  it("records a copied file once", async () => {
    const id = (await db.query<{ id: string }>("SELECT id FROM public.tickets WHERE external_id='page-1'")).rows[0].id;
    const f = JSON.stringify({ upload_key: "notion:b1", storage_path: "ticket/x/a.png", title: "a.png", kind: "photo" });
    expect((await db.query<{ r: boolean }>("SELECT public.import_notion_ticket_file($1, $2::jsonb) r", [id, f])).rows[0].r).toBe(true);
    expect((await db.query<{ r: boolean }>("SELECT public.import_notion_ticket_file($1, $2::jsonb) r", [id, f])).rows[0].r).toBe(false);
  });

  it("gives no execute to anon or PUBLIC", async () => {
    const r = await db.query<{ ok: boolean }>(
      "SELECT bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) ok FROM pg_proc p WHERE proname LIKE 'import_notion_ticket%'",
    );
    expect(r.rows[0].ok).toBe(false);
  });

  it("undo restores the triggers and removes the additions", async () => {
    await db.exec(readFileSync(`${DIR}/01_undo_notion_ticket_import.sql`, "utf8"));
    const cols = await count("SELECT count(*) n FROM information_schema.columns WHERE column_name IN ('import_hold','external_author_name')");
    expect(cols).toBe(0);
    const when = await count("SELECT count(*) n FROM pg_trigger WHERE tgrelid='public.tickets'::regclass AND pg_get_triggerdef(oid) LIKE '%import_quiet%'");
    expect(when).toBe(0);
    expect(await count("SELECT count(*) n FROM pg_trigger WHERE tgrelid='public.tickets'::regclass AND NOT tgisinternal")).toBe(QUIET.length);
  });
});
