// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/home-merge/01_notion_reopen.sql.
 * Tables are stubbed. Nothing touches the real database.
 */
const DIR = "docs/pending/home-merge";
const TECH = "00000000-0000-4000-8000-000000000002";
const OWNER = "00000000-0000-4000-8000-000000000003";
const OLD_PERSON = "00000000-0000-4000-8000-000000000009";
let db: PGlite;

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
INSERT INTO public.user_roles VALUES ('${TECH}','tech'), ('${OWNER}','owner');
CREATE TABLE public.tickets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, priority text DEFAULT 'p2', status text DEFAULT 'closed',
  reported_at timestamptz DEFAULT now() - interval '200 days', resolved_at timestamptz DEFAULT now() - interval '150 days',
  acknowledged_at timestamptz, action_started_at timestamptz, response_due_at timestamptz, action_due_at timestamptz,
  next_review_at timestamptz, waiting_on text, waiting_reason text, escalation_level text DEFAULT 'none',
  handoff_status text DEFAULT 'none', pending_handoff_to uuid, assigned_to uuid, current_action_owner uuid,
  record_owner uuid, accountable_owner uuid, assignment_source text, import_hold text, archived_at timestamptz,
  external_source text DEFAULT 'notion', external_status text DEFAULT 'Done', last_reopened_at timestamptz,
  is_demo boolean DEFAULT false);
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid,
  kind text, event_type text, body text, internal boolean, is_demo boolean, to_owner uuid, created_at timestamptz DEFAULT now());
`;

const asUser = (id: string) => db.exec(`DELETE FROM public.me; INSERT INTO public.me VALUES ('${id}');`);
const newTicket = async (extra = "") =>
  (await db.query<{ id: string }>(`INSERT INTO public.tickets(title${extra ? ", " + extra.split("=")[0] : ""}) VALUES ('Leak'${extra ? ", " + extra.split("=")[1] : ""}) RETURNING id`)).rows[0].id;
const reopen = (id: string, reason: string, resp = "now() + interval '30 minutes'", act = "now() + interval '60 minutes'") =>
  db.query(`SELECT public.reopen_notion_ticket($1, $2, ${resp}, ${act}) r`, [id, reason]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(`${DIR}/01_notion_reopen.sql`, "utf8"));
});

describe("pending Notion reopen SQL", () => {
  it("refuses anyone who cannot work tickets", async () => {
    const id = await newTicket();
    await asUser(OWNER);
    await expect(reopen(id, "Guest called back")).rejects.toThrow(/Only staff/);
  });

  it("requires a short reason", async () => {
    const id = await newTicket();
    await asUser(TECH);
    await expect(reopen(id, "  ")).rejects.toThrow(/short reason/);
  });

  it("refuses clocks that do not start from now", async () => {
    const id = await newTicket();
    await asUser(TECH);
    await expect(reopen(id, "Guest called back", "now() - interval '1 minute'")).rejects.toThrow(/not valid/);
  });

  it("makes the ticket live, assigns the caller, starts fresh clocks and writes the history line", async () => {
    const id = await newTicket(`assigned_to='${OLD_PERSON}'`);
    await asUser(TECH);
    await reopen(id, "Guest called back");
    const row = (await db.query("SELECT * FROM public.tickets WHERE id=$1", [id])).rows[0];
    expect(row.status).toBe("open");
    expect(row.external_status).toBe("reopened_in_resolve");
    expect(row.assigned_to).toBe(TECH);
    expect(row.current_action_owner).toBe(TECH);
    expect(row.resolved_at).toBeNull();
    expect(row.acknowledged_at).toBeNull();
    expect(new Date(row.last_reopened_at).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(new Date(row.response_due_at).getTime()).toBeGreaterThan(Date.now());
    const h = (await db.query("SELECT * FROM public.ticket_activity WHERE ticket_id=$1", [id])).rows;
    expect(h.length).toBe(1);
    expect(h[0].body).toBe("Reopened from Notion history. Reason: Guest called back");
    expect(h[0].author_id).toBe(TECH);
  });

  it("refuses a second reopening", async () => {
    const id = await newTicket();
    await asUser(TECH);
    await reopen(id, "First time");
    await expect(reopen(id, "Second time")).rejects.toThrow(/already live/);
  });

  it("an import rerun never undoes a reopening", async () => {
    const id = await newTicket();
    await asUser(TECH);
    await reopen(id, "Guest called back");
    await db.exec("BEGIN; SET LOCAL resolve.import_quiet = 'on';");
    await db.query("UPDATE public.tickets SET status='closed', external_status='Done', assigned_to=NULL WHERE id=$1", [id]);
    await db.exec("COMMIT;");
    const row = (await db.query("SELECT status, external_status, assigned_to FROM public.tickets WHERE id=$1", [id])).rows[0];
    expect(row).toEqual({ status: "open", external_status: "reopened_in_resolve", assigned_to: TECH });
  });

  it("only works on Notion imports", async () => {
    const id = await newTicket("external_source=NULL");
    await asUser(TECH);
    await expect(reopen(id, "Guest called back")).rejects.toThrow(/Only tickets imported from Notion/);
  });

  it("the undo removes everything the file added", async () => {
    const u = new PGlite();
    await u.exec(STUBS);
    await u.exec(readFileSync(`${DIR}/01_notion_reopen.sql`, "utf8"));
    await u.exec(readFileSync(`${DIR}/01_undo_notion_reopen.sql`, "utf8"));
    const n = (await u.query("SELECT count(*)::int n FROM pg_proc WHERE proname IN ('reopen_notion_ticket','keep_reopened_notion_ticket')")).rows[0].n;
    const tg = (await u.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='tickets_keep_reopened_notion'")).rows[0].n;
    expect(n + tg).toBe(0);
  });
});
